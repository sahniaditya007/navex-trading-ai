"""
Unit Tests for Deterministic Risk Engine.
Validates position sizing, risk-to-reward constraints, SL/TP orientation,
excessive stop bounds, and deterministic veto authority.
"""

import pytest
from core.schemas import TradeDecision, TradeBias, RiskStatus
from risk.risk_engine import RiskEngine


@pytest.fixture
def risk_engine():
    return RiskEngine(
        max_risk_pct=0.01,       # 1% risk
        min_rr=1.5,              # 1.5:1 min R:R
        max_leverage=2.0,        # 2.0x max leverage
        min_stop_pct=0.003,      # 0.3% min stop
        max_stop_pct=0.08,       # 8.0% max stop
    )


def test_valid_long_risk_calculation(risk_engine):
    """Verifies valid LONG trade sizing: Size = Risk / (Entry - SL)."""
    equity = 100000.0
    entry = 60000.0
    sl = 59000.0       # $1,000 stop distance (1.67%)
    tp = 62500.0       # $2,500 reward distance (R:R = 2.5)

    decision = TradeDecision(
        direction=TradeBias.LONG,
        entry=entry,
        stop_loss=sl,
        take_profit=tp,
        invalidation_condition="Close below 59,000",
        confidence=0.85,
        rationale="Bullish continuation"
    )

    assessment = risk_engine.evaluate_trade(decision, account_equity=equity)

    assert assessment.status == RiskStatus.APPROVED
    assert assessment.risk_amount == 1000.0  # 1% of $100,000
    assert assessment.stop_distance == 1000.0
    assert assessment.reward_distance == 2500.0
    assert assessment.risk_reward_ratio == 2.5
    # Position size = 1,000 / 1,000 = 1.0 BTC
    assert assessment.calculated_position_size == 1.0
    assert assessment.decision.direction == TradeBias.LONG


def test_valid_short_risk_calculation(risk_engine):
    """Verifies valid SHORT trade sizing: Size = Risk / (SL - Entry)."""
    equity = 100000.0
    entry = 60000.0
    sl = 61000.0       # $1,000 stop distance
    tp = 58000.0       # $2,000 reward distance (R:R = 2.0)

    decision = TradeDecision(
        direction=TradeBias.SHORT,
        entry=entry,
        stop_loss=sl,
        take_profit=tp,
        invalidation_condition="Close above 61,000",
        confidence=0.80,
        rationale="Bearish breakdown"
    )

    assessment = risk_engine.evaluate_trade(decision, account_equity=equity)

    assert assessment.status == RiskStatus.APPROVED
    assert assessment.risk_amount == 1000.0
    assert assessment.stop_distance == 1000.0
    assert assessment.reward_distance == 2000.0
    assert assessment.risk_reward_ratio == 2.0
    assert assessment.calculated_position_size == 1.0


def test_rejection_on_invalid_long_stop_loss(risk_engine):
    """Rejects LONG if Stop Loss is above or equal to Entry."""
    decision = TradeDecision(
        direction=TradeBias.LONG,
        entry=60000.0,
        stop_loss=61000.0,  # Invalid for LONG!
        take_profit=63000.0,
        invalidation_condition="N/A",
        confidence=0.80,
        rationale="Flawed trade"
    )

    assessment = risk_engine.evaluate_trade(decision, account_equity=100000.0)

    assert assessment.status == RiskStatus.REJECTED
    assert assessment.decision.direction == TradeBias.NO_TRADE
    assert any("Stop Loss" in r for r in assessment.rejection_reasons)


def test_rejection_on_invalid_short_stop_loss(risk_engine):
    """Rejects SHORT if Stop Loss is below or equal to Entry."""
    decision = TradeDecision(
        direction=TradeBias.SHORT,
        entry=60000.0,
        stop_loss=59000.0,  # Invalid for SHORT!
        take_profit=57000.0,
        invalidation_condition="N/A",
        confidence=0.80,
        rationale="Flawed trade"
    )

    assessment = risk_engine.evaluate_trade(decision, account_equity=100000.0)

    assert assessment.status == RiskStatus.REJECTED
    assert assessment.decision.direction == TradeBias.NO_TRADE
    assert any("Stop Loss" in r for r in assessment.rejection_reasons)


def test_rejection_on_low_risk_reward_ratio(risk_engine):
    """Rejects if Risk-to-Reward ratio is below minimum threshold (1.5)."""
    decision = TradeDecision(
        direction=TradeBias.LONG,
        entry=60000.0,
        stop_loss=59000.0,  # $1,000 risk
        take_profit=61000.0, # $1,000 reward -> R:R = 1.0 (< 1.5)
        invalidation_condition="N/A",
        confidence=0.80,
        rationale="Unfavorable R:R"
    )

    assessment = risk_engine.evaluate_trade(decision, account_equity=100000.0)

    assert assessment.status == RiskStatus.REJECTED
    assert any("Risk/Reward" in r for r in assessment.rejection_reasons)


def test_rejection_on_stop_distance_bounds(risk_engine):
    """Rejects stops that are too tight (<0.3%) or excessively wide (>8%)."""
    # 1. Too tight: 0.1% stop
    tight_decision = TradeDecision(
        direction=TradeBias.LONG,
        entry=60000.0,
        stop_loss=59950.0,  # $50 = 0.08% stop
        take_profit=61000.0,
        invalidation_condition="N/A",
        confidence=0.80,
        rationale="Too tight"
    )
    assessment = risk_engine.evaluate_trade(tight_decision, account_equity=100000.0)
    assert assessment.status == RiskStatus.REJECTED
    assert any("tight" in r for r in assessment.rejection_reasons)

    # 2. Too wide: 10% stop
    wide_decision = TradeDecision(
        direction=TradeBias.LONG,
        entry=60000.0,
        stop_loss=54000.0,  # $6,000 = 10% stop
        take_profit=75000.0,
        invalidation_condition="N/A",
        confidence=0.80,
        rationale="Too wide"
    )
    assessment_wide = risk_engine.evaluate_trade(wide_decision, account_equity=100000.0)
    assert assessment_wide.status == RiskStatus.REJECTED
    assert any("wide" in r for r in assessment_wide.rejection_reasons)


def test_no_trade_bias_handling(risk_engine):
    """Validates that NO_TRADE bias passes through cleanly with 0 allocation."""
    decision = TradeDecision(
        direction=TradeBias.NO_TRADE,
        entry=60000.0,
        stop_loss=60000.0,
        take_profit=60000.0,
        invalidation_condition="N/A",
        confidence=0.5,
        rationale="Equilibrium"
    )
    assessment = risk_engine.evaluate_trade(decision, account_equity=100000.0)
    assert assessment.status == RiskStatus.APPROVED
    assert assessment.decision.direction == TradeBias.NO_TRADE
    assert assessment.calculated_position_size == 0.0
    assert assessment.risk_amount == 0.0
