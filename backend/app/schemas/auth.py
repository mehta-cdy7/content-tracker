from pydantic import BaseModel, Field

from app.models.enums import Role


class TokenResponse(BaseModel):
    access_token: str = Field(serialization_alias="access_token")
    token_type: str = "bearer"


class UserCreate(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=8)
    role: Role


class UserOut(BaseModel):
    id: int
    username: str
    role: Role

    model_config = {"from_attributes": True}
