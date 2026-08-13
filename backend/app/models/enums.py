import enum


class Role(str, enum.Enum):
    ADMIN = "Admin"
    CONTENT = "Content"
    EDITOR = "Editor"
    UPLOADER = "Uploader"


class TaskState(str, enum.Enum):
    CODE_READY = "code_ready"
    RECORDED = "recorded"
    EDITING = "editing"
    UPLOADED = "uploaded"
    PUBLISHED = "published"


# Pipeline order — must mirror frontend STATES in frontend/app.js. Index defines advancement.
STATE_ORDER: list[TaskState] = [
    TaskState.CODE_READY,
    TaskState.RECORDED,
    TaskState.EDITING,
    TaskState.UPLOADED,
    TaskState.PUBLISHED,
]

# Mirrors ROLE_CONFIG.canAdvance in frontend/app.js — stages each role may advance a task from.
ROLE_CAN_ADVANCE: dict[Role, set[TaskState]] = {
    Role.ADMIN: {
        TaskState.CODE_READY,
        TaskState.RECORDED,
        TaskState.EDITING,
        TaskState.UPLOADED,
    },
    Role.CONTENT: {TaskState.CODE_READY},
    Role.EDITOR: {TaskState.RECORDED, TaskState.EDITING},
    Role.UPLOADER: {TaskState.UPLOADED},
}
