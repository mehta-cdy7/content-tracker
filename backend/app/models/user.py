from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.enums import Role


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(
        Enum(Role, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
