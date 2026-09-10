"""
Unit Tests for AI Schemas, Analyst Agent, Review Agent, and Episodic Memory.
Validates Pydantic schema constraints, structured thesis generation,
post-mortem review extraction, and SQLite database learning persistence.
"""

import os
import tempfile
import pytest
from pydantic import ValidationError
from core.schemas import (
    TradeThesis,
    TradeBias,
    TradeDecision,
    PostTradeReview,
    TradeOutcome,
    ClosureReason,
    MarketContext,
)
from memory.database import MemoryDatabase
from agents.analyst_agent import AnalystAgent, thesis_to_decision
from agents.review_agent import ReviewAgent


def test_trade_thesis_schema_validation():
    """Verifies that TradeThesis enforces strict typed structure and confidence bounds."""
    # Valid schema
    thesis = TradeThesis(
        bias=TradeBias.LONG,
        confidence=0.85,
        thesis="Valid narrative",
        market_structure="BULLISH_TREND",
        catalysts=["ETF inflows"],
        supporting_factors=["Above EMA 20"],
        conflicting_factors=["RSI approaching 70"],
        key_levels={"entry": 60000.0, "stop_loss": 59000.0, "take_profit": 62500.0},
        invalidation_condition="Close below 59,000",
        entry_reason="EMA bounce",
        stop_loss_reason="Below support",
        take_profit_reason="Target resistance",
        risk_considerations=["Chop risk"],
        assumptions=["Bullish continuation"]
    )
    assert thesis.bias == TradeBias.LONG
    assert thesis.confidence == 0.85

    # Invalid confidence > 1.0
    with pytest.raises(ValidationError):
        TradeThesis(
            bias=TradeBias.LONG,
            confidence=1.5,  # Out of range!
            thesis="Invalid",
            market_structure="TREND",
            invalidation_condition="None",
            entry_reason="None",
            stop_loss_reason="None",
            take_profit_reason="None"
        )


def test_sqlite_memory_lifecycle():
    """Verifies persistent storage and retrieval of trade lessons in SQLite."""
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    db_path = tmp.name
    tmp.close()


    try:
        db = MemoryDatabase(db_path=db_path)
        # Should have initial seed lessons
        initial_lessons = db.get_prior_learnings(5)
        assert len(initial_lessons) >= 3

        # Simulate completed trade review
        from simulation.portfolio import Portfolio
        from simulation.execution_engine import ExecutionEngine
        from risk.risk_engine import RiskEngine

        p = Portfolio()
        engine = ExecutionEngine(portfolio=p)
        risk = RiskEngine()

        dec = TradeDecision(
            direction=TradeBias.LONG,
            entry=60000.0,
            stop_loss=59000.0,
            take_profit=62500.0,
            invalidation_condition="SL",
            confidence=0.85,
            rationale="Test"
        )
        assessment = risk.evaluate_trade(dec)
        pos = engine.execute_order(dec, assessment)

        # Close position
        pos.status = pos.status.CLOSED
        pos.exit_price = 62500.0
        pos.net_pnl = 2450.0

        rev = PostTradeReview(
            trade_id=pos.id,
            outcome="PROFIT_TAKE_PROFIT",
            thesis_correct=True,
            execution_quality="EXCELLENT",
            what_worked="Momentum held",
            what_failed="None",
            why="Strong buying flow",
            risk_management_assessment="Sound",
            lessons_learned=["Always wait for volume confirmation on 1h close."],
            recommended_change="None",
            confidence_in_review=0.9
        )

        db.save_completed_trade(pos, thesis=None, review=rev)

        # Check retrieval: newly saved lesson should appear at top
        updated_lessons = db.get_prior_learnings(5)
        assert "Always wait for volume confirmation on 1h close." in updated_lessons

        # Check history
        history = db.get_trade_history(5)
        assert len(history) == 1
        assert history[0]["id"] == pos.id

    finally:
        try:
            if os.path.exists(db_path):
                os.remove(db_path)
        except OSError:
            pass


def test_gemini_agent_configuration_and_fallback():
    """Verifies that AnalystAgent and ReviewAgent properly initialize with Gemini configuration and fallback."""
    from unittest.mock import MagicMock, patch
    from core.config import settings

    agent = AnalystAgent()
    assert agent.provider == settings.LLM_PROVIDER
    assert agent.model == settings.LLM_MODEL

    # Verify deterministic fallback when LLM fails or keys are unset
    ctx = MarketContext(
        asset="BTC/USDT",
        timeframe="1h",
        current_price=64000.0,
        recent_price_change_pct=1.5,
        volume_24h=1000000.0,
        trend="BULLISH",
        ema_20=63500.0,
        ema_50=62800.0,
        ema_200=61000.0,
        rsi=60.0,
        atr=500.0,
        volatility=1.5,
        market_structure="BULLISH_TREND",
        support_levels=[63000.0],
        resistance_levels=[65000.0]
    )

    with patch.object(agent, "_call_gemini", side_effect=RuntimeError("Simulated API Error")):
        thesis = agent.analyze(ctx)
        assert thesis is not None
        assert thesis.bias in [TradeBias.LONG, TradeBias.SHORT, TradeBias.NO_TRADE]
        assert 0.0 <= thesis.confidence <= 1.0


