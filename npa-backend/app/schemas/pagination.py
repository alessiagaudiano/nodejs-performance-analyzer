from typing import Generic, List, TypeVar

from pydantic import BaseModel


T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    page: int
    per_page: int
    has_next: bool
    items: List[T]
