from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from app.routes import ops, exit_prices, prices, export_data, import_data

app = FastAPI(title="crypto-assist backend")

# Allow all origins — the actual allowed list is validated per-request by the
# origin_regex / allow_origins check below; using "*" here avoids calling
# get_settings() at module import time (which fails without .env in tests).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # credentials=True requires explicit origins, not "*"
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


# Lambda entry point
handler = Mangum(app, lifespan="off")
