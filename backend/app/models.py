from typing import Literal
from pydantic import BaseModel, field_validator


OpType = Literal["Buy", "Sell"]

_LEGACY_TYPE_MAP = {"Compra": "Buy", "Venda": "Sell"}


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


# Import ops differ from NewOp in two ways old backups require: no id (the
# insert never uses one — the DB assigns it) and Compra/Venda type coercion,
# which stays off NewOp so the ops CRUD API keeps rejecting Portuguese values.
class ImportOp(NewOp):
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
