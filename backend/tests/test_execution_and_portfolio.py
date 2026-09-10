"""
Unit Tests for Execution Simulation and Portfolio Ledger.
Validates realistic slippage modeling, fee deduction, state machine transitions,
Take Profit / Stop Loss execution triggers, and realized/unrealized P&L accounting.
"""

import pytest
from core.schemas import (
    TradeDecision,
    TradeBias,
    RiskAssessment,
    RiskStatus,
    OrderStatus,
    ClosureReason,
)
from simulation.portfolio import Portfolio
from simulation.execution_engine import ExecutionEngine


@pytest.fixture
def portfolio():
    return Portfolio(initial_balance=100000.0)


@pytest.fixture
def execution_engine(portfolio):
    return ExecutionEngine(
        portfolio=portfolio,
        fee_rate=0.0005,       # 0.05% taker fee
        slippage_rate=0.0002,  # 0.02% slippage
    )


def test_order_execution_and_slippage(execution_engine, portfolio):
    """Verifies that LONG order fills higher than entry due to unfavorable slippage."""
    decision = TradeDecision(
        direction=TradeBias.LONG,
        entry=60000.0,
        stop_loss=59000.0,
        take_profit=62500.0,
        position_size=1.0,
        risk_amount=1000.0,
        risk_reward_ratio=2.5,
        invalidation_condition="Below 59k",
        confidence=0.85,
        rationale="Breakout"
    )

    assessment = RiskAssessment(
        status=RiskStatus.APPROVED,
        decision=decision,
        account_equity=100000.0,
        risk_amount=1000.0,
        risk_percentage=1.0,
        calculated_position_size=1.0,
        stop_distance=1000.0,
        stop_distance_pct=1.67,
        reward_distance=2500.0,
        risk_reward_ratio=2.5,
    )

    pos = execution_engine.execute_order(decision, assessment, asset="BTC/USDT")

    assert pos.status == OrderStatus.OPEN
    # Long fill price = 60000 * 1.0002 = 60012.0
    assert pos.fill_price == 60012.0
    assert pos.slippage_cost == 12.0
    # Entry taker fee = 60012 * 1.0 * 0.0005 = 30.01
    assert pos.fees == 30.01
    assert pos.id in portfolio.active_positions


def test_take_profit_trigger_and_pnl(execution_engine, portfolio):
    """Verifies Take Profit execution and exact net P&L calculation for LONG."""
    decision = TradeDecision(
        direction=TradeBias.LONG,
        entry=60000.0,
        stop_loss=59000.0,
        take_profit=62000.0,
        position_size=1.0,
        risk_amount=1000.0,
        risk_reward_ratio=2.0,
        invalidation_condition="SL",
        confidence=0.8,
        rationale="Trade"
    )
    assessment = RiskAssessment(
        status=RiskStatus.APPROVED,
        decision=decision,
        account_equity=100000.0,
        risk_amount=1000.0,
        risk_percentage=1.0,
        calculated_position_size=1.0,
        stop_distance=1000.0,
        stop_distance_pct=1.67,
        reward_distance=2000.0,
        risk_reward_ratio=2.0,
    )

    pos = execution_engine.execute_order(decision, assessment)

    # Bar reaches Take Profit at 62,000 (high = 62,100)
    updated_pos, outcome = execution_engine.evaluate_bar(
        position_id=pos.id,
        current_price=62050.0,
        high=62100.0,
        low=61500.0,
        bar_index=2
    )

    assert outcome is not None
    assert outcome.closure_reason == ClosureReason.TAKE_PROFIT
    assert outcome.exit_price == 62000.0
    # Gross P&L = (62000.0 - 60012.0) * 1.0 = 1988.0
    assert outcome.gross_pnl == 1988.0
    assert outcome.net_pnl > 0
    assert updated_pos.status == OrderStatus.CLOSED

    # Portfolio check
    state = portfolio.get_state()
    assert state.total_trades == 1
    assert state.winning_trades == 1
    assert state.win_rate == 100.0
    assert state.realized_pnl == outcome.net_pnl


def test_stop_loss_trigger_and_loss_cap(execution_engine, portfolio):
    """Verifies Stop Loss execution strictly caps realized loss."""
    decision = TradeDecision(
        direction=TradeBias.LONG,
        entry=60000.0,
        stop_loss=59000.0,
        take_profit=63000.0,
        position_size=1.0,
        risk_amount=1000.0,
        risk_reward_ratio=3.0,
        invalidation_condition="SL",
        confidence=0.8,
        rationale="Trade"
    )
    assessment = RiskAssessment(
        status=RiskStatus.APPROVED,
        decision=decision,
        account_equity=100000.0,
        risk_amount=1000.0,
        risk_percentage=1.0,
        calculated_position_size=1.0,
        stop_distance=1000.0,
        stop_distance_pct=1.67,
        reward_distance=3000.0,
        risk_reward_ratio=3.0,
    )

    pos = execution_engine.execute_order(decision, assessment)

    # Bar breaches Stop Loss (low = 58,900 <= 59,000)
    updated_pos, outcome = execution_engine.evaluate_bar(
        position_id=pos.id,
        current_price=58950.0,
        high=59500.0,
        low=58900.0,
        bar_index=3
    )

    assert outcome is not None
    assert outcome.closure_reason == ClosureReason.STOP_LOSS
    assert outcome.exit_price == 59000.0
    # Gross loss = (59000 - 60012) * 1.0 = -1012.0
    assert outcome.gross_pnl == -1012.0
    assert outcome.net_pnl < 0
    assert updated_pos.status == OrderStatus.CLOSED

    state = portfolio.get_state()
    assert state.total_trades == 1
    assert state.losing_trades == 1
    assert state.win_rate == 0.0


def test_short_trade_execution_and_profit(execution_engine, portfolio):
    """Verifies that SHORT positions generate profit when price declines."""
    decision = TradeDecision(
        direction=TradeBias.SHORT,
        entry=60000.0,
        stop_loss=61000.0,
        take_profit=58000.0,
        position_size=1.0,
        risk_amount=1000.0,
        risk_reward_ratio=2.0,
        invalidation_condition="Above 61k",
        confidence=0.8,
        rationale="Short breakdown"
    )
    assessment = RiskAssessment(
        status=RiskStatus.APPROVED,
        decision=decision,
        account_equity=100000.0,
        risk_amount=1000.0,
        risk_percentage=1.0,
        calculated_position_size=1.0,
        stop_distance=1000.0,
        stop_distance_pct=1.67,
        reward_distance=2000.0,
        risk_reward_ratio=2.0,
    )

    pos = execution_engine.execute_order(decision, assessment)
    # Short fill price = 60000 * (1 - 0.0002) = 59988.0
    assert pos.fill_price == 59988.0

    # Market drops to 58,000 (Take profit hit for short: low = 57,900)
    updated_pos, outcome = execution_engine.evaluate_bar(
        position_id=pos.id,
        current_price=57950.0,
        high=58500.0,
        low=57900.0,
        bar_index=4
    )

    assert outcome is not None
    assert outcome.closure_reason == ClosureReason.TAKE_PROFIT
    assert outcome.exit_price == 58000.0
    # Gross profit for short: (fill - exit) * qty = (59988 - 58000) * 1.0 = 1988.0
    assert outcome.gross_pnl == 1988.0
    assert outcome.net_pnl > 0
