
from fastapi.testclient import TestClient
from app.main import app


def test_health():
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_prediction():
    payload = {
        "subject": "Login problem",
        "description": (
            "I cannot access my account "
            "after resetting my password."
        ),
    }

    with TestClient(app) as client:
        response = client.post("/predict", json=payload)

    assert response.status_code == 200

    data = response.json()
    assert isinstance(data["category"], str)
    assert isinstance(data["priority"], str)
    assert 0 <= data["category_score"] <= 1
    assert 0 <= data["priority_score"] <= 1


def test_invalid_ticket():
    with TestClient(app) as client:
        response = client.post(
            "/predict",
            json={"subject": "A", "description": "short"},
        )

    assert response.status_code == 422
