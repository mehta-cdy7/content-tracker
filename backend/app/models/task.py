from datetime import date

from sqlalchemy import Date, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.enums import Role, TaskState


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    assigned_role: Mapped[Role] = mapped_column(
        Enum(Role, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
    state: Mapped[TaskState] = mapped_column(
        Enum(TaskState, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        default=TaskState.CODE_READY,
        nullable=False,
    )
    created_at: Mapped[date] = mapped_column(Date, nullable=False)
