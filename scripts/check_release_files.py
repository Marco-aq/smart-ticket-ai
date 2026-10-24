"""Verify tracked filenames and Git ignore behavior without reading secret values."""
from pathlib import Path
import subprocess


def main():
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], text=True).split('\0')
    forbidden = []
    for name in filter(None, tracked):
        path = Path(name)
        if path.name.startswith('.env') and path.name != '.env.example':
            forbidden.append(name)
        elif path.suffix.lower() in {'.pem', '.key', '.p12', '.pfx', '.db', '.sqlite', '.sqlite3', '.dump', '.pyc'}:
            forbidden.append(name)
        elif any(part in {'__pycache__', '.venv', 'venv', 'node_modules', 'secrets', 'backups'} for part in path.parts):
            forbidden.append(name)
    assert not forbidden, 'Private/generated filenames tracked: ' + ', '.join(forbidden)
    for name in ['backend/.env', 'backend/app/.env.private', 'frontend/.env.local',
                 'frontend/src/.env.production', 'backend/private.key', 'backend/local.sqlite3',
                 'backend/backups/data.sql', 'backend/.venv/pyvenv.cfg', 'frontend/node_modules/example.js']:
        result = subprocess.run(['git', 'check-ignore', '--no-index', '-q', name])
        assert result.returncode == 0, f'Expected file to be ignored: {name}'
    for name in ['backend/.env.example', 'frontend/.env.example',
                 'backend/models/category_model.joblib', 'backend/models/priority_model.joblib',
                 'backend/requirements-runtime.txt', 'frontend/package-lock.json', 'backend/migrations/schema.sql']:
        result = subprocess.run(['git', 'check-ignore', '--no-index', '-q', name])
        assert result.returncode == 1, f'Required public file incorrectly ignored: {name}'
    print('Release filenames and Git exclusion rules passed; no secret values were read.')


if __name__ == '__main__':
    main()
