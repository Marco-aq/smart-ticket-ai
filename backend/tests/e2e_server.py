"""Isolated browser-test server. Never run against a production database."""
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

if __name__ == '__main__':
    with TemporaryDirectory() as directory:
        os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(directory) / 'test.db')
        os.environ['ENVIRONMENT'] = 'test'
        from app.db import Base, engine, SessionLocal, User
        from app.security import passwords
        from app.main import app
        import uvicorn
        Base.metadata.create_all(engine)
        with SessionLocal.begin() as db:
            for name in ['alice', 'bob']:
                db.add(User(username=name, password_hash=passwords.hash('browser-test-only-123')))
        uvicorn.run(app, host='127.0.0.1', port=8100, proxy_headers=False)
