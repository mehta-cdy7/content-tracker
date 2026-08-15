# ⚡ Codecast Workflow Engine

A modern, full-stack video production content tracker and Kanban pipeline engine built with **FastAPI**, **SQLAlchemy 2.0 Async**, **Alembic**, and a sleek **Vanilla JavaScript & CSS** frontend.

![Codecast Workflow Engine](updated-design.png)

---

## ✨ Features

- **🎬 5-Stage Video Pipeline**:
  1. `code_ready` — Code & Examples Ready
  2. `recorded` — Recorded
  3. `editing` — Editing in Progress
  4. `uploaded` — Uploaded (Pending Verification)
  5. `published` — Verified & Published

- **🔐 Role-Based Access Control (RBAC)**:
  - **Admin**: Full access across all columns, drag-and-drop cards freely, edit/delete tasks.
  - **Content Team**: Advance tasks from `code_ready` stage.
  - **Video Editor**: Advance tasks from `recorded` and `editing` stages.
  - **Uploader**: Advance tasks from `uploaded` stage.

- **🛡️ Secure JWT Authentication**:
  - OAuth2 Bearer token authentication.
  - Password hashing using `bcrypt`.
  - Glassmorphic login modal with show/hide password toggle.

- **🎨 Ultra-Premium Dark Theme**:
  - Responsive Kanban layout with drag-and-drop support.
  - Ambient glowing background mesh and toast notification system.
  - Real-time pipeline stats counter (`Total`, `Published`, `Active`, `Backlog`).

- **🐳 Docker & Cloud Deployment Ready**:
  - Pre-configured `Dockerfile`, `.dockerignore`, and `.gcpignore`.
  - Automated database migrations and seeding on container startup.
  - Ready for **Google Cloud Run** and **GCP Artifact Registry**.

---

## 📁 Project Structure

```
content-tracker-new/
├── backend/
│   ├── alembic/              # Database migration scripts
│   ├── app/
│   │   ├── core/             # Security, JWT, and settings config
│   │   ├── models/           # SQLAlchemy 2.0 async models (Task, User, Enums)
│   │   ├── routers/          # FastAPI routers (/api/tasks, /api/auth)
│   │   ├── schemas/          # Pydantic v2 schemas
│   │   ├── services/         # Business logic and RBAC checks
│   │   ├── db.py             # Database engine & session generator
│   │   ├── main.py           # FastAPI entry point & static file mount
│   │   └── seed.py           # Database seeder (Tasks + Users)
│   ├── alembic.ini           # Alembic config
│   ├── pyproject.toml        # Dependencies and metadata (uv package manager)
│   └── seed.py               # Standalone runner for database seeding
├── frontend/
│   ├── index.html            # Main HTML layout & login modal
│   ├── app.js                # Frontend API wrapper, Kanban DOM engine & events
│   └── styles.css            # Dark glassmorphic design system
├── specs/                    # Project specs and sample seed data
├── Dockerfile                # Multi-stage production container build
├── .dockerignore             # Excluded files for Docker build context
├── .gcpignore                # Excluded files for Google Cloud Build
└── README.md                 # Project documentation
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- [Python 3.12+](https://www.python.org/downloads/)
- [uv](https://github.com/astral-sh/uv) (recommended) or `pip`

### 1. Install Dependencies & Seed Database

```bash
cd backend

# Install dependencies with uv
uv sync

# Run database migrations
uv run alembic upgrade head

# Seed initial tasks and default user accounts
uv run python -m app.seed
```

### 2. Start Development Server

```bash
uv run uvicorn app.main:app --port 8000 --reload
```

Open your browser at **`http://localhost:8000`**.

---

## 🔑 Default User Accounts

When the database is seeded, the following demo accounts are created:

| Role | Username | Password | Permissions |
| :--- | :--- | :--- | :--- |
| 👑 **Admin** | `admin` | `admin123` | Full access (Drag cards, Delete, Edit, Create, Advance) |
| 📝 **Content Team** | `content` | `content123` | Advance from `Code & Examples Ready` |
| ✂️ **Video Editor** | `editor` | `editor123` | Advance from `Recorded` & `Editing in Progress` |
| ☁️ **Uploader** | `uploader` | `uploader123` | Advance from `Uploaded` |

---

## 🐳 Running with Docker

Build and run locally using Docker:

```bash
# 1. Build Docker image
docker build -t codecast-app .

# 2. Run container
docker run -p 8080:8080 \
  -e JWT_SECRET_KEY='local-secret-key' \
  -e JWT_ALGORITHM='HS256' \
  -e JWT_ACCESS_TOKEN_EXPIRE_MINUTES='60' \
  codecast-app
```

Access the app at **`http://localhost:8080`**.

---

## ☁️ Deployment to Google Cloud Run

### 1. Generate a Secure JWT Secret Token

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Build & Submit to GCP Artifact Registry

```bash
gcloud builds submit --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/YOUR_REPO/codecast-app:latest .
```

### 3. Deploy to Cloud Run

```bash
gcloud run deploy codecast-app \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/YOUR_REPO/codecast-app:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "JWT_SECRET_KEY=YOUR_GENERATED_SECRET,JWT_ALGORITHM=HS256,JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440"
```

---

## 📡 API Reference

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | No | Health check status |
| `POST` | `/api/auth/login` | No | Authenticate user & return JWT token |
| `GET` | `/api/auth/me` | Yes | Get current logged-in user profile |
| `GET` | `/api/tasks` | Yes | Fetch all tasks |
| `POST` | `/api/tasks` | Admin, Content | Create a new video task |
| `PUT` | `/api/tasks/{id}` | Role-based | Update task details or pipeline stage |
| `DELETE` | `/api/tasks/{id}` | Admin only | Delete a task |

---

## 📜 License

Distributed under the MIT License.
