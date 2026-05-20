from typing import List, Optional

from fastapi import APIRouter, Query
from app.core.constants import DEFAULT_LIMIT, DEFAULT_PAGE
from app.schemas.pagination import PaginatedResponse

from app.core.dependency import AppsServiceDep
from app.schemas.apps import AppSummary
from app.schemas.configs import AppConfigsResponse

router = APIRouter(
    prefix="/apps",
    tags=["NodeJS Performance Analyser"],
)

@router.get(
    "/",
    response_model=PaginatedResponse[AppSummary],
    summary="List available applications",
    description="Returns distinct application names with lightweight health and activity stats.",
)
async def get_apps(
    service: AppsServiceDep,
    page: int = Query(DEFAULT_PAGE, ge=1, description="Page number (1-based)"),
    limit: int = Query(DEFAULT_LIMIT, ge=1, description="Items per page"),
):
    offset = (page - 1) * limit
    items, has_next = await service.get_apps(limit=limit, offset=offset)
    return PaginatedResponse[AppSummary](page=page, per_page=limit, items=items, has_next=has_next)

@router.get(
    "/configs",
    response_model=AppConfigsResponse,
    summary="App configuration and ranges",
    description=(
        "Returns helper metadata for the given app (or a default), including available GC types, time range, run statuses, heap capacity bins,"
        " a summary of CPU activity, and recent run IDs."
    ),
)
async def get_app_configs(service: AppsServiceDep, app_name: Optional[str] = None):
    data = await service.get_configs(app_name=app_name)
    return AppConfigsResponse(**data)
