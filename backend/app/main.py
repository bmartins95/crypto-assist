import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.routes import ops, exit_prices, prices, export_data, import_data

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

# redirect_slashes=False prevents 307 loops when using Mangum + Lambda Function URLs.
# Mangum strips the trailing slash before passing the path to FastAPI; with the default
# redirect_slashes=True, FastAPI would redirect /api/ops → /api/ops/ infinitely.
app = FastAPI(title="crypto-assist backend", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ops.router, prefix="/api/ops")
app.include_router(exit_prices.router, prefix="/api/exit-prices")
app.include_router(prices.router, prefix="/api/prices")
app.include_router(export_data.router, prefix="/api/export")
app.include_router(import_data.router, prefix="/api/import")


@app.get("/health")
def health():
    return {"ok": True}


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("→ %s %s", request.method, request.url.path)
    response = await call_next(request)
    logger.info("← %s %s %d", request.method, request.url.path, response.status_code)
    return response


# On Lambda cold start, run schema migrations (CREATE TABLE IF NOT EXISTS — idempotent).
# If Aurora is paused (0 ACU), get_conn() retries with connect_timeout until it wakes.
if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    logger.info(
        "Cold start: stage=%s pool=%s",
        os.environ.get("STAGE"),
        os.environ.get("COGNITO_USER_POOL_ID"),
    )
    from app.db.postgres_client import ensure_schema
    try:
        ensure_schema()
    except Exception as exc:
        logger.error("Cold start: schema migration failed — %s", exc)
        raise

handler = Mangum(app, lifespan="off")
