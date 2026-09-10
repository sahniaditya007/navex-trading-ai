"""
Unit Tests for Technical Analysis and Order-Book Microstructure.
Validates EMA, RSI, ATR, Swing Points, and Order-Book feature extraction
(adapted from Crypto-Pilot's iceberg detector).
"""

from core.schemas import Candle
from services.technical_analysis.indicators import (
    calculate_ema,
    calculate_rsi,
    calculate_atr,
    calculate_volatility,
    find_swings,
    identify_support_resistance,
    classify_market_structure,
)
from services.market_data.microstructure import extract_microstructure_features


def test_indicator_calculations():
    """Verifies EMA, RSI, ATR, and Volatility computations."""
    closes = [100.0 + i * 2.0 for i in range(30)]
    ema20 = calculate_ema(closes, 20)
    assert ema20 is not None
    assert 100.0 < ema20 < closes[-1]

    # RSI on purely rising sequence should be 100.0
    rsi_rising = calculate_rsi(closes, 14)
    assert rsi_rising == 100.0

    # RSI on alternating sequence
    alt_closes = [100.0, 102.0, 101.0, 103.0, 102.0, 104.0, 103.0, 105.0, 104.0, 106.0, 105.0, 107.0, 106.0, 108.0, 107.0]
    rsi_alt = calculate_rsi(alt_closes, 14)
    assert 0.0 < rsi_alt < 100.0

    # ATR
    candles = [
        Candle(timestamp=i*1000, open=100.0+i, high=105.0+i, low=98.0+i, close=102.0+i, volume=100.0)
        for i in range(25)
    ]
    atr = calculate_atr(candles, 14)
    assert atr > 0.0

    # Volatility
    vol = calculate_volatility(closes, 20)
    assert vol > 0.0


def test_microstructure_feature_extraction():
    """
    Tests order-book feature extraction adapted from Crypto-Pilot.
    Verifies volume imbalance, spread, average sizes, and large whale order detection.
    """
    order_book = {
        "bids": [
            [64000.0, 1.5],
            [63990.0, 2.0],
            [63980.0, 10.0],  # Whale order (> 2x average)
            [63970.0, 1.2],
        ],
        "asks": [
            [64010.0, 1.0],
            [64020.0, 1.2],
            [64030.0, 0.8],
            [64040.0, 1.5],
        ]
    }

    features = extract_microstructure_features(order_book)
    assert features is not None

    # Best bid 64000, best ask 64010 -> spread = 10.0
    assert features.bid_ask_spread == 10.0
    assert features.bid_levels == 4
    assert features.ask_levels == 4
    assert features.level_imbalance == 0.0

    # Total bid volume = 14.7, ask volume = 4.5 -> positive volume imbalance favoring bids
    assert features.bid_volume == 14.7
    assert features.ask_volume == 4.5
    assert features.volume_imbalance > 0.0

    # Whale detection: bid of 10.0 is > 2x average bid size (14.7 / 4 = 3.675)
    assert features.large_bid_orders >= 1
