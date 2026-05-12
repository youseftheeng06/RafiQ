# Deploy RafiQ (Merged Frontend + Backend) — Render / Railway

The service is packaged as a **Docker image** (`Dockerfile` in the root directory). Production uses **`SPRING_PROFILES_ACTIVE=prod`**, **PostgreSQL** (not the local H2 file), and Hibernate `ddl-auto=update`. Existing Flyway migration SQL is oriented toward local H2, so migrations are **disabled in prod**.

The **static frontend** is located in `src/main/resources/static` and is automatically served by the Spring Boot backend at the root URL.

## Prerequisites

1. **PostgreSQL** instance (managed DB on Render or Railway, or any external Postgres).
2. **Environment variables** (see below).
3. **OAuth** providers: add authorized redirect URIs for your deployed API hostname, for example:

   - `https://YOUR-APP-HOST/login/oauth2/code/google`
   - `https://YOUR-APP-HOST/login/oauth2/code/github`

## Environment variables (`prod`)

| Variable | Purpose |
|----------|---------|
| `SPRING_PROFILES_ACTIVE` | Set to **`prod`** (Dockerfile sets this already). |
| `PORT` | Optional; Render sets this automatically for web services. |
| `DATABASE_URL` | **Postgres** URL from the platform, typically `postgres://user:password@host:port/dbname?...`. Parsed automatically into JDBC. Alternatively set `jdbc:postgresql://...` plus `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD`, or Railway-style `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`. |
| `RENDER_EXTERNAL_URL` | Set automatically by Render. Used for OAuth redirects. |
| `APP_FRONTEND_BASE_URL` | Optional; defaults to your backend URL (which now serves the frontend). Used for OAuth redirects and CORS/SockJS together with built-in patterns for Netlify/Vercel/Render/Railway. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth. |
| `SPRING_MAIL_USERNAME` / `SPRING_MAIL_PASSWORD` | Outbound email (registration / OTP). |
| `OPENROUTER_API_KEY` | AI features (optional if unused). |
| `ZEGOCLOUD_APP_ID` / `ZEGOCLOUD_SERVER_SECRET` | Video calls (optional). |

Health check path for load balancers: **`/actuator/health`**.

## Frontend (Integrated)

The frontend is served from the same origin as the API. It automatically detects the origin for API calls and WebSockets.

**Optional Override:** edit **`src/main/resources/static/JS/rafiq-deploy-config.js`** and assign an HTTPS API origin if you ever move the backend back to a separate host.

## Render (Docker + Postgres checklist)

1. **PostgreSQL** → New database.
2. **Web Service** → Deploy from repo → Runtime **Docker**:
   - **Dockerfile path:** `./Dockerfile`
   - **Docker context / root:** `.`
3. **Environment** tab on the Web Service → **Link** Postgres so **`DATABASE_URL`** is set.
4. Set **`GOOGLE_CLIENT_ID`**, **`GOOGLE_CLIENT_SECRET`**, **`GITHUB_CLIENT_ID`**, **`GITHUB_CLIENT_SECRET`**, mail credentials, optional AI/Zego keys.

Optional blueprint: **`render.yaml`** at the repo root.

## Railway (Docker + Postgres checklist)

1. New **Project** → deploy from Git.
2. **Backend service:** set **Root Directory** to `.` (Railway detects `Dockerfile` / `railway.toml`).
3. **Add PostgreSQL** → plug-in / database to the project; Railway provides **`DATABASE_URL`** and commonly **`PG*`** vars.
4. Add the **same env vars** as in the Render list (OAuth, mail, etc.).

## OAuth provider consoles

After your API hostname is stable (your Render `@onrender.com` URL or Railway public domain):

**Google Cloud Console → APIs & Credentials → OAuth 2.0 Client → Authorized redirect URIs**

- Add: `https://YOUR-API-HOST/login/oauth2/code/google`

**GitHub → Settings → Developer settings → OAuth Apps → Authorization callback URL**

- Set to: `https://YOUR-API-HOST/login/oauth2/code/github`

Use **HTTPS** exactly as on the deployed service (no trailing slash beyond the path Spring expects).

## Local Docker smoke test

```bash
docker build -t rafiq-api .
docker run --rm -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e DATABASE_URL="postgres://user:pass@host:5432/dbname" \
  -e APP_FRONTEND_BASE_URL="http://localhost:5500" \
  -e GOOGLE_CLIENT_ID="..." \
  -e GOOGLE_CLIENT_SECRET="..." \
  -e GITHUB_CLIENT_ID="..." \
  -e GITHUB_CLIENT_SECRET="..." \
  rafiq-api
```

Use a real Postgres reachable from the container (e.g. host IP instead of `localhost` on Docker Desktop).

## Security note

Prefer **secrets** on the provider dashboard over committing credentials. Rotate keys that ever appeared in plain text in Git history.
