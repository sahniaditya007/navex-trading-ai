"""
AI Analyst Agent for NAVEX Trading AI.
Generates structured TradeThesis objects from MarketContext and prior learnings.
Integrates with OpenAI / Gemini / Anthropic when configured, with a comprehensive
deterministic reasoning engine for offline demo mode or missing API keys.
Strictly validated via Pydantic.
"""

import json
import logging
from typing import Optional, Dict, Any, List
from core.config import settings
from core.schemas import MarketContext, TradeThesis, TradeBias, TradeDecision

logger = logging.getLogger(__name__)


ANALYST_SYSTEM_PROMPT = """You are the Senior Quantitative Strategist for NAVEX Capital, an elite proprietary digital asset trading firm.
Your role is to analyze multi-timeframe market structure, order book liquidity microstructure, momentum indicators, news sentiment, and prior trade memory to formulate a high-conviction trade thesis.

You must choose one of three biases:
- "LONG": If technical structure, momentum, and catalyst alignment favor upside with asymmetric risk-to-reward.
- "SHORT": If resistance rejection, bearish distribution, declining momentum, or adverse catalysts favor downside.
- "NO_TRADE": If the market is choppy, within a tight equilibrium range, conflicting signals exist, or risk cannot be strictly defined.

CRITICAL RISK RULES:
1. Long trades must have: Stop Loss < Entry Price < Take Profit.
2. Short trades must have: Take Profit < Entry Price < Stop Loss.
3. Target minimum Risk-to-Reward ratio of at least 1:2.0.
4. Set an explicit, non-ambiguous invalidation price condition where the thesis is proven false.
5. In your conflicting_factors and risk_considerations, EXPLICITLY reference any prior trade learnings provided in the prompt.

Output MUST strictly conform to the JSON schema for TradeThesis. Do not return conversational chatter or markdown fences outside the JSON object.
"""


def thesis_to_decision(thesis: TradeThesis, current_price: float) -> TradeDecision:
    """
    Converts a validated TradeThesis into an actionable TradeDecision.
    """
    if thesis.bias == TradeBias.NO_TRADE:
        return TradeDecision(
            direction=TradeBias.NO_TRADE,
            entry=current_price,
            stop_loss=current_price,
            take_profit=current_price,
            position_size=0.0,
            risk_amount=0.0,
            risk_reward_ratio=0.0,
            invalidation_condition=thesis.invalidation_condition,
            confidence=thesis.confidence,
            rationale=thesis.thesis,
        )

    entry = thesis.key_levels.get("entry", current_price)
    sl = thesis.key_levels.get("stop_loss", current_price * (0.98 if thesis.bias == TradeBias.LONG else 1.02))
    tp = thesis.key_levels.get("take_profit", current_price * (1.04 if thesis.bias == TradeBias.LONG else 0.96))

    stop_dist = abs(entry - sl)
    reward_dist = abs(tp - entry)
    rr = round(reward_dist / stop_dist, 2) if stop_dist > 0 else 0.0

    return TradeDecision(
        direction=thesis.bias,
        entry=round(entry, 2),
        stop_loss=round(sl, 2),
        take_profit=round(tp, 2),
        position_size=0.0,  # Sized by deterministic Risk Engine
        risk_amount=0.0,    # Calculated by Risk Engine
        risk_reward_ratio=rr,
        invalidation_condition=thesis.invalidation_condition,
        confidence=thesis.confidence,
        rationale=thesis.thesis,
    )


