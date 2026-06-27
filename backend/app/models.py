from typing import Literal
from pydantic import BaseModel


OpType = Literal["Buy", "Sell"]


class Op(BaseModel):
    id: str
    date: str
    coinId: str
    symbol: str
    name: str
    type: OpType
    qty: float
    price: float
    fee: float
    total: float
    platform: str


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
