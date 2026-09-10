"""
Technical Analysis Service.
Pure Python / NumPy indicator calculations.
Does not depend on broken or unmaintained third-party TA libraries.
Provides EMAs, RSI, ATR, Volatility, Swing Levels, Support/Resistance, and Market Structure.
"""

from typing import List, Dict, Optional, Tuple
from core.schemas import Candle


def calculate_ema(closes: List[float], period: int) -> Optional[float]:
    """Calculate Exponential Moving Average for a given period."""
    if not closes:
        return None
    if period >= 100 and len(closes) < period:
        return None
    if len(closes) < period:
        return round(sum(closes) / len(closes), 2)

    k = 2.0 / (period + 1)
    ema = sum(closes[:period]) / period
    for price in closes[period:]:
        ema = (price * k) + (ema * (1.0 - k))
    return round(ema, 2)




def calculate_rsi(closes: List[float], period: int = 14) -> float:
    """Calculate Relative Strength Index (RSI) using Wilder's smoothing."""
    if len(closes) < period + 1:
        return 50.0

    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [max(d, 0.0) for d in deltas]
    losses = [max(-d, 0.0) for d in deltas]

    # Initial averages
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0.0:
        return 100.0 if avg_gain > 0 else 50.0

    rs = avg_gain / avg_loss
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return round(rsi, 2)


def calculate_atr(candles: List[Candle], period: int = 14) -> float:
    """Calculate Average True Range (ATR)."""
    if len(candles) < 2:
        return 0.0

    true_ranges: List[float] = []
    for i in range(1, len(candles)):
        current = candles[i]
        prev_close = candles[i - 1].close
        tr = max(
            current.high - current.low,
            abs(current.high - prev_close),
            abs(current.low - prev_close),
        )
        true_ranges.append(tr)

    if len(true_ranges) < period:
        return round(sum(true_ranges) / len(true_ranges), 2)

    # Wilder smoothing
    atr = sum(true_ranges[:period]) / period
    for tr in true_ranges[period:]:
        atr = (atr * (period - 1) + tr) / period
    return round(atr, 2)


def calculate_volatility(closes: List[float], lookback: int = 20) -> float:
    """Calculate annualized or percentage volatility from returns."""
    if len(closes) < 2:
        return 0.0

    sample = closes[-lookback:] if len(closes) >= lookback else closes
    returns = [(sample[i] - sample[i - 1]) / sample[i - 1] for i in range(1, len(sample))]
    if not returns:
        return 0.0

    mean_ret = sum(returns) / len(returns)
    variance = sum((r - mean_ret) ** 2 for r in returns) / len(returns)
    std_dev = variance ** 0.5
    return round(std_dev * 100.0, 3)  # Volatility in %


def find_swings(candles: List[Candle], window: int = 5) -> Tuple[List[float], List[float]]:
    """Identify recent local swing highs and swing lows."""
    if len(candles) < window * 2 + 1:
        # Fallback to simple min/max
        highs = [c.high for c in candles]
        lows = [c.low for c in candles]
        return ([round(max(highs), 2)] if highs else [], [round(min(lows), 2)] if lows else [])

    swing_highs: List[float] = []
    swing_lows: List[float] = []

    for i in range(window, len(candles) - window):
        current = candles[i]
        is_high = all(current.high >= candles[i + j].high for j in range(-window, window + 1) if j != 0)
        is_low = all(current.low <= candles[i + j].low for j in range(-window, window + 1) if j != 0)

        if is_high:
            swing_highs.append(round(current.high, 2))
        if is_low:
            swing_lows.append(round(current.low, 2))

    # Keep most recent 5
    return swing_highs[-5:], swing_lows[-5:]


def identify_support_resistance(
    current_price: float,
    swing_highs: List[float],
    swing_lows: List[float],
    candles: List[Candle]
) -> Tuple[List[float], List[float]]:
    """
    Cluster swing levels into actionable support and resistance tiers.
    """
    all_levels = swing_highs + swing_lows
    if not all_levels and candles:
        all_levels = [c.high for c in candles[-20:]] + [c.low for c in candles[-20:]]

    supports = sorted([round(lvl, 2) for lvl in set(all_levels) if lvl < current_price], reverse=True)[:3]
    resistances = sorted([round(lvl, 2) for lvl in set(all_levels) if lvl > current_price])[:3]

    # If no levels above or below, generate psychological / ATR buffer levels
    if not supports:
        supports = [round(current_price * 0.98, 2), round(current_price * 0.95, 2)]
    if not resistances:
        resistances = [round(current_price * 1.02, 2), round(current_price * 1.05, 2)]

    return supports, resistances


def classify_market_structure(
    current_price: float,
    ema_20: float,
    ema_50: float,
    ema_200: Optional[float],
    resistances: List[float],
    supports: List[float],
    rsi: float
) -> Tuple[str, str]:
    """
    Determine trend and structural condition.
    Returns: (trend: "BULLISH"|"BEARISH"|"SIDEWAYS", market_structure: str)
    """
    near_resistance = bool(resistances and (resistances[0] - current_price) / current_price < 0.01)
    near_support = bool(supports and (current_price - supports[0]) / current_price < 0.01)

    if ema_200 and ema_50 and ema_200 != ema_50:
        bullish_alignment = current_price > ema_20 >= ema_50 > ema_200
        bearish_alignment = current_price < ema_20 <= ema_50 < ema_200
    elif ema_50 and ema_20 != ema_50:
        bullish_alignment = current_price > ema_20 >= ema_50
        bearish_alignment = current_price < ema_20 <= ema_50
    else:
        bullish_alignment = current_price > ema_20
        bearish_alignment = current_price < ema_20

    # Also detect structural breakout above resistance
    if resistances and current_price >= resistances[0]:
        bullish_alignment = True
    elif supports and current_price <= supports[0]:
        bearish_alignment = True

    if bullish_alignment:
        trend = "BULLISH"
        if (near_resistance or (resistances and current_price >= resistances[0])) and rsi > 55:
            structure = "BREAKOUT_POTENTIAL"
        else:
            structure = "BULLISH_TREND"
    elif bearish_alignment:
        trend = "BEARISH"
        if (near_support or (supports and current_price <= supports[0])) and rsi < 45:
            structure = "BREAKDOWN_POTENTIAL"
        else:
            structure = "BEARISH_TREND"
    else:
        trend = "SIDEWAYS"
        structure = "RANGE_BOUND"


    return trend, structure
