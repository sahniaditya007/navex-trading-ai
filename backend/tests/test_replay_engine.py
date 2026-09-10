"""
Unit Tests for Historical Replay Engine.
Validates scenario loading, candle slicing, bar-by-bar step progression,
and completion state detection.
"""

from simulation.replay_engine import ReplayEngine


def test_replay_scenarios_loading():
    """Verifies that predefined scenarios load with valid descriptions and bars."""
    scenarios = ["BTC_BULL_BREAKOUT", "BTC_BEAR_BREAKDOWN", "BTC_FAILED_BREAKOUT"]

    for sc in scenarios:
        engine = ReplayEngine(sc)
        info = engine.load_scenario(sc)
        assert info["scenario_id"] == sc
        assert info["total_bars"] > 10
        assert info["current_price"] > 0
        assert len(engine.get_visible_candles()) == engine.initial_window


def test_replay_step_progression():
    """Verifies that advance_bar increments simulation index and detects completion."""
    engine = ReplayEngine("BTC_FAILED_BREAKOUT")
    initial_idx = engine.current_index
    total = len(engine.all_candles)

    candle, is_finished = engine.advance_bar()
    assert engine.current_index == initial_idx + 1
    assert candle.close > 0

    # Advance to end
    while engine.has_next_bar():
        candle, is_finished = engine.advance_bar()

    assert is_finished is True
    assert engine.current_index == total

    # Reset
    engine.reset()
    assert engine.current_index == engine.initial_window
