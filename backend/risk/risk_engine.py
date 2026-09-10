"""
Deterministic Risk Engine for NAVEX Trading AI.
Provides mathematical guardrails with absolute veto power over AI proposals.
The LLM does NOT have final authority over risk or position sizing.
All position sizing and boundary validations are purely deterministic.
"""

from typing import List, Tuple
from core.config import settings
from core.schemas import (
    TradeDecision,
    TradeBias,
    RiskAssessment,
    RiskStatus,
    RiskCheck,
)


class RiskEngine:
    def __init__(
        self,
        max_risk_pct: float = settings.MAX_RISK_PER_TRADE_PCT,
        min_rr: float = settings.MIN_RISK_REWARD_RATIO,
        max_leverage: float = settings.MAX_LEVERAGE,
        min_stop_pct: float = settings.MIN_STOP_DISTANCE_PCT,
        max_stop_pct: float = settings.MAX_STOP_DISTANCE_PCT,
    ):
        self.max_risk_pct = max_risk_pct
        self.min_rr = min_rr
        self.max_leverage = max_leverage
        self.min_stop_pct = min_stop_pct
        self.max_stop_pct = max_stop_pct

    def evaluate_trade(
        self,
        decision: TradeDecision,
        account_equity: float = settings.INITIAL_CAPITAL,
    ) -> RiskAssessment:
        """
        Evaluate and size a proposed trade decision against deterministic guardrails.
        Returns a RiskAssessment with either APPROVED or REJECTED status.
        """
        checks: List[RiskCheck] = []
        rejections: List[str] = []

        # If decision is already NO_TRADE, validate cleanly with zero allocation
        if decision.direction == TradeBias.NO_TRADE:
            checks.append(RiskCheck(check_name="BIAS_SELECTION", passed=True, details="No trade proposed by analyst."))
            return RiskAssessment(
                status=RiskStatus.APPROVED,
                decision=decision,
                account_equity=account_equity,
                risk_amount=0.0,
                risk_percentage=0.0,
                calculated_position_size=0.0,
                stop_distance=0.0,
                stop_distance_pct=0.0,
                reward_distance=0.0,
                risk_reward_ratio=0.0,
                checks=checks,
                rejection_reasons=[],
            )

        entry = decision.entry
        sl = decision.stop_loss
        tp = decision.take_profit

        # Check 1: Valid positive pricing
        if entry <= 0 or sl <= 0 or tp <= 0:
            rejections.append(f"Invalid non-positive pricing detected: Entry={entry}, SL={sl}, TP={tp}")
            checks.append(RiskCheck(check_name="PRICE_SANITY", passed=False, details="Prices must be positive numbers."))
            return self._build_rejection(decision, account_equity, checks, rejections)
        else:
            checks.append(RiskCheck(check_name="PRICE_SANITY", passed=True, details="Entry, SL, and TP prices are valid."))

        # Check 2: Directional Alignment of SL and TP
        if decision.direction == TradeBias.LONG:
            sl_valid = sl < entry
            tp_valid = tp > entry
            stop_distance = entry - sl
            reward_distance = tp - entry
            dir_msg = "LONG requires: Stop Loss < Entry < Take Profit."
        else:  # SHORT
            sl_valid = sl > entry
            tp_valid = tp < entry
            stop_distance = sl - entry
            reward_distance = entry - tp
            dir_msg = "SHORT requires: Take Profit < Entry < Stop Loss."

        if not sl_valid:
            rejections.append(f"Invalid Stop Loss orientation: {dir_msg} (Given Entry={entry}, SL={sl})")
            checks.append(RiskCheck(check_name="SL_ORIENTATION", passed=False, details="Stop loss on wrong side of entry."))
        else:
            checks.append(RiskCheck(check_name="SL_ORIENTATION", passed=True, details=f"Stop distance: ${stop_distance:,.2f}"))

        if not tp_valid:
            rejections.append(f"Invalid Take Profit orientation: {dir_msg} (Given Entry={entry}, TP={tp})")
            checks.append(RiskCheck(check_name="TP_ORIENTATION", passed=False, details="Take profit on wrong side of entry."))
        else:
            checks.append(RiskCheck(check_name="TP_ORIENTATION", passed=True, details=f"Reward distance: ${reward_distance:,.2f}"))

        if not sl_valid or not tp_valid:
            return self._build_rejection(decision, account_equity, checks, rejections)

        # Check 3: Stop Distance Bounds
        stop_dist_pct = stop_distance / entry
        if stop_dist_pct < self.min_stop_pct:
            rejections.append(f"Stop loss too tight ({stop_dist_pct*100:.2f}% < {self.min_stop_pct*100:.2f}% min). Risk of premature noise stop-out.")
            checks.append(RiskCheck(check_name="STOP_BOUNDS", passed=False, details=f"{stop_dist_pct*100:.2f}% is below minimum."))
        elif stop_dist_pct > self.max_stop_pct:
            rejections.append(f"Stop loss excessively wide ({stop_dist_pct*100:.2f}% > {self.max_stop_pct*100:.2f}% max). Poor capital efficiency.")
            checks.append(RiskCheck(check_name="STOP_BOUNDS", passed=False, details=f"{stop_dist_pct*100:.2f}% exceeds maximum."))
        else:
            checks.append(RiskCheck(check_name="STOP_BOUNDS", passed=True, details=f"Stop distance: {stop_dist_pct*100:.2f}% of entry."))

        # Check 4: Risk to Reward Ratio
        rr_ratio = round(reward_distance / stop_distance, 2)
        if rr_ratio < self.min_rr:
            rejections.append(f"Insufficient Risk/Reward ratio: {rr_ratio}:1 (Minimum required is {self.min_rr}:1).")
            checks.append(RiskCheck(check_name="RISK_REWARD", passed=False, details=f"{rr_ratio} < {self.min_rr} minimum."))
        else:
            checks.append(RiskCheck(check_name="RISK_REWARD", passed=True, details=f"R:R ratio is {rr_ratio}:1 (>= {self.min_rr}:1)."))

        # Check 5: Deterministic Position Sizing
        # risk_amount = equity * risk_pct
        # position_size = risk_amount / stop_distance
        risk_amount = round(account_equity * self.max_risk_pct, 2)
        position_size = round(risk_amount / stop_distance, 4)
        notional_value = round(position_size * entry, 2)
        max_allowed_notional = round(account_equity * self.max_leverage, 2)

        if notional_value > max_allowed_notional:
            # Scale down position size to respect leverage cap
            position_size = round(max_allowed_notional / entry, 4)
            notional_value = round(position_size * entry, 2)
            actual_risk = round(position_size * stop_distance, 2)
            checks.append(RiskCheck(
                check_name="LEVERAGE_CAP",
                passed=True,
                details=f"Position scaled down to {self.max_leverage}x equity cap (${notional_value:,.2f}). Actual risk: ${actual_risk:,.2f}."
            ))
            risk_amount = actual_risk
        else:
            checks.append(RiskCheck(
                check_name="LEVERAGE_CAP",
                passed=True,
                details=f"Notional value ${notional_value:,.2f} within limit (${max_allowed_notional:,.2f})."
            ))

        checks.append(RiskCheck(
            check_name="POSITION_SIZING",
            passed=True,
            details=f"Sized {position_size} units (${risk_amount:,.2f} cash at risk = {self.max_risk_pct*100}% equity)."
        ))

        if rejections:
            return self._build_rejection(decision, account_equity, checks, rejections)

        # Approved: update sized parameters in decision
        approved_decision = decision.model_copy(update={
            "position_size": position_size,
            "risk_amount": risk_amount,
            "risk_reward_ratio": rr_ratio,
        })

        return RiskAssessment(
            status=RiskStatus.APPROVED,
            decision=approved_decision,
            account_equity=account_equity,
            risk_amount=risk_amount,
            risk_percentage=round((risk_amount / account_equity) * 100.0, 2),
            calculated_position_size=position_size,
            stop_distance=round(stop_distance, 2),
            stop_distance_pct=round(stop_dist_pct * 100.0, 2),
            reward_distance=round(reward_distance, 2),
            risk_reward_ratio=rr_ratio,
            checks=checks,
            rejection_reasons=[],
        )

    def _build_rejection(
        self,
        decision: TradeDecision,
        account_equity: float,
        checks: List[RiskCheck],
        rejections: List[str]
    ) -> RiskAssessment:
        vetoed_decision = decision.model_copy(update={
            "direction": TradeBias.NO_TRADE,
            "position_size": 0.0,
            "risk_amount": 0.0,
            "rationale": f"VETOED BY RISK ENGINE: {'; '.join(rejections)}"
        })

        return RiskAssessment(
            status=RiskStatus.REJECTED,
            decision=vetoed_decision,
            account_equity=account_equity,
            risk_amount=0.0,
            risk_percentage=0.0,
            calculated_position_size=0.0,
            stop_distance=0.0,
            stop_distance_pct=0.0,
            reward_distance=0.0,
            risk_reward_ratio=0.0,
            checks=checks,
            rejection_reasons=rejections,
        )
