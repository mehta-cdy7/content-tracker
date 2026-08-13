from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import Role
from app.models.user import User
from app.schemas.auth import UserCreate


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def authenticate(db: AsyncSession, username: str, password: str) -> str:
    user = await get_user_by_username(db, username)
    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return create_access_token(subject=str(user.id), extra_claims={"role": user.role.value})


async def create_user(db: AsyncSession, payload: UserCreate, current_user: User) -> User:
    if current_user.role != Role.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin only")

    existing = await get_user_by_username(db, payload.username)
    if existing is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Username already exists")

    user = User(
        username=payload.username,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
