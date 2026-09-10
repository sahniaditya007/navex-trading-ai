"""
Simulated Paper Execution Engine for NAVEX Trading AI.
Provides deterministic order execution, slippage and fee deduction,
and state machine progression (PENDING -> FILLED -> OPEN -> CLOSED).
Strictly simulated. Absolutely zero live exchange order placement.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from core.config import settings
from core.schemas import (
    TradeDecision,
    TradeBias,
    RiskAssessment,
    RiskStatus,
    SimulatedPosition,
    OrderStatus,
    ClosureReason,
    TradeOutcome,
    TradeThesis,
)
from simulation.portfolio import Portfolio


class ExecutionEngine:
    def __init__(
        self,
        portfolio: Portfolio,
        fee_rate: float = settings.TAKER_FEE_RATE,
        slippage_rate: float = settings.DEFAULT_SLIPPAGE_RATE,
    ):
        self.portfolio = portfolio
        self.fee_rate = fee_rate
        self.slippage_rate = slippage_rate

    def execute_order(
        self,
        decision: TradeDecision,
        risk_assessment: RiskAssessment,
        thesis: Optional[TradeThesis] = None,
        asset: str = "BTC/USDT",
    ) -> SimulatedPosition:
        """
        Execute an approved trade proposal into a simulated position.
        Applies slippage and taker fees deterministically.
        """
        if risk_assessment.status != RiskStatus.APPROVED or decision.direction == TradeBias.NO_TRADE:
            raise ValueError("Cannot execute a rejected or NO_TRADE decision.")

        pos_id = f"NAVEX-{uuid.uuid4().hex[:8].upper()}"
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        # Apply realistic slippage (unfavorable execution offset)
        entry = decision.entry
        if decision.direction == TradeBias.LONG:
            fill_price = round(entry * (1.0 + self.slippage_rate), 2)
        else:  # SHORT
            fill_price = round(entry * (1.0 - self.slippage_rate), 2)

        quantity = risk_assessment.calculated_position_size
        notional_value = round(fill_price * quantity, 2)
        slippage_cost = round(abs(fill_price - entry) * quantity, 2)
        entry_fee = round(notional_value * self.fee_rate, 2)

        position = SimulatedPosition(
            id=pos_id,
            asset=asset,
            direction=decision.direction,
            entry_target=entry,
            fill_price=fill_price,
            stop_loss=decision.stop_loss,
            take_profit=decision.take_profit,
            quantity=quantity,
            notional_value=notional_value,
            status=OrderStatus.OPEN,
            opened_at=now_str,
            current_price=fill_price,
            gross_pnl=0.0,
            fees=entry_fee,
            slippage_cost=slippage_cost,
            net_pnl=-round(entry_fee + slippage_cost, 2),
            return_pct=0.0,
            thesis=thesis,
        )

        self.portfolio.add_position(position)
        return position

    def evaluate_bar(
        self,
        position_id: str,
        current_price: float,
        high: Optional[float] = None,
        low: Optional[float] = None,
        bar_index: int = 1,
    ) -> Tuple[SimulatedPosition, Optional[TradeOutcome]]:
        """
        Evaluate active position against latest bar high/low/close prices.
        Checks for Take Profit, Stop Loss, or Invalidation triggers.
        """
        pos = self.portfolio.active_positions.get(position_id)
        if not pos or pos.status != OrderStatus.OPEN:
            raise ValueError(f"No active open position found with ID: {position_id}")

        bar_high = high if high is not None else current_price
        bar_low = low if low is not None else current_price

        # Update mark price
        self.portfolio.update_mark_price(current_price, asset=pos.asset)

        closed_reason: Optional[ClosureReason] = None
        exit_price: Optional[float] = None

        if pos.direction == TradeBias.LONG:
            # Check Take Profit
            if bar_high >= pos.take_profit:
                closed_reason = ClosureReason.TAKE_PROFIT
                exit_price = pos.take_profit
            # Check Stop Loss
            elif bar_low <= pos.stop_loss:
                closed_reason = ClosureReason.STOP_LOSS
                exit_price = pos.stop_loss

        elif pos.direction == TradeBias.SHORT:
            # Check Take Profit
            if bar_low <= pos.take_profit:
                closed_reason = ClosureReason.TAKE_PROFIT
                exit_price = pos.take_profit
            # Check Stop Loss
            elif bar_high >= pos.stop_loss:
                closed_reason = ClosureReason.STOP_LOSS
                exit_price = pos.stop_loss

        if closed_reason and exit_price:
            outcome = self._finalize_closure(pos, exit_price, closed_reason, bar_index)
            return pos, outcome

        return pos, None

    def close_manually(
        self,
        position_id: str,
        current_price: float,
        reason: ClosureReason = ClosureReason.MANUAL_CLOSE,
        bar_index: int = 1,
    ) -> TradeOutcome:
        """Manually close an open position at current market price."""
        pos = self.portfolio.active_positions.get(position_id)
        if not pos or pos.status != OrderStatus.OPEN:
            raise ValueError(f"No active open position found with ID: {position_id}")

        return self._finalize_closure(pos, current_price, reason, bar_index)

    def _finalize_closure(
        self,
        pos: SimulatedPosition,
        exit_price: float,
        reason: ClosureReason,
        duration_bars: int,
    ) -> TradeOutcome:
        """Calculates final P&L, deducts exit fees, updates portfolio, and creates TradeOutcome."""
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        # Exit fees
        exit_notional = exit_price * pos.quantity
        exit_fee = round(exit_notional * self.fee_rate, 2)
        total_fees = round(pos.fees + exit_fee, 2)

        # Gross P&L
        if pos.direction == TradeBias.LONG:
            gross_pnl = round((exit_price - pos.fill_price) * pos.quantity, 2)
        else:  # SHORT
            gross_pnl = round((pos.fill_price - exit_price) * pos.quantity, 2)

        net_pnl = round(gross_pnl - total_fees - pos.slippage_cost, 2)
        return_pct = round((net_pnl / pos.notional_value) * 100.0, 2) if pos.notional_value > 0 else 0.0

        pos.status = OrderStatus.CLOSED
        pos.closed_at = now_str
        pos.closure_reason = reason
        pos.exit_price = exit_price
        pos.current_price = exit_price
        pos.gross_pnl = gross_pnl
        pos.fees = total_fees
        pos.net_pnl = net_pnl
        pos.return_pct = return_pct

        # Finalize on portfolio
        self.portfolio.close_position(pos.id, pos)

        # Construct outcome record for review
        outcome = TradeOutcome(
            position_id=pos.id,
            asset=pos.asset,
            direction=pos.direction,
            entry_price=pos.fill_price,
            exit_price=exit_price,
            quantity=pos.quantity,
            gross_pnl=gross_pnl,
            fees=total_fees,
            net_pnl=net_pnl,
            return_pct=return_pct,
            closure_reason=reason,
            duration_bars=duration_bars,
            opened_at=pos.opened_at,
            closed_at=now_str,
            original_thesis=pos.thesis or TradeThesis(
                bias=pos.direction,
                confidence=0.8,
                thesis="Baseline trade execution",
                market_structure="TREND",
                catalysts=[],
                supporting_factors=[],
                conflicting_factors=[],
                key_levels={"entry": pos.fill_price, "stop_loss": pos.stop_loss, "take_profit": pos.take_profit},
                invalidation_condition="Stop loss breach",
                entry_reason="Execution trigger",
                stop_loss_reason="Pre-defined risk limit",
                take_profit_reason="Pre-defined profit objective",
                risk_considerations=[],
                assumptions=[]
            )
        )

        return outcome
