from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import auth, tasks

settings = get_settings()

app = FastAPI(title="Telusko Workflow Engine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router)
app.include_router(auth.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
