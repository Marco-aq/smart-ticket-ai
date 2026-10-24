"""Explicit schema setup and account provisioning; no public registration."""
import argparse
from getpass import getpass
from sqlalchemy import select, delete
from app.db import Base, engine, SessionLocal, User, Ticket, LoginSession
from datetime import datetime, timedelta, timezone
from app.security import passwords


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['init-db', 'create-user', 'purge-expired', 'delete-user', 'reset-password'])
    parser.add_argument('--username')
    args = parser.parse_args()
    if args.action == 'init-db':
        Base.metadata.create_all(engine)
        print('Database tables ready. Existing tables retained.')
        return
    if args.action == 'purge-expired':
        now = datetime.now(timezone.utc)
        with SessionLocal.begin() as db:
            tickets = db.execute(delete(Ticket).where(Ticket.created_at < now - timedelta(days=30))).rowcount
            sessions = db.execute(delete(LoginSession).where(LoginSession.expires_at < now)).rowcount
        print(f'Deleted {tickets} expired tickets and {sessions} expired sessions.')
        return
    if args.action in ['delete-user', 'reset-password']:
        if not args.username:
            parser.error('--username is required')
        with SessionLocal.begin() as db:
            user = db.scalar(select(User).where(User.username == args.username.strip().lower()))
            if not user:
                parser.error('User not found')
            if args.action == 'delete-user':
                if input(f'Type {user.username} to permanently delete this account and its tickets: ') != user.username:
                    parser.error('Deletion cancelled')
                db.execute(delete(Ticket).where(Ticket.owner_id == user.id))
                db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
                db.delete(user)
                print('Account and associated data deleted.')
            else:
                password = getpass('New password (12–256 characters): ')
                if not 12 <= len(password) <= 256 or password != getpass('Repeat password: '):
                    parser.error('Passwords must match and contain 12–256 characters')
                user.password_hash = passwords.hash(password)
                db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
                print('Password reset; all sessions revoked.')
        return
    if not args.username or not 3 <= len(args.username.strip()) <= 80:
        parser.error('--username must contain 3–80 characters')
    password = getpass('Password (12–256 characters): ')
    if not 12 <= len(password) <= 256 or password != getpass('Repeat password: '):
        parser.error('Passwords must match and contain 12–256 characters')
    with SessionLocal.begin() as db:
        if db.scalar(select(User).where(User.username == args.username.strip().lower())):
            parser.error('Username already exists')
        db.add(User(username=args.username.strip().lower(), password_hash=passwords.hash(password)))
    print('User created.')


if __name__ == '__main__':
    main()
