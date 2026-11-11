from typing import Annotated
from uuid import UUID

from pydantic import StringConstraints

from app.models.enums import CategoryKind
from app.schemas.common import HexColor, RequestModel, ResponseModel

CategoryName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
IconName = Annotated[str, StringConstraints(pattern=r"^[a-z0-9-]{1,40}$")]


class Category(ResponseModel):
    id: UUID
    name: str
    kind: CategoryKind
    color: str
    icon: str
    is_archived: bool
    is_demo: bool
    transaction_count: int


class CategoryCreate(RequestModel):
    name: CategoryName
    kind: CategoryKind
    color: HexColor = "#64748b"
    icon: IconName = "circle"


class CategoryUpdate(RequestModel):
    name: CategoryName | None = None
    color: HexColor | None = None
    icon: IconName | None = None
    is_archived: bool | None = None
