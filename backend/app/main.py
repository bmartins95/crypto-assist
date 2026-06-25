import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from app.routes import ops, exit_prices, prices, export_data, import_data

app = FastAPI(title="crypto-assist backend")

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


# On Lambda cold start, run schema migrations (CREATE TABLE IF NOT EXISTS — idempotent).
# Guarded by AWS_LAMBDA_FUNCTION_NAME so this never runs in tests.
if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    from app.db.postgres_client import ensure_schema
    ensure_schema()

handler = Mangum(app, lifespan="off")
