"""
Episodic Trade Memory Database for NAVEX Trading AI.
Uses SQLite for persistent storage of trade lifecycles, structured theses,
post-mortem AI reviews, and distilled learning rules.
Provides feedback-informed analysis by retrieving relevant lessons for subsequent decisions.
"""

import json
import sqlite3
from pathlib import Path
from typing import List, Dict, Optional, Any
from core.config import settings
from core.schemas import SimulatedPosition, TradeThesis, TradeOutcome, PostTradeReview


class MemoryDatabase:
    def __init__(self, db_path: str = settings.DATABASE_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Initializes tables if they do not exist."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS trades (
                    id TEXT PRIMARY KEY,
                    asset TEXT NOT NULL,
                    direction TEXT NOT NULL,
                    entry_price REAL NOT NULL,
                    exit_price REAL,
                    quantity REAL NOT NULL,
                    gross_pnl REAL,
                    fees REAL,
                    net_pnl REAL,
                    return_pct REAL,
                    status TEXT NOT NULL,
                    closure_reason TEXT,
                    opened_at TEXT NOT NULL,
                    closed_at TEXT
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS theses (
                    trade_id TEXT PRIMARY KEY,
                    bias TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    thesis_text TEXT NOT NULL,
                    full_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(trade_id) REFERENCES trades(id)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS reviews (
                    trade_id TEXT PRIMARY KEY,
                    outcome TEXT NOT NULL,
                    thesis_correct INTEGER NOT NULL,
                    execution_quality TEXT NOT NULL,
                    what_worked TEXT,
                    what_failed TEXT,
                    why TEXT,
                    recommended_change TEXT,
                    confidence_in_review REAL,
                    full_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(trade_id) REFERENCES trades(id)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS lessons (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    trade_id TEXT,
                    lesson_text TEXT NOT NULL,
                    outcome TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(trade_id) REFERENCES trades(id)
                )
            """)

            conn.commit()

            # Seed initial foundational trading principles if table is empty
            cursor.execute("SELECT COUNT(*) as cnt FROM lessons")
            row = cursor.fetchone()
            if row and row["cnt"] == 0:
                seed_lessons = [
                    ("SYSTEM_SEED", "Do not chase extended breakouts when RSI is above 75 without a pullback test.", "SEED"),
                    ("SYSTEM_SEED", "Prioritize setups where order-book depth exhibits clear buyer volume absorption.", "SEED"),
                    ("SYSTEM_SEED", "Respect invalidation levels strictly; never widen stop loss after trade entry.", "SEED"),
                ]
                cursor.executemany(
                    "INSERT INTO lessons (trade_id, lesson_text, outcome) VALUES (?, ?, ?)",
                    seed_lessons
                )
                conn.commit()

    def save_completed_trade(
        self,
        position: SimulatedPosition,
        thesis: Optional[TradeThesis],
        review: Optional[PostTradeReview]
    ) -> None:
        """Stores the full lifecycle of a completed trade."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # 1. Insert/Update trade record
            cursor.execute("""
                INSERT OR REPLACE INTO trades (
                    id, asset, direction, entry_price, exit_price, quantity,
                    gross_pnl, fees, net_pnl, return_pct, status, closure_reason,
                    opened_at, closed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                position.id,
                position.asset,
                position.direction.value,
                position.fill_price,
                position.exit_price,
                position.quantity,
                position.gross_pnl,
                position.fees,
                position.net_pnl,
                position.return_pct,
                position.status.value,
                position.closure_reason.value if position.closure_reason else None,
                position.opened_at,
                position.closed_at,
            ))

            # 2. Insert Thesis
            if thesis:
                cursor.execute("""
                    INSERT OR REPLACE INTO theses (
                        trade_id, bias, confidence, thesis_text, full_json
                    ) VALUES (?, ?, ?, ?, ?)
                """, (
                    position.id,
                    thesis.bias.value,
                    thesis.confidence,
                    thesis.thesis,
                    thesis.model_dump_json(),
                ))

            # 3. Insert Review
            if review:
                cursor.execute("""
                    INSERT OR REPLACE INTO reviews (
                        trade_id, outcome, thesis_correct, execution_quality,
                        what_worked, what_failed, why, recommended_change,
                        confidence_in_review, full_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    position.id,
                    review.outcome,
                    1 if review.thesis_correct else 0,
                    review.execution_quality,
                    review.what_worked,
                    review.what_failed,
                    review.why,
                    review.recommended_change,
                    review.confidence_in_review,
                    review.model_dump_json(),
                ))

                # 4. Insert extracted lessons
                for lesson in review.lessons_learned:
                    cursor.execute("""
                        INSERT INTO lessons (trade_id, lesson_text, outcome)
                        VALUES (?, ?, ?)
                    """, (position.id, lesson, review.outcome))

            conn.commit()

    def get_prior_learnings(self, limit: int = 5) -> List[str]:
        """
        Retrieves the most recent actionable trade lessons for injection into AI Analyst context.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT lesson_text FROM lessons ORDER BY id DESC LIMIT ?",
                (limit,)
            )
            rows = cursor.fetchall()
            return [r["lesson_text"] for r in rows]

    def get_all_reviews(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Retrieves recent post-trade reviews."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT trade_id, outcome, thesis_correct, execution_quality, what_worked, what_failed, why, recommended_change, full_json, created_at FROM reviews ORDER BY created_at DESC LIMIT ?",
                (limit,)
            )
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def get_trade_history(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieves past trade records."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM trades ORDER BY opened_at DESC LIMIT ?",
                (limit,)
            )
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def reset(self) -> None:
        """Clear database tables for fresh demo testing."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DROP TABLE IF EXISTS lessons")
            cursor.execute("DROP TABLE IF EXISTS reviews")
            cursor.execute("DROP TABLE IF EXISTS theses")
            cursor.execute("DROP TABLE IF EXISTS trades")
            conn.commit()
        self._init_db()
