"""
Market Microstructure Service.
Adapted from Crypto-Pilot-AI-Models:
  - Original Path: src/iceberg/iceberg_detector.py (lines 93-134) & src/arbitrage/fetch_order_book.py
  - What was retained: bid/ask volume imbalance, spread calculations, level imbalance,
                       depth statistical features (mean, std), and large order detection.
  - What was changed: removed TensorFlow/Keras neural network dependency,
                      output typed MicrostructureFeatures schema instead of untyped list,
                      added resilient parsing and simulated depth generation.
"""

import math
from typing import Dict, List, Optional, Any
from core.schemas import MicrostructureFeatures


def extract_microstructure_features(order_book: Optional[Dict[str, Any]]) -> Optional[MicrostructureFeatures]:
    """
    Extracts structured liquidity and order-book depth features.
    Adapted from Crypto-Pilot's iceberg feature engineering logic.
    """
    if not order_book or "bids" not in order_book or "asks" not in order_book:
        return None

    try:
        raw_bids = order_book["bids"]
        raw_asks = order_book["asks"]

        if not raw_bids or not raw_asks:
            return None

        # Parse bids: [[price, qty], ...]
        bid_prices = [float(b[0]) for b in raw_bids]
        bid_sizes = [float(b[1]) for b in raw_bids]

        # Parse asks: [[price, qty], ...]
        ask_prices = [float(a[0]) for a in raw_asks]
        ask_sizes = [float(a[1]) for a in raw_asks]

        avg_bid_price = sum(bid_prices) / len(bid_prices)
        avg_ask_price = sum(ask_prices) / len(ask_prices)

        avg_bid_size = sum(bid_sizes) / len(bid_sizes)
        avg_ask_size = sum(ask_sizes) / len(ask_sizes)

        best_bid = max(bid_prices)
        best_ask = min(ask_prices)
        spread = max(0.0, best_ask - best_bid)

        # Standard deviations
        bid_size_std = _calc_std(bid_sizes, avg_bid_size)
        ask_size_std = _calc_std(ask_sizes, avg_ask_size)

        # Volumes & Imbalances
        bid_volume = sum(bid_sizes)
        ask_volume = sum(ask_sizes)
        total_vol = bid_volume + ask_volume
        volume_imbalance = (bid_volume - ask_volume) / total_vol if total_vol > 0 else 0.0

        bid_levels = len(raw_bids)
        ask_levels = len(raw_asks)
        total_levels = bid_levels + ask_levels
        level_imbalance = (bid_levels - ask_levels) / total_levels if total_levels > 0 else 0.0

        # Whale / Large order identification (> 2x average size)
        large_bid_orders = sum(1 for s in bid_sizes if s > avg_bid_size * 2.0)
        large_ask_orders = sum(1 for s in ask_sizes if s > avg_ask_size * 2.0)

        return MicrostructureFeatures(
            avg_bid_price=round(avg_bid_price, 2),
            avg_ask_price=round(avg_ask_price, 2),
            avg_bid_size=round(avg_bid_size, 4),
            avg_ask_size=round(avg_ask_size, 4),
            bid_ask_spread=round(spread, 2),
            bid_size_std=round(bid_size_std, 4),
            ask_size_std=round(ask_size_std, 4),
            bid_volume=round(bid_volume, 4),
            ask_volume=round(ask_volume, 4),
            volume_imbalance=round(volume_imbalance, 4),
            bid_levels=bid_levels,
            ask_levels=ask_levels,
            level_imbalance=round(level_imbalance, 4),
            large_bid_orders=large_bid_orders,
            large_ask_orders=large_ask_orders,
        )
    except Exception:
        return None


def generate_synthetic_order_book(current_price: float, bias: str = "NEUTRAL") -> Dict[str, List[List[float]]]:
    """
    Generates realistic order book depth for offline demo and replay modes.
    """
    spread = current_price * 0.0002  # 0.02% spread
    half_spread = spread / 2.0
    best_bid = current_price - half_spread
    best_ask = current_price + half_spread

    bids: List[List[float]] = []
    asks: List[List[float]] = []

    bid_mult = 1.3 if bias == "BULLISH" else (0.8 if bias == "BEARISH" else 1.0)
    ask_mult = 0.8 if bias == "BULLISH" else (1.3 if bias == "BEARISH" else 1.0)

    for i in range(20):
        step = (i + 1) * (current_price * 0.0003)
        b_p = round(best_bid - step, 2)
        a_p = round(best_ask + step, 2)

        # Realistic volume with occasional whale wall
        b_qty = round((0.5 + (i * 0.1) + ((i % 5 == 0) * 2.5)) * bid_mult, 4)
        a_qty = round((0.5 + (i * 0.1) + ((i % 7 == 0) * 2.5)) * ask_mult, 4)

        bids.append([b_p, b_qty])
        asks.append([a_p, a_qty])

    return {"bids": bids, "asks": asks}


def _calc_std(values: List[float], mean: float) -> float:
    if len(values) <= 1:
        return 0.0
    variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
    return math.sqrt(variance)