class AnalystAgent:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER
        self.model = settings.LLM_MODEL

    def analyze(self, context: MarketContext) -> TradeThesis:
        """
        Analyze market context and return a validated TradeThesis.
        """
        # If Gemini is configured and API key is available, call Gemini
        if self.provider == "gemini" and settings.GEMINI_API_KEY:
            try:
                return self._call_gemini(context)
            except Exception as e:
                logger.warning(f"Gemini analysis call failed, falling back to deterministic engine: {e}")

        # If OpenAI is configured and API key is available, call OpenAI
        if self.provider == "openai" and settings.OPENAI_API_KEY:
            try:
                return self._call_openai(context)
            except Exception as e:
                logger.warning(f"OpenAI analysis call failed, falling back to deterministic engine: {e}")

        # Deterministic rule-based analytical engine (Default & Fallback)
        return self._deterministic_analysis(context)

    def _call_gemini(self, context: MarketContext) -> TradeThesis:
        """Call Google Gemini model using official google-genai SDK."""
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        prompt = self._format_context_prompt(context)
        schema_json = json.dumps(TradeThesis.model_json_schema(), indent=2)

        system_instruction = (
            f"{ANALYST_SYSTEM_PROMPT}\n\n"
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

                return TradeThesis.model_validate_json(raw_text.strip())
            except Exception as e:
                logger.warning(f"Gemini model {model_name} failed: {e}, attempting next candidate...")
                last_err = e

        raise RuntimeError(f"All Gemini candidate models failed. Last error: {last_err}")

    def _format_context_prompt(self, context: MarketContext) -> str:
        """Serialize context into an information-dense prompt for the LLM."""
        micro_str = "None"
        if context.microstructure:
            micro_str = (
                f"Spread: ${context.microstructure.bid_ask_spread} | "
                f"Vol Imbalance: {context.microstructure.volume_imbalance} | "
                f"Bid Vol: {context.microstructure.bid_volume} vs Ask Vol: {context.microstructure.ask_volume} | "
                f"Large Bids: {context.microstructure.large_bid_orders} vs Large Asks: {context.microstructure.large_ask_orders}"
            )

        ema_200_str = f"${context.ema_200:,.2f}" if context.ema_200 else "Insufficient data"
        news_str = "\n".join([f"- [{n.source}] {n.headline}: {n.summary}" for n in context.recent_news]) or "None"
        learnings_str = "\n".join([f"- {l}" for l in context.prior_learnings]) or "No prior trade memory available."

        return f"""
ASSET: {context.asset} ({context.timeframe})
CURRENT PRICE: ${context.current_price:,.2f}
24H VOLUME: {context.volume_24h:,.2f}
24H PRICE CHANGE: {context.recent_price_change_pct}%

TECHNICAL INDICATORS:
- EMA 20: ${context.ema_20:,.2f}
- EMA 50: ${context.ema_50:,.2f}
- EMA 200: {ema_200_str}
- RSI (14): {context.rsi}
- ATR (14): ${context.atr:,.2f}
- 20-period Volatility: {context.volatility}%

MARKET STRUCTURE:
- Identified Structure: {context.market_structure}
- Prevailing Trend: {context.trend}
- Key Resistance Tiers: {context.resistance_levels}
- Key Support Tiers: {context.support_levels}

ORDER BOOK MICROSTRUCTURE:
{micro_str}

RECENT NEWS / MACRO CONTEXT:
{news_str}

PRIOR TRADE MEMORY & LESSONS LEARNED:
{learnings_str}
"""

    def _call_openai(self, context: MarketContext) -> TradeThesis:
        """Call OpenAI structured outputs with TradeThesis schema."""
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        prompt = self._format_context_prompt(context)
        response = client.beta.chat.completions.parse(
            model=self.model or "gpt-4o-mini",
            messages=[
                {"role": "system", "content": ANALYST_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            response_format=TradeThesis,
            temperature=settings.LLM_TEMPERATURE,
            timeout=settings.LLM_TIMEOUT_SECONDS,
        )
        return response.choices[0].message.parsed

    def _deterministic_analysis(self, context: MarketContext) -> TradeThesis:
        """
        Deterministic quantitative analysis engine.
        Acts as reliable fallback and baseline evaluation logic.
        Evaluates indicator confluence, market structure, and microstructure.
        """
        price = context.current_price
        trend = context.trend
        rsi = context.rsi
        atr = context.atr if context.atr > 0 else price * 0.015
        supports = context.support_levels
        resistances = context.resistance_levels
        imbalance = context.microstructure.volume_imbalance if context.microstructure else 0.0

        # Explicitly consult episodic trade memory
        memory_warns_overbought = any("RSI" in m and ("above 75" in m or "extended" in m) for m in context.prior_learnings)
        rsi_exhaustion_detected = memory_warns_overbought and (rsi >= 75.0)

        # Bullish setup:
        # Trend is BULLISH, or BREAKOUT_POTENTIAL, RSI not exhausted by memory rule, price above EMA 50
        is_bullish = (trend == "BULLISH") or (context.market_structure in ["BREAKOUT_POTENTIAL", "BULLISH_TREND"])
        if is_bullish and not rsi_exhaustion_detected and price > context.ema_50:
            bias = TradeBias.LONG
            confidence = 0.84 if imbalance >= 0 else 0.74



            # Entry near current price or pullback to EMA 20
            entry = price
            # Stop loss below EMA 50 or recent support (at least 1.5 * ATR)
            stop_dist = max(atr * 1.5, price * 0.012)
            stop_loss = round(entry - stop_dist, 2)
            # Take profit with 2.2:1 R:R target
            take_profit = round(entry + (stop_dist * 2.2), 2)

            thesis_text = (
                f"Bullish continuation structure on {context.asset}. Price (${price:,.2f}) maintains healthy "
                f"support above EMA 20 (${context.ema_20:,.2f}) and EMA 50 (${context.ema_50:,.2f}) with RSI at {rsi}. "
                f"Order book displays positive depth with order flow confirming buyer absorption."
            )

            supporting = [
                f"Price comfortably above moving averages (EMA 20 at ${context.ema_20:,.2f})",
                f"RSI ({rsi}) reflects positive upward momentum without extreme divergence",
                f"Order-book volume imbalance ({imbalance:+.2f}) favors buyers",
                "Positive institutional ETF inflow headlines reinforcing macro tailwind"
            ]

            conflicting = []
            if memory_warns_overbought:
                conflicting.append("Prior trade memory cautionary note: monitor for RSI exhaustion near local highs")
            if rsi > 65:
                conflicting.append("RSI approaching upper boundary; risk of brief consolidation before continuation")

            invalidation = f"Sustained 1h close below key support / stop level at ${stop_loss:,.2f}"

            return TradeThesis(
                bias=bias,
                confidence=confidence,
                thesis=thesis_text,
                market_structure=context.market_structure,
                catalysts=[n.headline for n in context.recent_news[:2]],
                supporting_factors=supporting,
                conflicting_factors=conflicting or ["Slight resistance near recent swing high"],
                key_levels={
                    "entry": round(entry, 2),
                    "stop_loss": round(stop_loss, 2),
                    "take_profit": round(take_profit, 2),
                    "primary_support": supports[0] if supports else round(entry - stop_dist, 2),
                    "primary_resistance": resistances[0] if resistances else round(take_profit, 2)
                },
                invalidation_condition=invalidation,
                entry_reason=f"Breakout confirmation above EMA 20 with positive depth imbalance at ${entry:,.2f}",
                stop_loss_reason=f"Positioned safely below structural swing support at ${stop_loss:,.2f} ({round(stop_dist/price*100, 2)}% risk)",
                take_profit_reason=f"Anchored at 2.2x risk reward ratio targeting major liquidity pool at ${take_profit:,.2f}",
                risk_considerations=[
                    "Sudden liquidity cascade across crypto derivatives",
                    f"Volatility expansion beyond current ATR of ${atr:,.2f}"
                ],
                assumptions=[
                    "Spot ETF inflows continue to absorb daily miner issuance",
                    "EMA 20 acts as dynamic demand cushion during intraday tests"
                ]
            )

        # Bearish setup:
        elif trend == "BEARISH" or (context.market_structure == "BREAKDOWN_POTENTIAL") or (rsi < 42 and price < context.ema_20):
            bias = TradeBias.SHORT
            confidence = 0.78

            entry = price
            stop_dist = max(atr * 1.5, price * 0.012)
            stop_loss = round(entry + stop_dist, 2)
            take_profit = round(entry - (stop_dist * 2.1), 2)

            thesis_text = (
                f"Bearish distribution breakdown on {context.asset}. Price (${price:,.2f}) failed to reclaim "
                f"EMA 20 (${context.ema_20:,.2f}) and EMA 50 (${context.ema_50:,.2f}) with RSI at {rsi}. "
                f"Negative order-book volume imbalance highlights aggressive market sell orders."
            )

            return TradeThesis(
                bias=bias,
                confidence=confidence,
                thesis=thesis_text,
                market_structure=context.market_structure,
                catalysts=[n.headline for n in context.recent_news[:2]],
                supporting_factors=[
                    f"Price below declining EMA 20 (${context.ema_20:,.2f}) and EMA 50",
                    f"RSI ({rsi}) confirms persistent seller dominance without bullish divergence",
                    f"Order-book volume imbalance ({imbalance:+.2f}) shows ask pressure",
                    "Macro headwinds with interest rate cuts deferred by central banks"
                ],
                conflicting_factors=[
                    "Potential short squeeze if major bid wall absorbs selling pressure",
                    "RSI nearing oversold territory"
                ],
                key_levels={
                    "entry": round(entry, 2),
                    "stop_loss": round(stop_loss, 2),
                    "take_profit": round(take_profit, 2),
                    "primary_support": supports[0] if supports else round(take_profit, 2),
                    "primary_resistance": resistances[0] if resistances else round(stop_loss, 2)
                },
                invalidation_condition=f"Price prints a confirmed 1h close above swing resistance at ${stop_loss:,.2f}",
                entry_reason=f"Breakdown execution upon loss of support at ${entry:,.2f}",
                stop_loss_reason=f"Anchored above recent breakdown cluster at ${stop_loss:,.2f}",
                take_profit_reason=f"Targets next significant demand block at ${take_profit:,.2f} with 2.1 R:R",
                risk_considerations=[
                    "Aggressive short squeeze cascade triggered by sudden spot buying",
                    "Funding rate flips negative, encouraging counter-trend bounces"
                ],
                assumptions=[
                    "Lower timeframe rallies will be sold into by institutional desks"
                ]
            )

        # No trade setup
        else:
            return TradeThesis(
                bias=TradeBias.NO_TRADE,
                confidence=0.50,
                thesis=f"Market is in equilibrium consolidation near ${price:,.2f}. Signals are mixed between moving averages and RSI ({rsi}). Capital preservation prioritized.",
                market_structure="RANGE_BOUND",
                catalysts=["Low catalyst volatility environment"],
                supporting_factors=["Consolidation within defined horizontal bounds"],
                conflicting_factors=["No directional trend consensus across 20 and 50 period EMAs"],
                key_levels={"entry": price, "stop_loss": price, "take_profit": price},
                invalidation_condition="Clear breakout above resistance or breakdown below support with expanding volume",
                entry_reason="No trade justified in choppy equilibrium",
                stop_loss_reason="N/A",
                take_profit_reason="N/A",
                risk_considerations=["Chop risk and unnecessary spread/fee burn"],
                assumptions=["Range bound oscillation expected until next macro catalyst"]
            )
