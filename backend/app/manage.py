"""Explicit schema setup and account provisioning; no public registration."""
import argparse
from getpass import getpass
from sqlalchemy import select
from app.db import Base, engine, SessionLocal, User
from app.security import passwords


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['init-db', 'create-user'])
    parser.add_argument('--username')
    args = parser.parse_args()
    if args.action == 'init-db':
        Base.metadata.create_all(engine)
        print('Database tables ready. Existing tables retained.')
        return
    if not args.username or not 3 <= len(args.username.strip()) <= 80:
        parser.error('--username must contain 3–80 characters')
    password = getpass('Password (at least 12 characters): ')
    if len(password) < 12 or password != getpass('Repeat password: '):
        parser.error('Passwords must match and contain at least 12 characters')
    with SessionLocal.begin() as db:
        if db.scalar(select(User).where(User.username == args.username.strip().lower())):
            parser.error('Username already exists')
        db.add(User(username=args.username.strip().lower(), password_hash=passwords.hash(password)))
    print('User created.')


if __name__ == '__main__':
    main()
