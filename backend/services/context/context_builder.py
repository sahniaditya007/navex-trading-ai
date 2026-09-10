"""
Market Context Aggregator Service.
Assembles price data, technical indicators, microstructure metrics,
curated news, and episodic trade memory into a unified MarketContext.
"""

from typing import List, Optional
from core.schemas import MarketContext, Candle, NewsItem, MicrostructureFeatures
from services.market_data.feed import fetch_candles
from services.market_data.microstructure import extract_microstructure_features, generate_synthetic_order_book
from services.technical_analysis.indicators import (
    calculate_ema,
    calculate_rsi,
    calculate_atr,
    calculate_volatility,
    find_swings,
    identify_support_resistance,
    classify_market_structure,
)
from services.news.news_service import get_curated_news


def build_market_context(
    asset: str = "BTC/USDT",
    timeframe: str = "1h",
    custom_candles: Optional[List[Candle]] = None,
    scenario_bias: str = "BULLISH",
    prior_learnings: Optional[List[str]] = None,
    force_fallback: bool = False
) -> MarketContext:
    """
    Builds a complete, validated MarketContext.
    """
    # 1. Obtain candles
    candles = custom_candles if custom_candles else fetch_candles(
        asset=asset,
        timeframe=timeframe,
        limit=50,
        force_fallback=force_fallback
    )

    if not candles:
        raise ValueError(f"Unable to obtain candle data for asset: {asset}")

    closes = [c.close for c in candles]
    current_price = closes[-1]
    prev_price = closes[-2] if len(closes) > 1 else current_price
    recent_change_pct = round(((current_price - prev_price) / prev_price) * 100.0, 2)
    volume_24h = round(sum(c.volume for c in candles[-24:]), 2) if len(candles) >= 24 else round(sum(c.volume for c in candles), 2)

    # 2. Technical Indicators
    ema_20 = calculate_ema(closes, 20) or current_price
    ema_50 = calculate_ema(closes, 50) or current_price
    ema_200 = calculate_ema(closes, 200)  # May be None if < 200 bars
    rsi = calculate_rsi(closes, 14)
    atr = calculate_atr(candles, 14)
    volatility = calculate_volatility(closes, 20)

    # 3. Market Structure & S/R
    swing_highs, swing_lows = find_swings(candles, window=3)
    supports, resistances = identify_support_resistance(current_price, swing_highs, swing_lows, candles)
    trend, market_structure = classify_market_structure(
        current_price=current_price,
        ema_20=ema_20,
        ema_50=ema_50,
        ema_200=ema_200,
        resistances=resistances,
        supports=supports,
        rsi=rsi,
    )

    # 4. Microstructure Features (Adapted from Crypto-Pilot iceberg detector)
    synthetic_book = generate_synthetic_order_book(current_price, bias=trend)
    microstructure = extract_microstructure_features(synthetic_book)

    # 5. News & Context
    news_items = get_curated_news(
        asset=asset,
        scenario="REPLAY" if custom_candles else scenario_bias,
    )

    return MarketContext(
        asset=asset,
        timeframe=timeframe,
        current_price=current_price,
        recent_price_change_pct=recent_change_pct,
        volume_24h=volume_24h,
        trend=trend,
        ema_20=ema_20,
        ema_50=ema_50,
        ema_200=ema_200,
        rsi=rsi,
        atr=atr,
        volatility=volatility,
        recent_swing_highs=swing_highs,
        recent_swing_lows=swing_lows,
        support_levels=supports,
        resistance_levels=resistances,
        market_structure=market_structure,
        microstructure=microstructure,
        recent_news=news_items,
        prior_learnings=prior_learnings or [],
        candles=candles,
    )
