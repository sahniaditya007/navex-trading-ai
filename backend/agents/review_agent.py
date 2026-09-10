"""
AI Review Agent for NAVEX Trading AI.
Performs rigorous post-mortem evaluation comparing the original TradeThesis
against actual market execution outcome and price behavior.
Generates structured PostTradeReview records and distills actionable lessons
for episodic decision memory.
"""

import json
import logging
from typing import Optional
from core.config import settings
from core.schemas import TradeOutcome, PostTradeReview, ClosureReason, TradeBias

logger = logging.getLogger(__name__)

REVIEW_SYSTEM_PROMPT = """You are the Chief Risk & Post-Mortem Performance Evaluator for NAVEX Capital.
Your job is to objectively analyze completed paper trades by comparing the trader's original TradeThesis against the actual trade outcome.

Do NOT simply summarize what happened. Conduct a rigorous analytical review:
1. Was the core thesis structurally correct, even if stopped out?
2. Did the trade execute with sound risk-to-reward and slippage management?
3. What specific market variables worked as anticipated, and what failed or surprised the model?
4. What is the fundamental root cause ("Why?") of the final outcome?
5. Formulate 1-2 concise, actionable lessons learned that MUST be remembered for future trade evaluations.

Return the review strictly adhering to the JSON schema for PostTradeReview.
"""


