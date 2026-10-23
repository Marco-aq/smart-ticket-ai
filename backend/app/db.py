import os
from datetime import datetime, timezone
from uuid import uuid4
from dotenv import load_dotenv
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

load_dotenv()
url = os.getenv('DATABASE_URL', 'sqlite:///./smart_ticket.db')
if url.startswith('postgresql://'):
    url = url.replace('postgresql://', 'postgresql+psycopg://', 1)
engine = create_engine(url, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = 'app_users'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    username: Mapped[str] = mapped_column(String(80), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)


class LoginSession(Base):
    __tablename__ = 'login_sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('app_users.id'), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Ticket(Base):
    # Keep legacy unowned tickets separate; never expose them to new accounts.
    __tablename__ = 'user_tickets'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    owner_id: Mapped[str] = mapped_column(ForeignKey('app_users.id'), index=True)
    subject: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    predicted_category: Mapped[str] = mapped_column(String(100))
    predicted_priority: Mapped[str] = mapped_column(String(50))
    category_score: Mapped[float] = mapped_column(Float)
    priority_score: Mapped[float] = mapped_column(Float)
    needs_review: Mapped[bool] = mapped_column(Boolean)
    status: Mapped[str] = mapped_column(String(30), default='open')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


def get_db():
    with SessionLocal() as db:
        yield db
