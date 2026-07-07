from typing import Literal
from pydantic import BaseModel, field_validator, model_validator


OpType = Literal["Buy", "Sell"]

CurrencyCode = Literal["BRL", "USD", "EUR", "GBP", "JPY"]

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
    platform: str = ""
    currency: CurrencyCode = "BRL"


class Op(NewOp):
    id: str


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


# Import ops differ from NewOp in three ways old backups require: no id (the
# insert never uses one — the DB assigns it), Portuguese field names from
# before the schema itself was translated, and Compra/Venda type coercion.
# All of this stays off NewOp so the ops CRUD API keeps rejecting legacy shapes.
class ImportOp(NewOp):
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


class ExchangeRatesResponse(BaseModel):
    rates: dict[CurrencyCode, float]
    updatedAt: str
