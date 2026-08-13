from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ROLE_CAN_ADVANCE, STATE_ORDER, Role, TaskState
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate


async def list_tasks(db: AsyncSession) -> list[Task]:
    result = await db.execute(select(Task).order_by(Task.id))
    return list(result.scalars().all())


async def get_task_or_404(db: AsyncSession, task_id: int) -> Task:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


async def create_task(db: AsyncSession, payload: TaskCreate) -> Task:
    task = Task(
        title=payload.title.strip(),
        description=payload.description.strip(),
        assigned_role=payload.assigned_role,
        state=payload.state,
        created_at=date.today(),
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


def _assert_can_change_state(current_user: User, task: Task, new_state: TaskState) -> None:
    """Mirrors ROLE_CONFIG.canAdvance — server-side re-enforcement of the UX-only frontend gate."""
    if current_user.role == Role.ADMIN:
        return  # Admin: free movement across all columns

    allowed_sources = ROLE_CAN_ADVANCE.get(current_user.role, set())
    if task.state not in allowed_sources:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail=f"Role {current_user.role.value} cannot advance from state {task.state.value}",
        )

    current_index = STATE_ORDER.index(task.state)
    next_index = current_index + 1
    if next_index >= len(STATE_ORDER) or new_state != STATE_ORDER[next_index]:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Non-admin roles may only advance to the next pipeline stage",
        )


async def update_task(
    db: AsyncSession, task_id: int, payload: TaskUpdate, current_user: User
) -> Task:
    task = await get_task_or_404(db, task_id)
    updates = payload.model_dump(exclude_unset=True, by_alias=False)

    if "state" in updates and updates["state"] != task.state:
        _assert_can_change_state(current_user, task, updates["state"])

    for field, value in updates.items():
        if field in ("title", "description") and isinstance(value, str):
            value = value.strip()
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return task


async def delete_task(db: AsyncSession, task_id: int, current_user: User) -> None:
    if current_user.role != Role.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only Admin may delete tasks")

    task = await get_task_or_404(db, task_id)
    await db.delete(task)
    await db.commit()