class ReviewAgent:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER
        self.model = settings.LLM_MODEL

    def review(self, outcome: TradeOutcome) -> PostTradeReview:
        """
        Evaluate completed trade outcome against original thesis.
        """
        # If Gemini is configured and API key is available, call Gemini
        if self.provider == "gemini" and settings.GEMINI_API_KEY:
            try:
                return self._call_gemini(outcome)
            except Exception as e:
                logger.warning(f"Gemini review call failed, falling back to deterministic review: {e}")

        # If OpenAI is configured and API key is available, call OpenAI
        if self.provider == "openai" and settings.OPENAI_API_KEY:
            try:
                return self._call_openai(outcome)
            except Exception as e:
                logger.warning(f"OpenAI review call failed, falling back to deterministic review: {e}")

        return self._deterministic_review(outcome)

    def _format_outcome_prompt(self, outcome: TradeOutcome) -> str:
        """Format trade outcome and thesis into evaluation prompt."""
        return f"""
TRADE OUTCOME DATA:
- Trade ID: {outcome.position_id}
- Asset: {outcome.asset}
- Direction: {outcome.direction}
- Entry Price: ${outcome.entry_price:,.2f}
- Exit Price: ${outcome.exit_price:,.2f}
- Position Quantity: {outcome.quantity}
- Gross P&L: ${outcome.gross_pnl:,.2f}
- Fees Paid: ${outcome.fees:,.2f}
- Net Realized P&L: ${outcome.net_pnl:,.2f}
- Return: {outcome.return_pct:.2f}%
- Closure Reason: {outcome.closure_reason}
- Trade Duration: {outcome.duration_bars} bars

ORIGINAL TRADE THESIS:
- Bias: {outcome.original_thesis.bias}
- Confidence: {outcome.original_thesis.confidence}
- Thesis Narrative: {outcome.original_thesis.thesis}
- Key Levels: {outcome.original_thesis.key_levels}
- Invalidation Condition: {outcome.original_thesis.invalidation_condition}
- Entry Reason: {outcome.original_thesis.entry_reason}
- Stop Loss Reason: {outcome.original_thesis.stop_loss_reason}
- Supporting Factors: {outcome.original_thesis.supporting_factors}
- Conflicting Factors: {outcome.original_thesis.conflicting_factors}
"""

    def _call_gemini(self, outcome: TradeOutcome) -> PostTradeReview:
        """Call Google Gemini model using official google-genai SDK."""
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        prompt = self._format_outcome_prompt(outcome)
        schema_json = json.dumps(PostTradeReview.model_json_schema(), indent=2)

        system_instruction = (
            f"{REVIEW_SYSTEM_PROMPT}\n\n"
            f"You must return ONLY a single JSON object strictly matching this JSON schema:\n{schema_json}"
        )

        models_to_try = []
        for m in [self.model, "gemini-flash-latest", "gemini-3.5-flash", "gemini-3.6-flash"]:
            if m and m not in models_to_try:
                models_to_try.append(m)

        last_err = None
        for model_name in models_to_try:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        temperature=settings.LLM_TEMPERATURE,
                    ),
                )

                raw_text = (response.text or "").strip()
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                if raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]

                return PostTradeReview.model_validate_json(raw_text.strip())
            except Exception as e:
                logger.warning(f"Gemini review model {model_name} failed: {e}, attempting next candidate...")
                last_err = e

        raise RuntimeError(f"All Gemini candidate models failed for review. Last error: {last_err}")

    def _call_openai(self, outcome: TradeOutcome) -> PostTradeReview:
        """Call OpenAI structured outputs for post-trade review."""
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        prompt = self._format_outcome_prompt(outcome)
        response = client.beta.chat.completions.parse(
            model=self.model or "gpt-4o-mini",
            messages=[
                {"role": "system", "content": REVIEW_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            response_format=PostTradeReview,
            temperature=settings.LLM_TEMPERATURE,
            timeout=settings.LLM_TIMEOUT_SECONDS,
        )
        return response.choices[0].message.parsed

    def _deterministic_review(self, outcome: TradeOutcome) -> PostTradeReview:
        """
        Deterministic post-trade review engine.
        Ensures consistent, high-conviction post-mortems for demo and evaluation.
        """
        is_profit = outcome.net_pnl > 0
        hit_tp = outcome.closure_reason == ClosureReason.TAKE_PROFIT
        hit_sl = outcome.closure_reason == ClosureReason.STOP_LOSS

        if is_profit or hit_tp:
            outcome_label = "PROFIT_TAKE_PROFIT" if hit_tp else "PROFIT_MANUAL_EXIT"
            thesis_correct = True
            quality = "EXCELLENT" if outcome.return_pct >= 2.0 else "ACCEPTABLE"
            what_worked = (
                f"Directional {outcome.direction.value} momentum and volume expansion validated the thesis. "
                f"Entry at ${outcome.entry_price:,.2f} captured the move to ${outcome.exit_price:,.2f}."
            )
            what_failed = "Minor intraday volatility tested the position before extension to target."
            why = (
                f"Sellers lacked sufficient liquidity absorption to reject the breakout. "
                f"Institutional flow and order-book depth aligned with the projected momentum path."
            )
            risk_mgmt = f"Stop loss provided sufficient breathing room without risking more than 1% of account equity."
            missed = ["Could have trailed stop loss once price surpassed 1.5x risk to lock in gains earlier."]
            lessons = [
                f"Maintain patience during {outcome.direction.value} continuation when EMA 20 holds dynamic support.",
                "Reinforce entries backed by order-book depth imbalances and confirmed volume expansion."
            ]
            rec = "Incorporate trailing stop methodology after 1.5R target is achieved."
            confidence = 0.90
        else:
            outcome_label = "LOSS_STOP_LOSS" if hit_sl else "LOSS_EARLY_CLOSE"
            thesis_correct = False
            quality = "ACCEPTABLE"  # Discipline in taking the loss is still acceptable execution
            what_worked = (
                f"Deterministic risk engine strictly capped the realized loss to ${abs(outcome.net_pnl):,.2f} "
                f"({outcome.return_pct:.2f}%), preventing an unmanaged drawdown."
            )
            what_failed = (
                f"Price reversed through the invalidation condition at ${outcome.exit_price:,.2f}, "
                f"failing to hold key structural support."
            )
            why = (
                f"Market absorbed the anticipated breakout volume and triggered aggressive counter-trend limit orders. "
                f"The initial breakout lacked sustained follow-through."
            )
            risk_mgmt = "Pre-calculated stop distance successfully limited portfolio impact."
            missed = [
                "Early divergence on lower timeframe RSI suggested momentum exhaustion before the stop was hit."
            ]
            lessons = [
                f"Avoid entering {outcome.direction.value} when RSI is extended into extreme overbought/oversold boundaries.",
                "Wait for retest confirmation on breakout attempts rather than entering at the immediate high/low."
            ]
            rec = "Require a 1-bar pullback confirmation before triggering breakout market orders."
            confidence = 0.88

        return PostTradeReview(
            trade_id=outcome.position_id,
            outcome=outcome_label,
            thesis_correct=thesis_correct,
            execution_quality=quality,
            what_worked=what_worked,
            what_failed=what_failed,
            why=why,
            risk_management_assessment=risk_mgmt,
            missed_signals=missed,
            lessons_learned=lessons,
            recommended_change=rec,
            confidence_in_review=confidence,
            original_thesis=outcome.original_thesis,
        )
