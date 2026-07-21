"""Classifies pre-existing ops as wallet or trade (docs/PLAN.md Item 28) and
removes any op_closures row left over from before this feature, when Item 26
allowed closing any Buy/Sell, not just leveraged ones.

Runs automatically, once, as part of the normal migration flow. Idempotent:
step 1's WHERE no longer matches once op_kind is already set correctly, and
step 2's subquery returns nothing once no wallet-classified op has a
lingering closure.
"""
import psycopg


def migrate(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE ops SET op_kind = 'trade',"
            " side = CASE type WHEN 'Buy' THEN 'long' ELSE 'short' END"
            " WHERE leverage IS NOT NULL AND leverage > 1 AND op_kind != 'trade'"
        )
        cur.execute(
            "DELETE FROM op_closures"
            " WHERE source_op_id IN (SELECT id FROM ops WHERE op_kind = 'wallet')"
            " OR closing_op_id IN (SELECT id FROM ops WHERE op_kind = 'wallet')"
        )
