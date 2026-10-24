import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal
from uuid import UUID
import joblib
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.db import LoginSession, Ticket, User, get_db
from app.security import DUMMY_HASH, current_user, digest, passwords

if os.getenv('ENVIRONMENT') == 'production' and not os.getenv('DATABASE_URL', '').startswith(('postgresql://', 'postgresql+psycopg://')):
    raise RuntimeError('Production requires a PostgreSQL DATABASE_URL')

MODELS_DIR = Path(__file__).resolve().parents[1] / 'models'
limiter = Limiter(key_func=get_remote_address, default_limits=['120/minute'])


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.category_model = joblib.load(MODELS_DIR / 'category_model.joblib')
    app.state.priority_model = joblib.load(MODELS_DIR / 'priority_model.joblib')
    yield


app = FastAPI(title='Smart Ticket AI API', version='2.0.0', lifespan=lifespan)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware,
    allow_origins=[x.strip() for x in os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000').split(',') if x.strip()],
    allow_methods=['GET', 'POST', 'PATCH', 'DELETE'], allow_headers=['Content-Type', 'Authorization'])


@app.middleware('http')
async def private_responses(request: Request, call_next):
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


class TicketInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    subject: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=5000)


class SavedTicketInput(TicketInput):
    synthetic_data_confirmed: Literal[True]


class PredictionOutput(BaseModel):
    category: str
    category_score: float
    priority: str
    priority_score: float
    needs_review: bool


class LoginInput(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=1, max_length=256)


class TicketUpdate(BaseModel):
    status: Literal['open', 'in_progress', 'resolved']


def classify(ticket, request):
    text = f'{ticket.subject} {ticket.description}'
    values = []
    for model in [request.app.state.category_model, request.app.state.priority_model]:
        probs = model.predict_proba([text])[0]
        idx = int(probs.argmax())
        values.append((str(model.classes_[idx]), float(probs[idx])))
    return PredictionOutput(category=values[0][0], category_score=values[0][1],
        priority=values[1][0], priority_score=values[1][1],
        needs_review=min(values[0][1], values[1][1]) < 0.60)


def serialize(ticket):
    return {c.name: getattr(ticket, c.name) for c in Ticket.__table__.columns if c.name != 'owner_id'}


def owned(db, ticket_id, user):
    ticket = db.get(Ticket, str(ticket_id))
    if ticket is None or ticket.owner_id != user.id:
        raise HTTPException(404, 'Ticket not found')
    return ticket


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/auth/login')
@limiter.limit('5/minute')
def login(request: Request, data: LoginInput, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == data.username.strip().lower()))
    valid = passwords.verify(data.password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid:
        raise HTTPException(401, 'Invalid username or password')
    token = secrets.token_urlsafe(48)
    db.add(LoginSession(token_hash=digest(token), user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=8)))
    db.commit()
    return {'access_token': token, 'token_type': 'bearer', 'expires_in': 28800}


@app.get('/auth/me')
def me(user: User = Depends(current_user)):
    return {'username': user.username}


@app.post('/auth/logout', status_code=204)
def logout(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = db.get(LoginSession, digest(request.headers['authorization'].split()[1]))
    if session:
        db.delete(session)
        db.commit()
    return Response(status_code=204)


@app.post('/predict', response_model=PredictionOutput)
@limiter.limit('10/minute')
def predict(request: Request, ticket: TicketInput):
    return classify(ticket, request)


@app.post('/tickets', status_code=201)
@limiter.limit('20/minute')
def create_ticket(request: Request, ticket: SavedTicketInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    prediction = classify(ticket, request)
    record = Ticket(owner_id=user.id, **ticket.model_dump(exclude={'synthetic_data_confirmed'}), predicted_category=prediction.category,
        predicted_priority=prediction.priority, category_score=prediction.category_score,
        priority_score=prediction.priority_score, needs_review=prediction.needs_review)
    db.add(record)
    db.commit()
    db.refresh(record)
    return serialize(record)


@app.get('/tickets')
def get_tickets(q: str = Query('', max_length=200), priority: str = Query('', max_length=50),
        status: Literal['open', 'in_progress', 'resolved'] | None = None,
        page: int = Query(1, ge=1, le=100000), page_size: int = Query(10, ge=1, le=100),
        user: User = Depends(current_user), db: Session = Depends(get_db)):
    conditions = [Ticket.owner_id == user.id]
    if q.strip():
        conditions.append(Ticket.subject.icontains(q.strip(), autoescape=True))
    if priority:
        conditions.append(Ticket.predicted_priority == priority)
    if status:
        conditions.append(Ticket.status == status)
    total = db.scalar(select(func.count()).select_from(Ticket).where(*conditions))
    rows = db.scalars(select(Ticket).where(*conditions).order_by(Ticket.created_at.desc(), Ticket.id).offset((page-1)*page_size).limit(page_size)).all()
    priorities = db.scalars(select(Ticket.predicted_priority).where(Ticket.owner_id == user.id).distinct()).all()
    return {'items': [serialize(t) for t in rows], 'total': total, 'page': page, 'page_size': page_size, 'priorities': sorted(priorities)}


@app.get('/tickets/{ticket_id}')
def detail(ticket_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return serialize(owned(db, ticket_id, user))


@app.patch('/tickets/{ticket_id}')
def update(ticket_id: UUID, data: TicketUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    ticket = owned(db, ticket_id, user)
    ticket.status = data.status
    db.commit()
    return serialize(ticket)


@app.delete('/tickets/{ticket_id}', status_code=204)
def delete(ticket_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(owned(db, ticket_id, user))
    db.commit()
    return Response(status_code=204)


@app.get('/analytics')
def analytics(user: User = Depends(current_user), db: Session = Depends(get_db)):
    def count(*conditions):
        return db.scalar(select(func.count()).select_from(Ticket).where(Ticket.owner_id == user.id, *conditions))
    def groups(column):
        rows = db.execute(select(column, func.count()).where(Ticket.owner_id == user.id).group_by(column)).all()
        return [{'label': label, 'count': number} for label, number in rows]
    total = count()
    reviews = count(Ticket.needs_review.is_(True))
    return {'total': total, 'needs_review': reviews, 'review_rate': reviews / total if total else 0,
        'categories': groups(Ticket.predicted_category), 'priorities': groups(Ticket.predicted_priority), 'statuses': groups(Ticket.status)}
