"""
Simulated Portfolio and Ledger for NAVEX Trading AI.
Tracks virtual account starting at $100,000, margin, equity curve,
realized/unrealized P&L, and trade performance statistics.
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from core.config import settings
from core.schemas import PortfolioState, SimulatedPosition, OrderStatus


class Portfolio:
    def __init__(self, initial_balance: float = settings.INITIAL_CAPITAL):
        self.initial_balance = initial_balance
        self.cash = initial_balance
        self.equity = initial_balance
        self.margin_used = 0.0
        self.realized_pnl = 0.0
        self.active_positions: Dict[str, SimulatedPosition] = {}
        self.closed_positions: List[SimulatedPosition] = []
        self.equity_history: List[Dict[str, Any]] = [
            {"timestamp": datetime.now(timezone.utc).isoformat(), "equity": initial_balance, "event": "INIT"}
        ]

    def add_position(self, position: SimulatedPosition) -> None:
        """Lock margin and add open position."""
        self.active_positions[position.id] = position
        # For paper trading, allocate margin
        self.margin_used += position.notional_value
        self.cash -= position.fees  # Deduct entry fee immediately
        self._record_equity(event=f"OPEN_{position.direction.value}")

    def update_mark_price(self, current_price: float, asset: str = "BTC/USDT") -> None:
        """Update unrealized P&L for all active positions."""
        for pos in self.active_positions.values():
            if pos.asset == asset and pos.status == OrderStatus.OPEN:
                pos.current_price = current_price
                if pos.direction.value == "LONG":
                    pos.gross_pnl = round((current_price - pos.fill_price) * pos.quantity, 2)
                else:  # SHORT
                    pos.gross_pnl = round((pos.fill_price - current_price) * pos.quantity, 2)

                pos.net_pnl = round(pos.gross_pnl - pos.fees - pos.slippage_cost, 2)
                pos.return_pct = round((pos.net_pnl / pos.notional_value) * 100.0, 2) if pos.notional_value > 0 else 0.0

        self.equity = round(self.cash + sum(p.gross_pnl for p in self.active_positions.values()), 2)

    def close_position(self, position_id: str, closed_position: SimulatedPosition) -> None:
        """Finalize closed position, realize P&L, and unlock margin."""
        if position_id in self.active_positions:
            pos = self.active_positions.pop(position_id)
            self.margin_used = max(0.0, self.margin_used - pos.notional_value)
            self.cash = round(self.cash + closed_position.net_pnl, 2)
            self.realized_pnl = round(self.realized_pnl + closed_position.net_pnl, 2)
            self.closed_positions.append(closed_position)
            self.equity = round(self.cash + sum(p.gross_pnl for p in self.active_positions.values()), 2)
            self._record_equity(event=f"CLOSE_{closed_position.closure_reason}")

    def _record_equity(self, event: str) -> None:
        self.equity_history.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "equity": round(self.equity, 2),
            "cash": round(self.cash, 2),
            "realized_pnl": round(self.realized_pnl, 2),
            "event": event
        })

    def get_state(self) -> PortfolioState:
        """Returns the current portfolio snapshot."""
        unrealized = round(sum(p.net_pnl for p in self.active_positions.values()), 2)
        total_closed = len(self.closed_positions)
        winners = sum(1 for p in self.closed_positions if p.net_pnl > 0)
        losers = sum(1 for p in self.closed_positions if p.net_pnl <= 0)
        win_rate = round((winners / total_closed) * 100.0, 1) if total_closed > 0 else 0.0

        return PortfolioState(
            initial_balance=self.initial_balance,
            cash=round(self.cash, 2),
            equity=round(self.equity, 2),
            margin_used=round(self.margin_used, 2),
            realized_pnl=round(self.realized_pnl, 2),
            unrealized_pnl=unrealized,
            total_trades=total_closed,
            winning_trades=winners,
            losing_trades=losers,
            win_rate=win_rate,
            active_positions=list(self.active_positions.values()),
            closed_positions=self.closed_positions,
            equity_history=self.equity_history,
        )

    def reset(self) -> None:
        """Reset portfolio back to initial state for new demo runs."""
        self.__init__(self.initial_balance)
