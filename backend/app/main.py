
import os
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parents[1]
MODELS_DIR = BASE_DIR / "models"


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.category_model = joblib.load(
        MODELS_DIR / "category_model.joblib"
    )
    app.state.priority_model = joblib.load(
        MODELS_DIR / "priority_model.joblib"
    )
    yield


app = FastAPI(
    title="Smart Ticket AI API",
    version="1.0.0",
    lifespan=lifespan,
)

origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class TicketInput(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=5000)


class PredictionOutput(BaseModel):
    category: str
    category_score: float
    priority: str
    priority_score: float
    needs_review: bool


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict", response_model=PredictionOutput)
def predict(ticket: TicketInput, request: Request):
    text = f"{ticket.subject} {ticket.description}"

    category_model = request.app.state.category_model
    priority_model = request.app.state.priority_model

    category_probs = category_model.predict_proba([text])[0]
    priority_probs = priority_model.predict_proba([text])[0]

    category_idx = int(category_probs.argmax())
    priority_idx = int(priority_probs.argmax())

    category = str(category_model.classes_[category_idx])
    priority = str(priority_model.classes_[priority_idx])

    category_score = float(category_probs[category_idx])
    priority_score = float(priority_probs[priority_idx])

    return PredictionOutput(
        category=category,
        category_score=category_score,
        priority=priority,
        priority_score=priority_score,
        needs_review=(
            category_score < 0.60
            or priority_score < 0.60
        ),
    )
