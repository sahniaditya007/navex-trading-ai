"""
Historical Scenario Replay Engine for NAVEX Trading AI.
Provides deterministic, bar-by-bar market simulation for evaluators.
Guarantees a 100% reliable, repeatable live interview demo without
depending on external exchange APIs or live price movements.
"""

from typing import List, Dict, Optional, Tuple, Any
from core.schemas import Candle


def _generate_scenario_bars(scenario_id: str) -> Tuple[List[Candle], str, int]:
    """
    Generates candle sequence for predefined evaluation scenarios.
    Prepends realistic warmup bars so indicators (EMA20, EMA50, RSI) have established context.
    Returns: (candles, description, initial_window)
    """
    base_ts = 1715000000000
    step_ts = 3600 * 1000

    if scenario_id == "BTC_BULL_BREAKOUT":
        description = "BTC/USDT Bullish Breakout above $64,200 resistance to $66,200 target."
        warmup = [
            (62800, 62950, 62750, 62900, 950),
            (62900, 63000, 62780, 62820, 1020),
            (62820, 63100, 62800, 63050, 1150),
            (63050, 63150, 62920, 62960, 980),
            (62960, 63250, 62900, 63180, 1250),
            (63180, 63220, 63000, 63080, 1100),
            (63080, 63350, 63020, 63290, 1300),
            (63290, 63400, 63150, 63200, 1050),
            (63200, 63500, 63180, 63450, 1400),
            (63450, 63520, 63300, 63350, 1120),
            (63350, 63650, 63300, 63580, 1500),
            (63580, 63650, 63420, 63480, 1200),
            (63480, 63650, 63400, 63500, 1400),
            (63500, 63580, 63380, 63420, 1100),
            (63420, 63600, 63380, 63550, 1300),
            (63550, 63620, 63450, 63480, 1050),
        ]
        event_bars = [
            (63480, 63700, 63450, 63650, 1100),
            (63650, 63750, 63520, 63580, 1050),
            (63580, 63850, 63550, 63800, 1250),
            (63800, 63880, 63680, 63720, 1150),
            # Breakout bar (Entry around $64,180)
            (63720, 64250, 63700, 64180, 2900),
            # Upward extension
            (64180, 64650, 64100, 64550, 2200),
            (64550, 65100, 64450, 64950, 2600),
            (64950, 65450, 64850, 65350, 2100),
            (65350, 65800, 65200, 65700, 3100),
            (65700, 66100, 65550, 66050, 2900),
            # Target reached: High 66,350 triggers TP at 66,000
            (66050, 66350, 65900, 66250, 3500),
            (66250, 66500, 66100, 66400, 1800),
        ]
        initial_window = len(warmup) + 5  # Start on breakout bar


    elif scenario_id == "BTC_BEAR_BREAKDOWN":
        description = "BTC/USDT Bearish Breakdown below $60,000 support to $58,200 demand zone."
        warmup = [
            (61800, 61950, 61700, 61750, 1100),
            (61750, 61850, 61600, 61780, 950),
            (61780, 61800, 61500, 61550, 1200),
            (61550, 61700, 61480, 61620, 1050),
            (61620, 61650, 61350, 61400, 1300),
            (61400, 61520, 61320, 61450, 1000),
            (61450, 61480, 61180, 61220, 1400),
            (61220, 61350, 61150, 61280, 1150),
            (61280, 61300, 61000, 61050, 1500),
            (61050, 61180, 60950, 61100, 1250),
            (61100, 61150, 60800, 60880, 1600),
            (60880, 60980, 60750, 60820, 1300),
            (60820, 60850, 60550, 60600, 1750),
            (60600, 60720, 60500, 60650, 1400),
            (60650, 60680, 60350, 60420, 1800),
        ]
        event_bars = [
            (60420, 60550, 60250, 60300, 1200),
            (60300, 60400, 60050, 60100, 1600),
            # Breakdown bar (Entry short ~59,800)
            (60100, 60150, 59750, 59800, 3100),
            (59800, 59900, 59350, 59400, 2700),
            (59400, 59550, 59000, 59100, 2400),
            (59100, 59250, 58650, 58750, 3100),
            (58750, 58900, 58300, 58400, 3300),
            # Target hit (Low 58,050 triggers TP at 58,200)
            (58400, 58500, 58050, 58150, 3800),
            (58150, 58400, 58100, 58300, 2100),
        ]
        initial_window = len(warmup) + 3  # Start on breakdown bar

    else:  # BTC_FAILED_BREAKOUT (Stop Loss demonstration)
        scenario_id = "BTC_FAILED_BREAKOUT"
        description = "BTC/USDT Failed Breakout Bull Trap. Hits Stop Loss and verifies risk guardrails."
        warmup = [
            (63500, 63650, 63450, 63600, 950),
            (63600, 63700, 63480, 63520, 1020),
            (63520, 63800, 63500, 63750, 1150),
            (63750, 63850, 63620, 63660, 980),
            (63660, 63950, 63600, 63880, 1250),
            (63880, 63920, 63700, 63780, 1100),
            (63780, 64050, 63720, 63990, 1300),
            (63990, 64100, 63850, 63900, 1050),
            (63900, 64200, 63880, 64150, 1400),
            (64150, 64220, 64000, 64050, 1120),
            (64050, 64350, 64000, 64280, 1500),
            (64280, 64350, 64120, 64180, 1200),
            (64180, 64480, 64150, 64420, 1600),
            (64420, 64500, 64250, 64320, 1250),
            (64320, 64620, 64300, 64550, 1700),
        ]
        event_bars = [
            # Bull trap spike (Entry long ~64,750, SL at 63,900)
            (64550, 64850, 64450, 64750, 2400),
            (64750, 64800, 64300, 64350, 3100),  # Immediate rejection
            (64350, 64400, 64050, 64100, 2800),
            # Flush through stop loss at 63,900
            (64100, 64150, 63800, 63850, 4200),
            (63850, 64000, 63700, 63900, 1900),
        ]
        initial_window = len(warmup) + 1  # Start on bull trap bar

    combined = warmup + event_bars
    candles: List[Candle] = []
    for i, (o, h, l, c, v) in enumerate(combined):
        candles.append(Candle(
            timestamp=base_ts + (i * step_ts),
            open=float(o),
            high=float(h),
            low=float(l),
            close=float(c),
            volume=float(v),
        ))

    return candles, description, initial_window


