from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db import Base, LoginSession, User, get_db
from app.main import app, limiter
from app.security import digest, passwords


@pytest.fixture
def client():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(engine, expire_on_commit=False)
    def db_override():
        with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = db_override
    limiter.reset()
    with sessions.begin() as db:
        for name in ['alice', 'bob']:
            db.add(User(username=name, password_hash=passwords.hash('test-password-123')))
    with TestClient(app) as api:
        api.sessions = sessions
        yield api
    app.dependency_overrides.clear()
    engine.dispose()


def auth(client, name='alice'):
    response = client.post('/auth/login', json={'username': name, 'password': 'test-password-123'})
    assert response.status_code == 200
    return {'Authorization': 'Bearer ' + response.json()['access_token']}


PAYLOAD = {'subject': 'Payment error', 'description': 'My credit card was charged twice for the same purchase.'}


def test_authentication_and_revocation(client):
    assert client.get('/tickets').status_code == 401
    assert client.post('/tickets', json=PAYLOAD).status_code == 401
    assert client.get('/analytics').status_code == 401
    assert client.post('/auth/login', json={'username': 'alice', 'password': 'wrong'}).status_code == 401
    headers = auth(client)
    assert client.get('/auth/me', headers=headers).json() == {'username': 'alice'}
    token = headers['Authorization'].split()[1]
    with client.sessions() as db:
        assert db.get(LoginSession, digest(token)) is not None
        assert db.get(LoginSession, token) is None
    assert client.post('/auth/logout', headers=headers).status_code == 204
    assert client.get('/tickets', headers=headers).status_code == 401


def test_ownership_filters_analytics_and_deletion(client):
    alice, bob = auth(client), auth(client, 'bob')
    response = client.post('/tickets', json=PAYLOAD, headers=alice)
    assert response.status_code == 201
    ticket = response.json()
    path = '/tickets/' + ticket['id']
    assert 'owner_id' not in ticket
    for method in ['get', 'patch', 'delete']:
        kwargs = {'json': {'status': 'resolved'}} if method == 'patch' else {}
        assert getattr(client, method)(path, headers=bob, **kwargs).status_code == 404
    assert client.get('/tickets', headers=bob).json()['total'] == 0
    assert client.get('/analytics', headers=bob).json()['total'] == 0
    assert client.patch(path, json={'status': 'resolved'}, headers=alice).status_code == 200
    assert client.get('/tickets?status=open', headers=alice).json()['total'] == 0
    assert client.get('/tickets?q=Payment&status=resolved&page_size=1', headers=alice).json()['total'] == 1
    assert client.get('/tickets?q=%25', headers=alice).json()['total'] == 0
    assert client.get('/tickets?page=2&page_size=1', headers=alice).json()['items'] == []
    assert client.get('/tickets?priority=' + ticket['predicted_priority'], headers=alice).json()['total'] == 1
    assert client.get('/analytics', headers=alice).json()['total'] == 1
    assert client.delete(path, headers=alice).status_code == 204
    assert client.get(path, headers=alice).status_code == 404


def test_expired_session_and_validation(client):
    headers = auth(client)
    with client.sessions.begin() as db:
        session = db.scalar(select(LoginSession))
        session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    assert client.get('/tickets', headers=headers).status_code == 401
    headers = auth(client)
    assert client.get('/tickets?page=0', headers=headers).status_code == 422
    assert client.post('/tickets', headers=headers, json={'subject': '   ', 'description': ' ' * 20}).status_code == 422
    ticket = client.post('/tickets', headers=headers, json=PAYLOAD).json()
    assert client.patch('/tickets/' + ticket['id'], headers=headers, json={'status': 'fake'}).status_code == 422


def test_rate_limit(client):
    for _ in range(5):
        assert client.post('/auth/login', json={'username': 'alice', 'password': 'wrong'}).status_code == 401
    assert client.post('/auth/login', json={'username': 'alice', 'password': 'wrong'}).status_code == 429
    for _ in range(10):
        assert client.post('/predict', json=PAYLOAD).status_code == 200
    assert client.post('/predict', json=PAYLOAD).status_code == 429
