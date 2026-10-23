"""Optional integration test against a dedicated local PostgreSQL test database."""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from app.db import Base, User, get_db
from app.main import app, limiter
from app.security import passwords


@pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'), reason='No dedicated PostgreSQL test database configured')
def test_postgres_round_trip():
    url = make_url(os.environ['TEST_DATABASE_URL'])
    if url.host not in ['localhost', '127.0.0.1'] or not (url.database or '').endswith('_test'):
        pytest.fail('TEST_DATABASE_URL must point to a local database ending in _test')
    engine = create_engine(url, hide_parameters=True)
    sessions = sessionmaker(engine, expire_on_commit=False)
    Base.metadata.create_all(engine)
    def db_override():
        with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = db_override
    limiter.reset()
    try:
        with sessions.begin() as db:
            db.add(User(username='postgres-test', password_hash=passwords.hash('test-only-password')))
        with TestClient(app) as client:
            login = client.post('/auth/login', json={'username': 'postgres-test', 'password': 'test-only-password'})
            assert login.status_code == 200
            headers = {'Authorization': 'Bearer ' + login.json()['access_token']}
            created = client.post('/tickets', headers=headers, json={
                'subject': 'Synthetic payment issue', 'description': 'Fictional transaction was charged twice in a synthetic test.',
                'synthetic_data_confirmed': True,
            })
            assert created.status_code == 201
            ticket = created.json()
            assert client.get('/tickets?q=payment', headers=headers).json()['total'] == 1
            assert client.patch('/tickets/' + ticket['id'], headers=headers, json={'status': 'resolved'}).status_code == 200
            assert client.get('/analytics', headers=headers).json()['total'] == 1
            assert client.delete('/tickets/' + ticket['id'], headers=headers).status_code == 204
            assert client.post('/auth/logout', headers=headers).status_code == 204
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()
