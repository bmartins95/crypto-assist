from typing import Annotated, Literal
from pydantic import BaseModel, Field, field_validator, model_validator


OpType = Literal["Buy", "Sell"]

CurrencyCode = Literal["BRL", "USD", "EUR", "GBP", "JPY"]

# Fixed presets (2/3/5/10) or any custom integer up to 125x, matching common
# exchange futures leverage caps (e.g. Binance's 125x).
LeverageValue = Annotated[int, Field(ge=2, le=125)]

OpKind = Literal["wallet", "trade"]

Side = Literal["long", "short"]

_LEGACY_TYPE_MAP = {"Compra": "Buy", "Venda": "Sell"}

# Backups written before the app's fields were themselves translated to English
# used Portuguese key names, not just Portuguese type values.
_LEGACY_FIELD_MAP = {
    "data": "date",
    "tipo": "type",
    "qtd": "qty",
    "preco": "price",
    "taxa": "fee",
    "plataforma": "platform",
}


class NewOp(BaseModel):
    date: str
    coinId: str
    symbol: str
    name: str
    type: OpType
    qty: float
    price: float
    fee: float = 0.0
    total: float
    platformId: str | None = None
    platformName: str | None = None
    currency: CurrencyCode = "BRL"
    leverage: LeverageValue | None = None
    tradeGroupId: str | None = None
    kind: OpKind = "wallet"
    # Client-supplied side is never trusted for a new trade op — the route derives it
    # from `type` server-side. Present here only so PUT's immutability check has a
    # value to compare against the stored row.
    side: Side | None = None


class Op(NewOp):
    id: str
    # Real DB insertion time — used (instead of `id`) to break ties between same-date
    # wallet ops in FIFO balance calculations (see shared/src/walletFifo.ts). Optional
    # because export_data.py's own leaner SELECT doesn't currently carry it.
    createdAt: str | None = None


class OpClosure(BaseModel):
    id: str
    sourceOpId: str
    closingOpId: str
    qtyClosed: float
    realizedPnl: float


class CloseOpRequest(BaseModel):
    closingOp: NewOp
    qtyToClose: float


class CloseOpResponse(BaseModel):
    closingOp: Op
    closures: list[OpClosure]


class ExitPriceUpdate(BaseModel):
    coinId: str
    exitPrice: float


class PriceInfo(BaseModel):
    price: float
    image: str | None = None


class BackupPayload(BaseModel):
    version: int
    exportedAt: str
    ops: list[Op]
    exitPrices: dict[str, float] = {}


# Import ops differ from NewOp in four ways old backups require: no id (the
# insert never uses one — the DB assigns it), Portuguese field names from
# before the schema itself was translated, Compra/Venda type coercion, and a
# legacy free-text `platform` string (pre-Item-22 backups) that the import
# route resolves against the platform catalog via resolve_platform() before
# insert — it never reaches NewOp/the ops table directly.
# All of this stays off NewOp so the ops CRUD API keeps rejecting legacy shapes.
class ImportOp(NewOp):
    platform: str | None = None

    @model_validator(mode="before")
    @classmethod
    def coerce_legacy_fields(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data
        remapped = dict(data)
        for legacy_key, new_key in _LEGACY_FIELD_MAP.items():
            if new_key not in remapped and legacy_key in remapped:
                remapped[new_key] = remapped[legacy_key]
        return remapped

    @field_validator("type", mode="before")
    @classmethod
    def coerce_legacy_type(cls, v: object) -> object:
        return _LEGACY_TYPE_MAP.get(str(v), v)


class ImportPayload(BaseModel):
    version: int
    exportedAt: str
    ops: list[ImportOp]
    exitPrices: dict[str, float] = {}


class DeleteAllOpsResponse(BaseModel):
    deleted: int


class DeleteOpResponse(BaseModel):
    deletedIds: list[str]


class ExchangeRatesResponse(BaseModel):
    rates: dict[CurrencyCode, float]
    updatedAt: str


class PlatformExchangeEntry(BaseModel):
    id: str
    name: str
    logoUrl: str | None = None
    kind: str = "exchange"


class PlatformsExchangesResponse(BaseModel):
    exchanges: list[PlatformExchangeEntry]
    updatedAt: str
