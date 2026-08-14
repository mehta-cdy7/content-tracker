from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db import get_db
from app.models.enums import Role
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if token is None:
        raise credentials_error

    payload = decode_access_token(token)
    if payload is None or "sub" not in payload:
        raise credentials_error

    result = await db.execute(select(User).where(User.username == payload["sub"]))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_error
    return user


def require_role(*allowed_roles: Role):
    """Dependency factory: 403 if current_user.role not in allowed_roles."""

    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail=f"Role {current_user.role.value} is not permitted for this action",
            )
        return current_user

    return _check
