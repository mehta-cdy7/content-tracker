"""Seed the database with sample tasks and a default admin user.

Run with: uv run python -m app.seed
"""

import asyncio
import json
from datetime import date
from pathlib import Path

from sqlalchemy import select

from app.core.security import hash_password
from app.db import AsyncSessionLocal
from app.models.enums import Role
from app.models.task import Task
from app.models.user import User

SEED_DATA_PATH = Path(__file__).resolve().parent.parent.parent / "specs" / "seed-data.json"

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "changeme123"  # noqa: S105 — dev-only seed credential


async def seed_tasks(session) -> None:
    existing = (await session.execute(select(Task.id))).first()
    if existing is not None:
        print("Tasks already seeded, skipping.")
        return

    raw = json.loads(SEED_DATA_PATH.read_text())
    for row in raw:
        session.add(
            Task(
                id=row["id"],
                title=row["title"],
                description=row["description"],
                assigned_role=Role(row["assigned_role"]),
                state=row["state"],
                created_at=date.fromisoformat(row["created_at"]),
            )
        )
    print(f"Seeded {len(raw)} tasks.")


async def seed_admin(session) -> None:
    existing = (
        await session.execute(select(User).where(User.username == DEFAULT_ADMIN_USERNAME))
    ).scalar_one_or_none()
    if existing is not None:
        print("Admin user already exists, skipping.")
        return

    session.add(
        User(
            username=DEFAULT_ADMIN_USERNAME,
            hashed_password=hash_password(DEFAULT_ADMIN_PASSWORD),
            role=Role.ADMIN,
        )
    )
    print(f"Seeded admin user '{DEFAULT_ADMIN_USERNAME}' (password: {DEFAULT_ADMIN_PASSWORD}).")


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await seed_tasks(session)
        await seed_admin(session)
        await session.commit()


if __name__ == "__main__":
    asyncio.run(main())
