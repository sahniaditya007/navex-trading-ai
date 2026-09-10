export type TradeBias = 'LONG' | 'SHORT' | 'NO_TRADE';

export type RiskStatus = 'APPROVED' | 'REJECTED';

export type OrderStatus = 'PENDING' | 'FILLED' | 'OPEN' | 'CLOSED' | 'REJECTED' | 'CANCELLED';

export type ClosureReason = 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL_CLOSE' | 'TIMEOUT' | 'INVALIDATED';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  headline: string;
  source: string;
  published_at: string;
  summary: string;
  relevance: string;
  sentiment_hint?: string;
}

export interface MicrostructureFeatures {
  avg_bid_price: number;
  avg_ask_price: number;
  avg_bid_size: number;
  avg_ask_size: number;
  bid_ask_spread: number;
  bid_size_std: number;
  ask_size_std: number;
  bid_volume: number;
  ask_volume: number;
  volume_imbalance: number;
  bid_levels: number;
  ask_levels: number;
  level_imbalance: number;
  large_bid_orders: number;
  large_ask_orders: number;
}

export interface MarketContext {
  asset: string;
  timeframe: string;
  current_price: number;
  recent_price_change_pct: number;
  volume_24h: number;
  trend: string;
  ema_20: number;
  ema_50: number;
  ema_200?: number;
  rsi: number;
  atr: number;
  volatility: number;
  recent_swing_highs: number[];
  recent_swing_lows: number[];
  support_levels: number[];
  resistance_levels: number[];
  market_structure: string;
  microstructure?: MicrostructureFeatures;
  recent_news: NewsItem[];
  prior_learnings: string[];
  candles: Candle[];
}

export interface TradeThesis {
  bias: TradeBias;
  confidence: number;
  thesis: string;
  market_structure: string;
  catalysts: string[];
  supporting_factors: string[];
  conflicting_factors: string[];
  key_levels: Record<string, number>;
  invalidation_condition: string;
  entry_reason: string;
  stop_loss_reason: string;
  take_profit_reason: string;
  risk_considerations: string[];
  assumptions: string[];
}

export interface TradeDecision {
  direction: TradeBias;
  entry: number;
  stop_loss: number;
  take_profit: number;
  position_size: number;
  risk_amount: number;
  risk_reward_ratio: number;
  invalidation_condition: string;
  confidence: number;
  rationale: string;
}

export interface RiskCheck {
  check_name: string;
  passed: boolean;
  details: string;
}

export interface RiskAssessment {
  status: RiskStatus;
  decision: TradeDecision;
  account_equity: number;
  risk_amount: number;
  risk_percentage: number;
  calculated_position_size: number;
  stop_distance: number;
  stop_distance_pct: number;
  reward_distance: number;
  risk_reward_ratio: number;
  checks: RiskCheck[];
  rejection_reasons: string[];
}

export interface SimulatedPosition {
  id: string;
  asset: string;
  direction: TradeBias;
  entry_target: number;
  fill_price: number;
  stop_loss: number;
  take_profit: number;
  quantity: number;
  notional_value: number;
  status: OrderStatus;
  opened_at: string;
  closed_at?: string;
  closure_reason?: ClosureReason;
  exit_price?: number;
  current_price: number;
  gross_pnl: number;
  fees: number;
  slippage_cost: number;
  net_pnl: number;
  return_pct: number;
  thesis?: TradeThesis;
}

export interface TradeOutcome {
  position_id: string;
  asset: string;
  direction: TradeBias;
  entry_price: number;
  exit_price: number;
  quantity: number;
  gross_pnl: number;
  fees: number;
  net_pnl: number;
  return_pct: number;
  closure_reason: ClosureReason;
  duration_bars: number;
  opened_at: string;
  closed_at: string;
  original_thesis: TradeThesis;
}

export interface PostTradeReview {
  trade_id: string;
  outcome: string;
  thesis_correct: boolean;
  execution_quality: string;
  what_worked: string;
  what_failed: string;
  why: string;
  risk_management_assessment: string;
  missed_signals: string[];
  lessons_learned: string[];
  recommended_change: string;
  confidence_in_review: number;
  original_thesis?: TradeThesis;
}

export interface PortfolioState {
  initial_balance: number;
  cash: number;
  equity: number;
  margin_used: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  active_positions: SimulatedPosition[];
  closed_positions: SimulatedPosition[];
  equity_history: Array<{ timestamp?: number; equity: number; cash?: number }>;
}

export interface ReplayScenarioInfo {
  id: string;
  name: string;
  description: string;
  expected_outcome: string;
  total_bars: number;
  initial_visible_bars: number;
}

export interface StepReplayResponse {
  status: string;
  current_bar: number;
  total_bars: number;
  is_finished: boolean;
  candle: Candle;
  market_context: MarketContext;
  portfolio: PortfolioState;
  closed_events: Array<{
    position: SimulatedPosition;
    outcome: TradeOutcome;
    review: PostTradeReview;
  }>;
}

export interface ReplayStartResponse {
  scenario_info: ReplayScenarioInfo;
  market_context: MarketContext;
  portfolio: PortfolioState;
}

export interface MemoryData {
  prior_learnings: string[];
  recent_reviews: PostTradeReview[];
}
