import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from scalar_fastapi import get_scalar_api_reference

from app.api import apps, metrics
from app.database.import_database import ensure_database_seeded
from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Kick off seeding in the background so startup returns immediately.
    async def seed_db():
        print("Ensuring database is seeded in background...")
        await asyncio.to_thread(ensure_database_seeded)

    asyncio.create_task(seed_db())
    yield


tags_metadata = [
    {
        "name": "metrics",
        "description": "Endpoints for analyzing Node.js performance metrics (CPU, memory, GC, correlations, trends).",
    },
    {
        "name": "NodeJS Performance Analyser",
        "description": "Discovery and configuration endpoints for available Node.js apps and their defaults.",
    },
]

app = FastAPI(
    lifespan=lifespan,
    title="Node.js Performance Analyzer — Backend",
    description=(
        "Backend APIs to explore and analyze Node.js runtime performance data.\n\n"
        "Use the metrics endpoints to pull time series and summary stats for CPU, memory, and GC.\n"
        "Start by discovering available apps via /api/apps, then query /api/metrics with the app name."
    ),
    version="0.1.0",
    openapi_tags=tags_metadata,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"Hello": "World"}


app.include_router(metrics.router, prefix="/api")
app.include_router(apps.router, prefix="/api")
 

@app.get("/scalar", include_in_schema=False)
async def scalar_html():
    return get_scalar_api_reference(
   
        openapi_url=app.openapi_url,
        scalar_proxy_url="https://proxy.scalar.com",
    )
