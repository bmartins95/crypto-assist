import logging
import os

from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.config import get_settings
from app.db.postgres_client import get_conn
from app.routes import ops, exit_prices, prices, export_data, import_data, exchange_rates, price_history, coins, platforms, op_closures

# In Lambda the runtime pre-installs a root handler, so logging.basicConfig() is a
# no-op and our INFO logs would be dropped (root defaults to WARNING). Set the level
# explicitly on the root logger so application logs reach CloudWatch.
logging.getLogger().setLevel(logging.INFO)
logger = logging.getLogger(__name__)

# redirect_slashes=False prevents 307 loops when using Mangum + Lambda Function URLs.
# Mangum strips the trailing slash before passing the path to FastAPI; with the default
# redirect_slashes=True, FastAPI would redirect /api/ops → /api/ops/ infinitely.
app = FastAPI(title="crypto-assist backend", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().frontend_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ops.router, prefix="/api/ops")
app.include_router(op_closures.router, prefix="/api/ops")
app.include_router(op_closures.closures_router, prefix="/api/op-closures")
app.include_router(exit_prices.router, prefix="/api/exit-prices")
app.include_router(prices.router, prefix="/api/prices")
app.include_router(export_data.router, prefix="/api/export")
app.include_router(import_data.router, prefix="/api/import")
app.include_router(exchange_rates.router, prefix="/api/exchange-rates")
app.include_router(price_history.router, prefix="/api/prices/history")
app.include_router(coins.router, prefix="/api/coins/search")
app.include_router(platforms.router, prefix="/api/platforms/exchanges")
# Deliberately unauthenticated — see platforms.logo_router's own docstring/comment.
app.include_router(platforms.logo_router, prefix="/api/platforms/logo")


# Log which fields failed (never their values — request bodies hold user
# portfolio data) so 422s are diagnosable from CloudWatch instead of invisible.
@app.exception_handler(RequestValidationError)
async def log_validation_failure(request: Request, exc: RequestValidationError):
    fields = [
        {"loc": list(e.get("loc", ())), "msg": e.get("msg"), "type": e.get("type")}
        for e in exc.errors()
    ]
    logger.warning("validation_failure path=%s errors=%s", request.url.path, fields)
    return await request_validation_exception_handler(request, exc)


@app.get("/health")
def health():
    return {"ok": True}


# Unauthenticated on purpose: the web app pings this from the login page so the
# Aurora 0-ACU wake-up (~10-12s) overlaps the Cognito OAuth handshake instead of
# blocking the first portfolio fetch. It touches no user data.
@app.get("/health/db")
def health_db():
    with get_conn().cursor() as cur:
        cur.execute("SELECT 1")
    return {"ok": True}


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("→ %s %s", request.method, request.url.path)
    response = await call_next(request)
    logger.info("← %s %s %d", request.method, request.url.path, response.status_code)
    return response


# NOTE: schema migration runs lazily on the first DB request (see get_conn), NOT here.
# Connecting to a paused Aurora at import time would block the 10s cold-start init phase
# and time it out before the function even handles a request.
if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    logger.info(
        "Cold start: stage=%s pool=%s",
        os.environ.get("STAGE"),
        os.environ.get("COGNITO_USER_POOL_ID"),
    )

handler = Mangum(app, lifespan="off")
