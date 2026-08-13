from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Role, TaskState


class TaskCreate(BaseModel):
    """Body for POST /api/tasks. id/createdAt are server-assigned."""

    title: str = Field(min_length=1)
    description: str = ""
    assigned_role: Role = Field(alias="assignedRole")
    state: TaskState = TaskState.CODE_READY

    model_config = ConfigDict(populate_by_name=True)


class TaskUpdate(BaseModel):
    """Body for PUT /api/tasks/{id} — every field optional, partial update."""

    title: str | None = None
    description: str | None = None
    assigned_role: Role | None = Field(default=None, alias="assignedRole")
    state: TaskState | None = None

    model_config = ConfigDict(populate_by_name=True)


class TaskResponse(BaseModel):
    id: int
    title: str
    description: str
    assigned_role: Role = Field(alias="assignedRole", serialization_alias="assignedRole")
    state: TaskState
    created_at: date = Field(alias="createdAt", serialization_alias="createdAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
