from typing import Annotated

from fastapi import Depends

from app.database.session import get_session
from app.services.metrics_service import MetricsService
from app.services.apps_service import AppsService

async def get_metrics_service(
    client = Depends(get_session)
) -> MetricsService:
    return MetricsService(client)

MetricsServiceDep = Annotated[MetricsService, Depends(get_metrics_service)]


async def get_apps_service(
    client = Depends(get_session),
) -> AppsService:
    return AppsService(client)

AppsServiceDep = Annotated[AppsService, Depends(get_apps_service)]
