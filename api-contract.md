# API Contract — Codecast Workflow Engine

Derived from `frontend/app.js` (the mock API layer: `mockFetch`, `api.getTasks/createTask/updateTask/deleteTask`). This is the contract the FastAPI backend must satisfy for the frontend to work unmodified — **frontend/app.js is not to be changed**, so field names, routes, and shapes below are fixed by the client, not negotiable.

## Base URL

```
http://localhost:8000
```

Hardcoded in `mockFetch()` (`frontend/app.js:88`). All endpoints are prefixed with `/api`.

## Data Model — `Task`

The wire shape the frontend reads and writes (see mock `tasks` array, `frontend/app.js:29-70`, and `handleFormSubmit`, `frontend/app.js:426-431`):

```ts
{
  id: number,
  title: string,
  assignedRole: "Admin" | "Content" | "Editor" | "Uploader",
  state: "code_ready" | "recorded" | "editing" | "uploaded" | "published",
  description: string,
  createdAt: string   // "YYYY-MM-DD"
}
```

Note the JSON keys are **camelCase** (`assignedRole`, `createdAt`) even though the field names in the Python model/schema layer should stay `snake_case` per project convention. Use Pydantic v2 `alias_generator` (e.g. `to_camel`) with `populate_by_name=True` / `ConfigDict(alias_generator=to_camel, populate_by_name=True)` so the backend stays snake_case internally while serializing/accepting camelCase over the wire.

### `state` enum
Fixed 5-stage pipeline (`STATES`, `frontend/app.js:7-13`), order matters (advancement walks this list):
1. `code_ready`
2. `recorded`
3. `editing`
4. `uploaded`
5. `published`

### `assignedRole` enum
`ROLE_CONFIG` (`frontend/app.js:18-23`): `Admin`, `Content`, `Editor`, `Uploader`.

## Endpoints

All calls go through `mockFetch(url, options)` → `fetch(`http://localhost:8000${url}`, options)`. Every call expects a JSON body (when relevant) and inspects `response.ok` / `response.status`; on non-2xx the frontend throws `Error("Server error ${status}")` and surfaces it via a toast. No response envelope — bare JSON.

### `GET /api/tasks`
- Used by: `api.getTasks()` (`frontend/app.js:100-109`)
- Request body: none
- Success: `200`, JSON array of `Task`
- On any error (non-2xx or network failure): frontend catches, shows an error toast, and **falls back to its local in-memory mock data** — so a broken `GET` degrades gracefully but silently masks backend failures from a user's perspective beyond the toast.
- Response shape: `Task[]`

### `POST /api/tasks`
- Used by: `api.createTask(payload)` (`frontend/app.js:111-119`), called from `handleFormSubmit` (add mode)
- Headers: `Content-Type: application/json`
- Request body:
  ```json
  {
    "title": "string (required, non-empty, trimmed client-side)",
    "description": "string",
    "assignedRole": "Admin | Content | Editor | Uploader",
    "state": "code_ready | recorded | editing | uploaded | published"
  }
  ```
  Note: no `id` or `createdAt` sent — backend must generate both.
- Success: expected `2xx` with the created `Task` (including server-generated `id`, `createdAt`) as JSON body.
- Error: any non-2xx → frontend throws and shows `Save failed: ...` toast; **not caught internally**, so the backend contract must return a real HTTP status (not just an error field) for the frontend to detect failure.

### `PUT /api/tasks/{id}`
- Used by: `api.updateTask(id, updates)` (`frontend/app.js:121-129`), called from:
  - `handleFormSubmit` (edit mode) — full payload `{ title, description, assignedRole, state }`
  - `advanceTask()` (`frontend/app.js:331-354`) — partial payload `{ state: nextKey }`
  - drag-and-drop drop handler (`frontend/app.js:228-251`) — partial payload `{ state: state.key }`
- Headers: `Content-Type: application/json`
- Request body: **partial or full** `Task` fields (backend should treat this as a partial update / PATCH-like semantics despite the `PUT` verb — the frontend never sends the full object on drag/advance, only `{ state }`)
- Success: expected `2xx` with the updated `Task` as JSON body.
- Error: non-2xx → thrown, surfaced via toast (`Could not advance task`, `Could not move task`, or `Save failed`, depending on caller).

### `GET /api/tasks/by-role/{role}`
- Added: 2026-08-13, not yet consumed by frontend/app.js — backend-only scaffold pending frontend wiring.
- Path param: `role` — one of `Admin | Content | Editor | Uploader` (validated against the `Role` enum; invalid value → `422`)
- Request body: none
- Success: `200`, JSON array of `Task`, filtered to `assignedRole == role`, ordered by `id`
- No auth enforced (matches `GET /api/tasks`)
- Response shape: `Task[]`

### `DELETE /api/tasks/{id}`
- Used by: `api.deleteTask(id)` (`frontend/app.js:131-135`), called from `deleteTask()` (`frontend/app.js:356-374`)
- Request body: none
- Success: expected `2xx` (body ignored — frontend just returns `true`)
- Error: non-2xx → thrown, surfaced via `Could not delete task: ...` toast
- Note: frontend enforces "Admin only" client-side before calling this — **not enforced server-side today**, so the backend should independently authorize this (and ideally every mutating endpoint) rather than trust the client.

## Client-Side Behaviors the Backend Should Be Aware Of

- **No auth/session is sent today** — no `Authorization` header, no cookies, no role/user identity on any request. `currentRole` is purely a client-side UI variable. Any real role-based enforcement must be added server-side (JWT via python-jose per project stack) independent of what the frontend currently transmits.
- **Optimistic full reload**: every mutating call (`create`, `update`, `delete`) is followed by `renderBoard()`, which re-fetches the entire task list via `GET /api/tasks`. There is no incremental/local state patching, so `GET /api/tasks` must reflect writes immediately (read-your-writes consistency, no eventual consistency / caching lag).
- **No pagination, filtering, or query params** are ever sent to `GET /api/tasks` — it must return the full task set every time.
- **`id` type**: frontend treats `task.id` as a JS `number` (compared with `===`, parsed via `parseInt` from `dataset.editId`). Backend should return integer (not UUID string) ids, or the frontend's `taskId` comparisons (`t.id === taskId`) and `parseInt(form.dataset.editId, 10)` will break.
- **Error body is not parsed for a message** — `mockFetch` only reads JSON when `content-type` includes `application/json`, and none of the `api.*` methods read an error message out of the body; they only use `response.status` in the thrown `Error`. A backend returning a rich error payload (e.g. FastAPI's default `{"detail": "..."}`) gets that detail silently discarded by the current frontend — status code is the only signal that reaches the user.

## Suggested FastAPI Schema Sketch

```python
# schemas/task.py
from datetime import date
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from enum import Enum

class TaskState(str, Enum):
    code_ready = "code_ready"
    recorded = "recorded"
    editing = "editing"
    uploaded = "uploaded"
    published = "published"

class AssignedRole(str, Enum):
    admin = "Admin"
    content = "Content"
    editor = "Editor"
    uploader = "Uploader"

class TaskBase(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    title: str
    description: str
    assigned_role: AssignedRole
    state: TaskState

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    title: str | None = None
    description: str | None = None
    assigned_role: AssignedRole | None = None
    state: TaskState | None = None

class TaskRead(TaskBase):
    id: int
    created_at: date
```

Routes (`routers/tasks.py`) should stay thin and delegate to a service layer (`services/task_service.py`) per project convention — no business logic (state-transition validation, role authorization) inline in the route handlers.
