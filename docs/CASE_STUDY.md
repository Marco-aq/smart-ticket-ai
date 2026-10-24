# Engineering case study

## Goal and scope

Build an end-to-end AI engineering portfolio project: take a trained classifier out of a script and make it usable through a secure web application. Smart Ticket AI covers training, evaluation artifacts, model serving, authenticated persistence, browser interactions, container packaging, and verification.

The finished application supports fictional English tickets. Hosting remains a manual operation by the owner; no public business results or production usage figures are claimed.

## Key decisions

| Decision | Reason | Tradeoff |
| --- | --- | --- |
| TF-IDF + Logistic Regression | Fast CPU inference, small local artifacts, and a clear supervised-learning baseline | Limited contextual understanding; queue accuracy needs improvement |
| Two independent pipelines | Category and priority remain independently trainable and inspectable | They do not model relationships between targets |
| Persist preprocessing with the model | Inference uses the same vocabulary and transforms as training | Artifact loading requires trusted joblib files and compatible libraries |
| Next.js server proxy | Keep browser sessions in HttpOnly cookies and use same-origin requests | Adds a server hop and requires explicit origin configuration |
| Opaque database sessions | Support immediate logout/password-reset revocation without exposing token contents | Session checks depend on database availability |
| Owner filtering in FastAPI | Enforce isolation for direct API callers, not just through UI controls | Every read, mutation, and aggregate must preserve the ownership condition |
| Separate `user_tickets` table | Avoid accidentally publishing legacy tickets without an owner | Existing data requires a deliberate ownership migration |
| PostgreSQL for deployment, SQLite locally | Accessible local setup with a durable deployment datastore | Database-specific behavior must also be checked in PostgreSQL CI |
| One API worker with in-memory limits | Keep initial infrastructure small and make rate-limit behavior explicit | Quotas reset on restart and can be shared behind proxies; scaling needs a shared store |
| Inference-only Docker dependencies | Keep training and test tooling out of the runtime image | The development dependency file includes the separate runtime manifest |
| Manual hosting | Let the owner control publication and provider choices | Accounts, private variables, and the final smoke checks remain deployment tasks |

## What changed from the first form

The initial version accepted text and returned predictions. It had no persisted account-owned workflow. The expanded version provides provisioned accounts, private ticket CRUD, search, filters, server pagination, status changes, account-specific analytics, and deletion. The public classifier remains available without storing text.

The security boundary is implemented in the API. A second account receives 404 for another account's ticket and sees zero contributions from it in its list and analytics. The browser's proxy adds origin checks, cookie security attributes, and controlled forwarding; it does not replace API authorization.

## Evaluation and interpretation

The saved queue accuracy is 55.19%, and priority accuracy is 65.22%. Those figures are documented as initial synthetic-data results. Dashboard counts describe requests saved in the application and are not presented as model performance metrics.

The project intentionally exposes the difference between a working integration and a reliable classifier. Real-world validation, majority-class comparison, calibration, and class-level error analysis remain explicit next steps rather than invented accomplishments.

## Verification strategy

API tests exercise validation, authentication, expired/revoked sessions, record ownership, search/filter/page behavior, and rate limits. A PostgreSQL integration check exercises the authenticated lifecycle against a dedicated test database. Playwright covers the full user flow with two accounts and a mobile viewport.

CI also compiles the frontend and builds the container. The packaged API smoke check verifies startup, real model inference, and unauthenticated rejection on protected routes. Container inspections check that required artifacts are present while local environments, dataset clients, and test packages are absent.

## Operational boundaries

The API runs as a non-root process and respects the host's `PORT`. Production mode requires PostgreSQL. Credentials are supplied outside Git and the Docker context. Git-triggered Vercel deployments are disabled in the committed configuration; Render's manual setting is documented separately.

Retention cleanup is an administration command, not an automatically running job. Account deletion and password reset are available to the owner through the CLI. This is a deployable portfolio demo with documented limits, not a claim of production hardening for real personal data or critical incidents.
