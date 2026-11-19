# HandoverIQ

**AI-powered project handover and knowledge management.** HandoverIQ turns project documents into a structured handover in which every claim points back to the passage it came from, so the person taking over can check it instead of taking it on trust.

---

## 1. Problem statement

When someone leaves a project, what they know usually leaves with them. It is scattered across notes, tickets and wikis, and a handover meeting captures only a fraction. The newcomer cannot tell which parts are solid. Writing everything down by hand is slow, and an AI summary on its own is hard to trust because you cannot tell what it invented.

## 2. Proposed solution

1. The outgoing member uploads the project's documents.
2. An AI (Anthropic's Claude) reads each one and proposes **findings**: technical details, decisions, completed and pending tasks, dependencies, known issues, setup steps, recommendations. Every finding carries a **verbatim quote** from the document.
3. HandoverIQ **checks that each quote really appears in the document**. A quote that does not is flagged, never trusted.
4. A person **reviews** every finding: accept, edit or reject. Nothing reaches the handover until a person accepts it.
5. The handover (nine sections) is completed, the incoming member acknowledges it, and a frozen, versioned **report** can be exported as PDF or Markdown.

## 3. Features

| Area | What it does |
|---|---|
| **Landing page** | Introduction, problem and solution, features, how it works, benefits, call to action. |
| **Accounts** | Registration, sign-in, sign-out, profile, password change. Passwords hashed with Argon2id. Sessions in an HttpOnly cookie. |
| **Dashboard** | Total and active projects, completed and pending handovers, recent projects, recent activity. All computed from the database. |
| **Projects** | Create, edit, search, filter, view; delete with confirmation (soft delete). |
| **Members and roles** | Owner, outgoing, incoming and collaborator roles with enforced permissions. People without an account yet are linked automatically when they register. |
| **Documents** | Upload PDF, Word (.docx), text and Markdown. Validation of type, size and real file content. Text extraction with status, preview, download, delete. |
| **AI knowledge** | Real Anthropic API calls with structured output, verified quotes, honest error handling, review and edit, apply to the handover. Analysis history with token counts. |
| **Handover workspace** | Nine sections (overview, technical documentation, completed tasks, pending tasks, decisions, dependencies, known issues, setup, recommendations), progress, review, completion lock, reopen, acknowledgement by the incoming member. |
| **Reports** | Frozen, versioned snapshots; history; PDF and Markdown export. |
| **Activity** | A feed of what happened in each project and across your projects. |

## 4. Technology stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Lucide icons |
| Backend | Python 3.12, FastAPI, Pydantic 2, SQLAlchemy 2, Alembic |
| Database | SQLite (local development), PostgreSQL (production) |
| AI | Anthropic API (`anthropic` Python SDK) |
| Documents | PyMuPDF (PDF), python-docx (Word), ReportLab (PDF reports) |
| Security | Argon2id, PyJWT, HttpOnly cookies, CSRF header, CORS allow-list |
| Tests | pytest, Vitest, Testing Library, GitHub Actions |
| Hosting (suggested) | Netlify (frontend), Render (backend), Neon (PostgreSQL) |

## 5. Architecture

```text
   Browser (Next.js app)
        │  HTTPS, JSON, HttpOnly session cookie
        ▼
   FastAPI backend ───────────────► Anthropic API   (document analysis)
        │
        │  api/      routers: thin HTTP layer, permission checks
        │  services/ business rules: access, projects, documents, handovers,
        │            knowledge (AI), reports, dashboard, activity
        │  models/   SQLAlchemy tables      schemas/  Pydantic request/response
        │  core/     config, security, errors, rate limiting
        ▼
   PostgreSQL (SQLite locally)  ·  Alembic migrations
```

Design decisions worth knowing:

- **Documents are stored in the database**, not on disk, so they survive redeploys on hosts with temporary disks and are only ever served through permission checks.
- **Anyone without access gets "not found"**, so the existence of other people's projects is never revealed.
- **AI output is forced into a schema** (tool use) and every quote is verified against the document text.
- **Reports are snapshots**: later edits never change a report that was already generated.

## 6. Project structure

```text
HANDOVERIQ/
├── README.md
├── LICENSE
├── .gitignore
├── .env.example                 Reference list of every setting
├── netlify.toml                 Frontend deployment
├── render.yaml                  Backend deployment (Render Blueprint)
├── .github/workflows/ci.yml     Tests and build on every push
├── backend/
│   ├── app/
│   │   ├── main.py              App setup, middleware, routers, /api/health
│   │   ├── domain.py            Roles, statuses, section and category vocabulary
│   │   ├── core/                config, security, errors, logging, rate limit
│   │   ├── db/                  base, session, migrate
│   │   ├── models/              11 tables
│   │   ├── schemas/             request and response models
│   │   ├── services/            business logic (+ ai/ and extraction)
│   │   └── api/                 deps.py and routers/
│   ├── migrations/              Alembic migrations
│   ├── tests/                   138 tests
│   ├── alembic.ini  pytest.ini
│   ├── requirements.txt  requirements-dev.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── app/                 pages: landing, (auth)/login|register, app/…
    │   ├── components/          ui/, layout/, features/, landing/
    │   ├── lib/                 api client, types, hooks, auth, validation, format
    │   └── test/                component and flow tests
    ├── scripts/check-env.mjs    Stops a build with no backend address
    ├── package.json  tsconfig.json  eslint.config.mjs  vitest.config.mts
    └── .env.example
```

## 7. Prerequisites

| Software | Version |
|---|---|
| Python | 3.12 or newer |
| Node.js | 22 (20.9 or newer works) |
| Git, VS Code | any recent version |
| PostgreSQL | only for production-like testing (16 recommended) |
| Anthropic API key | only for AI analysis (see section 10) |

## 8. Installation and running (Windows PowerShell)

Open the project folder in VS Code and use **two terminals**.

### Terminal 1: backend

```powershell
cd backend
py -3.12 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

If PowerShell refuses to run `Activate.ps1`, run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` once and try again.

Check it: open <http://localhost:8000/api/health>. You should see `"status":"ok"` and `"database":"ok"`. Interactive API documentation is at <http://localhost:8000/api/docs>.

### Terminal 2: frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open <http://localhost:3000>, create an account, and you are in.

> **Use `localhost` for both** (not `127.0.0.1`). The browser only keeps the session cookie when the website and the API count as the same site.

## 9. Database setup and migrations

- **Local:** a SQLite file (`backend/handoveriq.db`) is created and migrated automatically when the backend starts. Nothing to install.
- **PostgreSQL:** put its address in `backend\.env` and restart:
  ```text
  DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
  ```
  Addresses starting with `postgres://` or `postgresql://` (as given by Neon, Supabase and Render) work unchanged.
- **Migrations** run automatically at startup (`AUTO_MIGRATE=true`). To run them yourself:
  ```powershell
  cd backend
  alembic upgrade head          # apply
  alembic downgrade -1          # undo the last one
  alembic revision --autogenerate -m "describe the change"   # after editing a model
  alembic check                 # confirms the models and the migrations agree
  ```
- Deleting a project is a **soft delete**: the data stays in the table (hidden from everyone) so it can be recovered by an administrator.

## 10. Environment variables

Full commented lists: `backend/.env.example` and `frontend/.env.example`. The important ones:

| Variable | Where | Meaning |
|---|---|---|
| `ENVIRONMENT` | backend | `development` or `production`. Production refuses to start with unsafe settings. |
| `DATABASE_URL` | backend | SQLite locally, PostgreSQL in production. |
| `SECRET_KEY` | backend | Signs sessions. **Required in production**, 32+ random characters. |
| `FRONTEND_ORIGINS` | backend | Addresses of the website, comma separated. |
| `COOKIE_SAMESITE`, `COOKIE_SECURE` | backend | `none` and `true` when the website and API are on different sites. |
| `ANTHROPIC_API_KEY` | backend | Enables AI analysis. |
| `ANTHROPIC_MODEL` | backend | Defaults to `claude-sonnet-5-5`. |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | Public address of the backend, no trailing slash. **Required for builds.** |

### Setting up the AI (Anthropic)

1. Create an account and an API key at <https://console.anthropic.com/>. Usage is billed by Anthropic; set a spending limit there.
2. Put the key in `backend\.env` as `ANTHROPIC_API_KEY=...` and restart the backend.
3. Check <http://localhost:8000/api/health>: `"ai_configured": true`.

Without a key the application works, but documents cannot be analyzed, and the screens say so plainly. The key is never sent to the browser and never logged.

## 11. API documentation

The full, interactive reference is generated from the code: run the backend and open **<http://localhost:8000/api/docs>** (Swagger UI). To try protected endpoints there, call `POST /api/v1/auth/login`, copy the returned `access_token`, press **Authorize** and paste it.

Summary (all under `/api/v1`, except health):

| Group | Endpoints |
|---|---|
| Health | `GET /api/health` |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Users | `PATCH /users/me`, `POST /users/me/password` |
| Dashboard | `GET /dashboard` |
| Projects | `GET/POST /projects`, `GET/PATCH/DELETE /projects/{id}`, `GET /projects/{id}/activity` |
| Members | `GET/POST /projects/{id}/members`, `PATCH/DELETE /projects/{id}/members/{memberId}` |
| Documents | `GET/POST /projects/{id}/documents`, `GET …/{docId}/text`, `GET …/{docId}/download`, `DELETE …/{docId}` |
| AI | `GET /ai/status`, `POST /projects/{id}/documents/{docId}/analyze`, `GET /projects/{id}/analysis-runs` |
| Knowledge | `GET /projects/{id}/knowledge`, `PATCH/DELETE …/knowledge/{itemId}`, `POST …/knowledge/apply` |
| Handover | `GET/POST /projects/{id}/handover`, `PUT …/handover/sections/{type}`, `POST …/handover/submit-review\|complete\|reopen\|acknowledge` |
| Reports | `GET/POST /projects/{id}/reports`, `GET …/reports/{id}`, `GET …/reports/{id}/export?format=pdf\|md` |

Errors always look like `{"error": {"code": "...", "message": "...", "details": [...]}}`.

## 12. Testing

```powershell
# Backend (in backend\, virtual environment active)
python -m pip install -r requirements-dev.txt
python -m pytest

# Against PostgreSQL: use an EMPTY, disposable database. The tests delete every row in it.
$env:TEST_DATABASE_URL = "postgresql://USER:PASSWORD@localhost:5432/handoveriq_test"
python -m pytest

# Frontend (in frontend\)
npm run check        # lint + type check + unit tests
npm run build        # needs NEXT_PUBLIC_API_BASE_URL (set in .env.local)
```

The backend tests use a throwaway database and never touch your data. The AI tests run the real Anthropic SDK against a fake HTTP server, so no key or network is needed.

## 13. Deployment

**You choose when to deploy.** Nothing here deploys anything by itself.

### a) Database: Neon (or any PostgreSQL)

Create a project and copy the connection string (it ends in `?sslmode=require`).

### b) Backend: Render

1. New → **Web Service** (or **Blueprint** using `render.yaml`), connect the repository, root directory `backend`.
2. Build command `pip install -r requirements.txt`. Start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"`.
3. Environment: `ENVIRONMENT=production`, `DATABASE_URL`, `SECRET_KEY` (random, 32+ characters), `FRONTEND_ORIGINS=https://YOUR-SITE.netlify.app`, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`, `ANTHROPIC_API_KEY`, and `PYTHON_VERSION` (a full 3.12.x version).
4. Keep **one instance** (migrations run at startup). Free instances sleep when idle, so the first request after a pause is slow.
5. Open `https://YOUR-BACKEND/api/health` and confirm `"database":"ok"`.

### c) Frontend: Netlify

1. New site from Git; `netlify.toml` already holds the settings (base `frontend`).
2. **Before the first deploy** set `NEXT_PUBLIC_API_BASE_URL=https://YOUR-BACKEND.onrender.com`. The build stops with a clear message if it is missing.
3. Deploy, then add the Netlify address to `FRONTEND_ORIGINS` on the backend.

### d) Important: cookies across sites

Signing in relies on a session cookie. A website on `netlify.app` calling an API on `onrender.com` is a *cross-site* setup. It works with `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true`, but some browsers (Safari by default, and others when third-party cookies are blocked) refuse such cookies. For a production-grade setup put both under one domain you own (for example `app.example.com` and `api.example.com`) and use `COOKIE_SAMESITE=lax`. This deployment guidance has not been exercised against live Netlify and Render accounts.

## 14. Security

What is implemented:

- **Passwords:** Argon2id hashing, minimum length, a block-list of very common passwords, identical error for unknown e-mail and wrong password (and equal timing), failed-attempt throttling.
- **Sessions:** signed token in an HttpOnly, Secure (in production) cookie; changing the password signs out every other session.
- **CSRF:** state-changing requests must carry a custom header, which other websites cannot send cross-origin without passing CORS.
- **Authorization:** every project route checks the caller's role; outsiders get "not found". Tested route by route.
- **Uploads:** type allow-list, size limit, real content check (a renamed file is rejected), safe file names, de-duplication, DOCX "zip bomb" guard, files only served through permission checks with `nosniff`.
- **AI:** documents are treated as untrusted data (prompt-injection guard), output is schema-constrained, quotes are verified, and API errors are reported, never hidden.
- **Transport and headers:** CORS allow-list, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, a strict CSP on the API, HSTS in production.
- **Safe errors:** unexpected failures return a generic message; details go to the server log only.
- **Production guard:** the server refuses to start with a weak `SECRET_KEY`, SQLite, or insecure cookies.

Known limitations (please read):

- **E-mail addresses are not verified.** Someone who registers with an address that was added to a project gets that access. Do not rely on membership by e-mail for highly sensitive material until verification exists.
- The sign-in throttle is **in memory, per server process**; behind several instances use a shared store.
- Sessions cannot be revoked individually before they expire (a password change revokes all).
- HandoverIQ **does not send e-mails** (no invitations, no password reset yet).
- Scanned documents and images need OCR, which is **not supported**.

## 15. Future enhancements

E-mail verification, invitations and password reset; OCR for scanned documents; chunked analysis for very long documents; comments on handover sections; Word export; shared rate limiting (Redis); object storage for very large files; audit-log export; dark theme.

## 16. License

Released under the [MIT License](LICENSE). Copyright (c) 2026 Ashwini U.
