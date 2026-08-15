# Base image: slim Python 3.12, matches pyproject.toml's requires-python >=3.12
FROM python:3.12-slim

# Install uv by copying its static binary from the official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# All later relative paths (../specs, ../frontend, alembic.ini) resolve against this
WORKDIR /app/backend

# Copy only the dependency manifests first — deps layer stays cached until these change
COPY backend/pyproject.toml backend/uv.lock ./

# Install deps from the lockfile only (no project code yet) so this layer caches across code edits
RUN uv sync --frozen --no-install-project

# Copy the FastAPI app package (backend/app/main.py is the real app; backend/main.py is a stub, not needed)
COPY backend/app ./app

# Copy the seed script — reads Path(__file__).parent.parent / "specs" / "seed-data.json" at runtime
COPY backend/seed.py ./seed.py

# Copy Alembic migration scripts
COPY backend/alembic ./alembic

# Copy Alembic config — alembic upgrade head must run from this directory (backend/)
COPY backend/alembic.ini ./alembic.ini

# Copy specs/ one level up from WORKDIR (/app/specs) — seed.py resolves it via parent.parent
COPY specs ../specs

# Copy frontend/ one level up from WORKDIR (/app/frontend) — served by StaticFiles(directory="../frontend")
COPY frontend ../frontend

# Cloud Run injects PORT (defaults to 8080 locally if unset); uvicorn binds to it below
ENV PORT=8080

# Run migrations, seed the database, then start uvicorn bound to 0.0.0.0:$PORT — all via uv run so the venv resolves
CMD ["sh", "-c", "uv run alembic upgrade head && uv run python -m app.seed && uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
