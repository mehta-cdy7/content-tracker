
# Codecast Workflow Engine — Security Specification
 
## Scope
Defines the authentication and authorisation system for the
Codecast Workflow Engine backend. Replaces existing UX-only role
checks with real server-side security.
 
## What we are building
 
### Authentication
- Username + password login via POST /api/auth/login
- Passwords hashed with bcrypt (passlib library)
- Successful login returns a signed JWT (HS256, python-jose library)
- JWT payload: sub (username), role, exp (expiry timestamp)
- Access token expiry: 60 minutes
 
### Authorisation (RBAC)
- Every /api/tasks endpoint now requires a valid Bearer token
- Unauthorised requests return 401
- Authenticated but unauthorised requests return 403
 
## Tech stack
- FastAPI OAuth2PasswordBearer for the bearer token scheme
- python-jose[cryptography] for JWT encode/decode
- passlib[bcrypt] for password hashing
- python-multipart for OAuth2PasswordRequestForm
- Existing SQLAlchemy 2.0 async + SQLite
 
## New files to create
 
### backend/app/models/user.py
SQLAlchemy User model with columns:
- id (int, primary key)
- username (str, unique, indexed, max 50 chars)
- password_hash (str, not null)
- role (Enum: admin, content_team, video_editor, uploader)
- created_at (datetime, default utc now)
 
### backend/app/schemas/user.py
Pydantic v2 schemas:
- UserCreate (username, password, role) — for admin user creation
- UserResponse (id, username, role, created_at) — no password field
 
### backend/app/schemas/auth.py
Pydantic v2 schemas:
- Token (access_token: str, token_type: str defaulting to 'bearer')
- TokenData (username: str, role: str)
 
### backend/app/security/password.py
Functions:
- hash_password(plain: str) -> str
- verify_password(plain: str, hashed: str) -> bool
Both use CryptContext(schemes=['bcrypt'], deprecated='auto')
 
### backend/app/security/jwt.py
Functions:
- create_access_token(data: dict, expires_delta: timedelta) -> str
- decode_access_token(token: str) -> TokenData
Constants: SECRET_KEY from .env, ALGORITHM = 'HS256'
Raise 401 HTTPException if token is invalid or expired
 
### backend/app/security/dependencies.py
FastAPI dependencies:
- get_current_user(token = Depends(oauth2_scheme)) -> User
  Decode JWT, look up user in DB, raise 401 if any step fails
- require_role(*allowed_roles) -> callable
  Returns a dependency that checks current_user.role
  Raises 403 if role not in allowed_roles
 
### backend/app/api/v1/auth.py
Endpoints:
- POST /api/auth/login
  Accepts: OAuth2PasswordRequestForm
  Returns: Token on success, 401 on bad credentials
- POST /api/auth/users (admin only)
  Accepts: UserCreate
  Creates user with hashed password
  Requires: Depends(require_role('admin'))
- GET /api/auth/me
  Returns: UserResponse for the current user
  Requires: Depends(get_current_user)
 
## Files to modify
 
### backend/app/api/v1/tasks.py
Add auth dependencies to each existing endpoint:
- GET /api/tasks: Depends(get_current_user) — any authenticated role
- POST /api/tasks: Depends(require_role('admin', 'content_team'))
- PUT /api/tasks/{id}: Depends(get_current_user) + state-advance check
  The RBAC advance rules (from CLAUDE.md and app.js ROLE_CONFIG):
    admin: can advance from any state
    content_team: only from code_ready
    video_editor: from recorded or editing
    uploader: only from uploaded
  If role not allowed: 403 {'detail': 'role X cannot advance from state Y'}
- DELETE /api/tasks/{id}: Depends(require_role('admin'))
 
### backend/app/main.py
- Include the auth router at prefix /api/auth
- Update CORS allow_headers to include 'Authorization'
 
### backend/pyproject.toml
- Add: passlib[bcrypt]
- Add: python-multipart
 
## Database
 
### Alembic migration
Generate and apply a new migration for the users table.
 
### Seed data — five users
Update backend/seed.py to add these users (idempotent — check before insert):
- username: admin, password: admin123, role: admin
- username: content, password: content123, role: content_team
- username: editor, password: editor123, role: video_editor
- username: uploader, password: uploader123, role: uploader
- username: demo, password: demo123, role: video_editor
Hash all passwords with hash_password() before storing.
These are demo credentials only. Production must use stronger passwords.


 
## Frontend changes
This spec EXPLICITLY OVERRIDES the CLAUDE.md no-frontend rule.
The following frontend changes are required and authorised:
 
### frontend/app.js
- Remove the role dropdown logic entirely
- Add a login form that appears when localStorage has no 'codecast_token'
- On successful login: store the token in localStorage as 'codecast_token'
- In apiFetch: add Authorization: Bearer <token> header to every request
  Read the token from localStorage.getItem('codecast_token')
- On any 401 response: clear the token, show login form
- Add a logout button that clears localStorage and shows login form
 
### frontend/index.html
- Add a hidden login modal div at the top of <body>
- Add a logout button in the header
 
### frontend/styles.css
- Style the login form and logout button to match the existing Kanban UI
 
## Acceptance criteria
- Unauthenticated GET /api/tasks returns 401
- Login with correct credentials returns 200 with a JWT
- Login with wrong credentials returns 401
- JWT payload contains sub, role, exp
- An expired token returns 401
- A tampered token returns 401
- Content team can create tasks (POST returns 201)
- Uploader cannot create tasks (POST returns 403)
- Admin can delete tasks (DELETE returns 204)
- Uploader cannot delete tasks (DELETE returns 403)
- Video editor cannot advance a code_ready task (PUT returns 403)
- Video editor CAN advance an editing task (PUT returns 200)
- Frontend shows login form on first load
- After login the board renders with real data
- Logout clears token and returns to login form
 
## Out of scope
- Refresh tokens (separate spec)
- Password reset flow (separate spec)
- Email verification (separate spec)
- Account lockout after failed logins (separate spec)
- HTTPS termination 
 
## Smoke tests (all must pass)
# 1. Unauthenticated request blocked
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/tasks
# Expected: 401
 
# 2. Login as admin, capture token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -d 'username=admin&password=admin123' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "Got token: ${TOKEN:0:20}..."
 
# 3. Authenticated request works
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/tasks | python -m json.tool
# Expected: 200 with task array
 
# 4. Uploader cannot delete (403)
UTOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -d 'username=uploader&password=uploader123' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  -H "Authorization: Bearer $UTOKEN" \
  http://localhost:8000/api/tasks/1
# Expected: 403
 
# 5. Bad credentials (401)
curl -s -o /dev/null -w "%{http_code}" -X POST \
  http://localhost:8000/api/auth/login \
  -d 'username=admin&password=wrong' \
  -H 'Content-Type: application/x-www-form-urlencoded'
# Expected: 401