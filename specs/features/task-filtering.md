
# Feature: Task filtering on GET /api/tasks
 
## What it does
Adds query parameter support to GET /api/tasks so the frontend can
request a filtered subset of tasks instead of always getting all of them.
 
## Why we need it
As the project grows, returning every task on every page load will
become slow. Filtering by state and assigned_role lets the frontend
fetch only what it needs for the current view.
 
## Behaviour
 
### GET /api/tasks (no params) — unchanged
Returns all tasks. Existing behaviour preserved exactly.
 
### GET /api/tasks?state=editing
Returns tasks where state == "editing".
Invalid state values → 400 with body: {"detail": "invalid state: <value>"}
 
### GET /api/tasks?assigned_role=video_editor
Returns tasks where assigned_role == "video_editor".
Invalid role values → 400 with body: {"detail": "invalid role: <value>"}
 
### GET /api/tasks?state=editing&assigned_role=video_editor
Both filters applied (AND).
 
## Acceptance criteria
- Existing GET /api/tasks calls continue to return all tasks
- Invalid state or role returns 400 with a clear error message
- Valid filter returns 200 with the filtered list (empty array allowed)
- Per-task response shape is unchanged — frontend code does NOT update
- The route remains in backend/app/api/v1/tasks.py
 
## Out of scope
- Pagination (separate spec)
- Sorting (separate spec)
- Date range filtering (separate spec)
 
## Smoke test (all must pass)
curl -s "http://localhost:8000/api/tasks?state=editing" | python -m json.tool
curl -s "http://localhost:8000/api/tasks?state=invalid" -w "\nStatus: %{http_code}\n"
curl -s "http://localhost:8000/api/tasks?assigned_role=video_editor" | python -m json.tool
curl -s "http://localhost:8000/api/tasks" | python -m json.tool   # must still return all