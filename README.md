# Event RSVP

An event RSVP website. Guests view the event details and submit their attendance, guest count and meal preference. Organizers see live attendance totals.

- **Web:** React + Vite (`artifacts/event-rsvp`)
- **API:** Express 5 (`artifacts/api-server`)
- **DB:** PostgreSQL + Drizzle ORM (`lib/db`)

## Prerequisites

- **Node.js 24**: `nvm install 24 && nvm use 24`
- **pnpm 10**: `corepack enable pnpm` (the version is pinned in `package.json`)
- **Docker Desktop**: runs the local Postgres database

## Start locally

```bash
# 1. Install dependencies
pnpm install

# 2. Create your env file
cp .env.example .env

# 3. Start Postgres (Docker Desktop must be running)
pnpm db:up

# 4. Create the database tables (first time, and after schema changes)
pnpm db:push

# 5. Start the API and the web app
pnpm dev
```

Then open **http://localhost:5173**.

| Service  | URL                          |
| -------- | ---------------------------- |
| Web app  | http://localhost:5173        |
| API      | http://localhost:8080/api    |
| Health   | http://localhost:8080/api/healthz |
| Postgres | `localhost:5432`, db `heliumdb` |

The web app forwards `/api` requests to the API server, so the browser only talks to port 5173.

Stop the app with `Ctrl+C`. Stop the database with `pnpm db:down`. Your data is kept in a Docker volume.

## Environment variables (`.env`)

| Variable       | Default                                                               | Used by           |
| -------------- | --------------------------------------------------------------------- | ----------------- |
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/heliumdb?sslmode=disable` | API, drizzle-kit  |
| `API_PORT`     | `8080`                                                                | API, Vite proxy   |
| `WEB_PORT`     | `5173`                                                                | Vite              |
| `BASE_PATH`    | `/`                                                                   | Vite              |
| `LOG_LEVEL`    | `info`                                                                | API               |

`.env` is gitignored. Add new variables to `.env.example` too.

> **Note:** On Replit the database host is `helium`. That hostname only resolves inside Replit, so it can't be reached from your machine. Locally, use the Docker database above (same credentials).

## Useful commands

| Command                                         | What it does                                 |
| ----------------------------------------------- | -------------------------------------------- |
| `pnpm dev`                                      | Start the API and the web app together       |
| `pnpm db:up` / `pnpm db:down`                   | Start / stop local Postgres                  |
| `pnpm db:push`                                  | Apply the Drizzle schema to the database     |
| `pnpm run typecheck`                            | Typecheck all packages                       |
| `pnpm run build`                                | Typecheck and build everything               |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks and Zod schemas from `lib/api-spec/openapi.yaml` |

Open a shell in the database:

```bash
docker compose exec db psql -U postgres -d heliumdb
```

## Troubleshooting

- **`Port 5173 is already in use` / `8080`**: another dev server is still running. Find it with `lsof -nP -iTCP:5173 -sTCP:LISTEN` and stop it.
- **`Cannot connect to the Docker daemon`**: start Docker Desktop, then run `pnpm db:up` again.
- **`relation "rsvps" does not exist`**: run `pnpm db:push`.
- **`ERR_PNPM_IGNORED_BUILDS`**: you're on a newer pnpm (for example 12). Run `corepack enable pnpm` so the pinned pnpm 10 is used.

## Project layout

```
artifacts/
  api-server/     Express API (routes in src/routes)
  event-rsvp/     React web app
  mockup-sandbox/ Replit UI mockup sandbox (not needed locally)
lib/
  db/             Drizzle schema + DB client
  api-spec/       OpenAPI spec + Orval codegen config
  api-zod/        Generated Zod schemas (server validation)
  api-client-react/ Generated React Query hooks (client)
```