class ReplayEngine:
    def __init__(self, default_scenario: str = "BTC_BULL_BREAKOUT"):
        self.scenario_id = default_scenario
        self.all_candles, self.description, self.initial_window = _generate_scenario_bars(default_scenario)
        self.current_index = self.initial_window

    def load_scenario(self, scenario_id: str) -> Dict[str, Any]:
        """Loads a predefined scenario."""
        self.scenario_id = scenario_id
        self.all_candles, self.description, self.initial_window = _generate_scenario_bars(scenario_id)
        self.current_index = self.initial_window
        return {
            "scenario_id": self.scenario_id,
            "description": self.description,
            "total_bars": len(self.all_candles),
            "current_bar": self.current_index,
            "current_price": self.get_current_candle().close,
        }

    def get_visible_candles(self) -> List[Candle]:
        """Returns the candles visible up to current simulation index."""
        return self.all_candles[:self.current_index]

    def get_current_candle(self) -> Candle:
        """Returns the most recent visible candle."""
        return self.all_candles[self.current_index - 1]

    def has_next_bar(self) -> bool:
        return self.current_index < len(self.all_candles)

    def advance_bar(self) -> Tuple[Candle, bool]:
        """
        Advances the replay simulation by one bar.
        Returns: (new_current_candle, is_finished)
        """
        if self.has_next_bar():
            self.current_index += 1

        is_finished = not self.has_next_bar()
        return self.get_current_candle(), is_finished

    def reset(self) -> None:
        self.current_index = self.initial_window
