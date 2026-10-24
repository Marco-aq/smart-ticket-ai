# Smart Ticket AI

Portfolio demo: classify **synthetic English support tickets** with TF-IDF + Logistic Regression, then manage a private ticket queue.

- Next.js 16 + React + TypeScript frontend with responsive navigation, public classifier, login, creation, searchable/paginated history, ticket details and analytics.
- FastAPI + SQLAlchemy + PostgreSQL (SQLite for local development).
- Argon2 password hashes, opaque sessions (only token hashes persisted), eight-hour expiry and server-side logout revocation.
- Every ticket read, update, deletion and aggregate is scoped to its owner. No public registration: provision accounts with the CLI.
- Same-origin Next.js proxy stores sessions in HttpOnly, SameSite=Strict cookies (Secure in production). Mutation requests require the configured origin.
- Explicit rate limits: login 5/minute, public predictions 10/minute, ticket creation 20/minute; other endpoints 120/minute. The demo runs **one API worker**, with a process-local rate-limit store. Behind the frontend/reverse proxy, users can share the same network bucket. Scaling requires a shared store and a verified trusted-proxy configuration.

## Architecture

Browser → Next.js `/api/backend/*` → FastAPI → PostgreSQL + local trained models.

`API_URL` is a server environment variable. Session tokens and database credentials never enter the browser JavaScript bundle. CORS alone is not authorization; FastAPI checks the session and ownership directly.

## Local setup (Windows PowerShell)

Requires Python 3.11 and Node.js 24 LTS. From the repository root:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m app.manage init-db
python -m app.manage create-user --username marco
python -m uvicorn app.main:app --reload
```

Choose a unique password of at least 12 characters at the prompt. Do not commit `.env`. SQLite is created in `backend` for local use. To use Neon locally, replace `DATABASE_URL` in `.env` before initializing the schema.

In a second terminal, from the repository root:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open **http://localhost:3000**. Use exactly that hostname because `APP_ORIGIN` must match. API docs: http://localhost:8000/docs. For authenticated API calls, `/auth/login` returns a bearer token; the browser proxy hides this token in its HttpOnly cookie.

## Pages

| Route | Purpose |
|---|---|
| `/` | Project overview and public classifier (text not persisted) |
| `/login` | Account login |
| `/tickets/new` | Classify and save a fictional ticket |
| `/tickets` | Own history, subject search, priority/status filters, server pagination |
| `/tickets/[id]` | Classification, description, status change, permanent deletion |
| `/analytics` | Own counts and category/priority/status distributions across all pages |
| `/privacy` | Demo data handling and limitations |

## Verify

```powershell
cd backend
python -m pytest -q
cd ../frontend
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

For browser tests, use the Python environment containing the backend dependencies. Playwright starts isolated local servers (ports 8100/3100), creates a temporary SQLite database, and uses fixed **test-only** accounts. No real database credentials or account are required. CI also builds the Docker image.

## Database and maintenance

`python -m app.manage init-db` creates `app_users`, `login_sessions`, and `user_tickets`; it does not modify or expose an earlier unowned `tickets` table. If you have old data, migrate it separately only after assigning its owner. These are initial schema creation commands, not a general migration system; future schema changes should use versioned migrations.

```powershell
python -m app.manage reset-password --username marco
python -m app.manage purge-expired
python -m app.manage delete-user --username marco
```

Resetting a password revokes all the account's sessions. Purging removes sessions past expiry and tickets older than 30 days. Schedule the purge daily in your own environment if you want automated retention; no scheduler is installed or activated by this repository. Account deletion asks for the username again before removing associated records.

## Manual deployment

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for Render + Vercel + Neon instructions, exact variables, database initialization, account provisioning, and checks. No deployment is performed by this change.

## Model scope

Models in `backend/models` remain the original trained artifacts. scikit-learn is pinned to **1.9.1**, matching their serialized training version. Only load trusted joblib files. Training: `cd backend`, then `python -m ml.train`.

The source is [vasu1111/customer-support-tickets](https://huggingface.co/datasets/vasu1111/customer-support-tickets). The previous project guide identifies it as synthetic and CC BY-NC 4.0; verify the dataset card and attribution before reuse, redistribution, or commercial adaptation. This prototype is for noncommercial portfolio demonstration.

Saved metrics are held in `backend/models/metrics.json`. Dashboard statistics describe saved demo tickets, **not accuracy**. Model scores are uncalibrated; the 0.60 review threshold is provisional. English only. Test on real, consented data and calibrate thresholds before any operational use.

## Privacy boundary

Use fictional data only. Ticket creation requires an explicit synthetic-data declaration; this cannot detect or guarantee removal of personal information. The application does not log request bodies, but infrastructure may retain connection metadata and backups. A production service handling real people needs an owner-specific privacy notice, lawful data handling and a defined retention process. The included `/privacy` page states the prototype's actual behavior.
