"""Seed the database with sample tasks and default users (admin, content, editor, uploader).

Idempotent: checks existing records before inserting.

Run with: uv run python seed.py
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

SEED_DATA_PATH = Path(__file__).resolve().parent.parent / "specs" / "seed-data.json"

SEED_USERS: list[tuple[str, str, Role]] = [
    ("admin", "admin123", Role.ADMIN),
    ("content", "content123", Role.CONTENT),
    ("editor", "editor123", Role.EDITOR),
    ("uploader", "uploader123", Role.UPLOADER),
    ("demo", "demo123", Role.EDITOR),
]


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


async def seed_users(session) -> None:
    for username, password, role in SEED_USERS:
        existing = (
            await session.execute(select(User).where(User.username == username))
        ).scalar_one_or_none()
        if existing is not None:
            print(f"User '{username}' already exists, skipping.")
            continue

        session.add(
            User(
                username=username,
                hashed_password=hash_password(password),
                role=role,
            )
        )
        print(f"Seeded user '{username}' (role: {role.value}).")


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await seed_tasks(session)
        await seed_users(session)
        await session.commit()


if __name__ == "__main__":
    asyncio.run(main())
