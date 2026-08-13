"""Seed the tasks table from specs/seed-data.json.

Idempotent: checks each row's id before inserting, so re-running
does not create duplicates.

Run with: uv run python seed.py
"""

import asyncio
import json
from datetime import date
from pathlib import Path

from app.db import AsyncSessionLocal
from app.models.task import Task

SEED_DATA_PATH = Path(__file__).resolve().parent.parent / "specs" / "seed-data.json"


async def seed_tasks() -> None:
    raw = json.loads(SEED_DATA_PATH.read_text())

    async with AsyncSessionLocal() as session:
        inserted = 0
        skipped = 0
        for row in raw:
            existing = await session.get(Task, row["id"])
            if existing is not None:
                skipped += 1
                continue

            session.add(
                Task(
                    id=row["id"],
                    title=row["title"],
                    description=row["description"],
                    assigned_role=row["assigned_role"],
                    state=row["state"],
                    created_at=date.fromisoformat(row["created_at"]),
                )
            )
            inserted += 1

        await session.commit()

    print(f"Seeded {inserted} tasks, skipped {skipped} existing.")


if __name__ == "__main__":
    asyncio.run(seed_tasks())
