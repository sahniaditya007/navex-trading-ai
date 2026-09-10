"""
Pydantic Schemas for NAVEX Trading AI.
Provides strict validation for Market Context, Trade Thesis, Risk Engine,
Execution Simulation, Post-Trade Review, and Memory Systems.
"""

from enum import Enum
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class TradeBias(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"
    NO_TRADE = "NO_TRADE"


class RiskStatus(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    FILLED = "FILLED"
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ClosureReason(str, Enum):
    TAKE_PROFIT = "TAKE_PROFIT"
    STOP_LOSS = "STOP_LOSS"
    MANUAL_CLOSE = "MANUAL_CLOSE"
    TIMEOUT = "TIMEOUT"
    INVALIDATED = "INVALIDATED"


class Candle(BaseModel):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float


class NewsItem(BaseModel):
    headline: str
    source: str
    published_at: str
    summary: str
    relevance: str = "medium"  # "high", "medium", "low"
    sentiment_hint: Optional[str] = None  # "bullish", "bearish", "neutral"


class MicrostructureFeatures(BaseModel):
    """
    Extracted from order book depth.
    Adapted from Crypto-Pilot's iceberg detector feature extraction.
    """
    avg_bid_price: float
    avg_ask_price: float
    avg_bid_size: float
    avg_ask_size: float
    bid_ask_spread: float
    bid_size_std: float
    ask_size_std: float
    bid_volume: float
    ask_volume: float
    volume_imbalance: float  # (bid_vol - ask_vol) / (bid_vol + ask_vol)
    bid_levels: int
    ask_levels: int
    level_imbalance: float
    large_bid_orders: int
    large_ask_orders: int


class MarketContext(BaseModel):
    """
    Comprehensive structured context provided to the AI Analyst.
    """
    asset: str = "BTC/USDT"
    timeframe: str = "1h"
    current_price: float
    recent_price_change_pct: float
    volume_24h: float
    trend: str  # "BULLISH", "BEARISH", "SIDEWAYS"
    ema_20: float
    ema_50: float
    ema_200: Optional[float] = None
    rsi: float
    atr: float
    volatility: float
    recent_swing_highs: List[float] = Field(default_factory=list)
    recent_swing_lows: List[float] = Field(default_factory=list)
    support_levels: List[float] = Field(default_factory=list)
    resistance_levels: List[float] = Field(default_factory=list)
    market_structure: str  # "BULLISH_TREND", "BEARISH_TREND", "RANGE_BOUND", "BREAKOUT_POTENTIAL", "BREAKDOWN_POTENTIAL"
    microstructure: Optional[MicrostructureFeatures] = None
    recent_news: List[NewsItem] = Field(default_factory=list)
    prior_learnings: List[str] = Field(default_factory=list)
    candles: List[Candle] = Field(default_factory=list)


class TradeThesis(BaseModel):
    """
    Structured reasoning output produced by the AI Analyst.
    Strictly validated: arbitrary unstructured text is disallowed as primary output.
    """
    bias: TradeBias
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0")
    thesis: str = Field(description="Primary reasoning and macroeconomic / technical narrative")
    market_structure: str = Field(description="Current structural state (e.g. Higher Highs / Lower Lows)")
    catalysts: List[str] = Field(default_factory=list, description="Events, indicators, or news driving this thesis")
    supporting_factors: List[str] = Field(default_factory=list, description="Factors supporting the trade direction")
    conflicting_factors: List[str] = Field(default_factory=list, description="Risks or contradictory signals identified")
    key_levels: Dict[str, float] = Field(
        default_factory=dict,
        description="Key levels: entry, stop_loss, take_profit, support, resistance"
    )
    invalidation_condition: str = Field(description="Specific market behavior that nullifies this thesis")
    entry_reason: str = Field(description="Rationale for entry level selection")
    stop_loss_reason: str = Field(description="Rationale for stop loss placement")
    take_profit_reason: str = Field(description="Rationale for take profit target")
    risk_considerations: List[str] = Field(default_factory=list, description="Specific identified hazards")
    assumptions: List[str] = Field(default_factory=list, description="Core assumptions made in this analysis")


class TradeDecision(BaseModel):
    """
    Actionable trade proposal converted from TradeThesis.
    """
    direction: TradeBias
    entry: float
    stop_loss: float
    take_profit: float
    position_size: float = 0.0
    risk_amount: float = 0.0
    risk_reward_ratio: float = 0.0
    invalidation_condition: str
    confidence: float
    rationale: str


class RiskCheck(BaseModel):
    check_name: str
    passed: bool
    details: str


class RiskAssessment(BaseModel):
    """
    Result of deterministic risk engine evaluation.
    Enforces risk guardrails and has final veto power over AI decisions.
    """
    status: RiskStatus
    decision: TradeDecision
    account_equity: float
    risk_amount: float
    risk_percentage: float
    calculated_position_size: float
    stop_distance: float
    stop_distance_pct: float
    reward_distance: float
    risk_reward_ratio: float
    checks: List[RiskCheck] = Field(default_factory=list)
    rejection_reasons: List[str] = Field(default_factory=list)


class SimulatedPosition(BaseModel):
    """
    Represents an open or closed paper trading position.
    """
    id: str
    asset: str
    direction: TradeBias
    entry_target: float
    fill_price: float
    stop_loss: float
    take_profit: float
    quantity: float
    notional_value: float
    status: OrderStatus
    opened_at: str
    closed_at: Optional[str] = None
    closure_reason: Optional[ClosureReason] = None
    exit_price: Optional[float] = None
    current_price: float
    gross_pnl: float = 0.0
    fees: float = 0.0
    slippage_cost: float = 0.0
    net_pnl: float = 0.0
    return_pct: float = 0.0
    thesis: Optional[TradeThesis] = None


class TradeOutcome(BaseModel):
    """
    Comprehensive record of a completed trade for AI review.
    """
    position_id: str
    asset: str
    direction: TradeBias
    entry_price: float
    exit_price: float
    quantity: float
    gross_pnl: float
    fees: float
    net_pnl: float
    return_pct: float
    closure_reason: ClosureReason
    duration_bars: int
    opened_at: str
    closed_at: str
    original_thesis: TradeThesis


class PostTradeReview(BaseModel):
    """
    Structured outcome analysis generated by the AI Review Agent.
    Compares original thesis against actual market behavior.
    """
    trade_id: str
    outcome: str  # "PROFIT_TAKE_PROFIT", "LOSS_STOP_LOSS", "MANUAL_EXIT", etc.
    thesis_correct: bool
    execution_quality: str  # "EXCELLENT", "ACCEPTABLE", "SUBOPTIMAL", "POOR"
    what_worked: str
    what_failed: str
    why: str
    risk_management_assessment: str
    missed_signals: List[str] = Field(default_factory=list)
    lessons_learned: List[str] = Field(default_factory=list)
    recommended_change: str
    confidence_in_review: float = Field(ge=0.0, le=1.0)
    original_thesis: Optional[TradeThesis] = None


class PortfolioState(BaseModel):
    initial_balance: float = 100000.0
    cash: float
    equity: float
    margin_used: float = 0.0
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    active_positions: List[SimulatedPosition] = Field(default_factory=list)
    closed_positions: List[SimulatedPosition] = Field(default_factory=list)
    equity_history: List[Dict[str, Any]] = Field(default_factory=list)


# Requests
class MarketContextRequest(BaseModel):
    asset: str = "BTC/USDT"
    timeframe: str = "1h"
    mode: str = "demo"  # "live" or "demo"


class AnalyzeRequest(BaseModel):
    context: MarketContext


class ValidateTradeRequest(BaseModel):
    decision: TradeDecision
    account_equity: Optional[float] = None


class ExecuteRequest(BaseModel):
    decision: TradeDecision
    risk_assessment: RiskAssessment
    thesis: Optional[TradeThesis] = None
    asset: str = Field(default="BTC/USDT", min_length=3, max_length=20)
    entry: Optional[float] = Field(default=None, gt=0)
    stop_loss: Optional[float] = Field(default=None, gt=0)
    take_profit: Optional[float] = Field(default=None, gt=0)
    position_size: Optional[float] = Field(default=None, gt=0)


class CloseRequest(BaseModel):
    position_id: str = Field(min_length=1, max_length=80)
    current_price: float = Field(gt=0)


class StepRequest(BaseModel):
    current_price: float
    high: Optional[float] = None
    low: Optional[float] = None
    bar_index: Optional[int] = None


class ReviewRequest(BaseModel):
    position_id: str


class ReplayStartRequest(BaseModel):
    scenario: str = "BTC_BULL_BREAKOUT"  # "BTC_BULL_BREAKOUT", "BTC_BEAR_BREAKDOWN", "BTC_FAILED_BREAKOUT"
