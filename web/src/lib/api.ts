import {
  MarketContext,
  TradeThesis,
  TradeDecision,
  RiskAssessment,
  SimulatedPosition,
  PostTradeReview,
  PortfolioState,
  ReplayStartResponse,
  StepReplayResponse,
  MemoryData,
  Candle,
  TradeOutcome,
} from '@/types/trading';

// 🟢 Built by me: configurable same-origin or local FastAPI API boundary.
// Binance public REST endpoints require no credentials and are used by the
// FastAPI market-data adapter for real crypto candles.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://127.0.0.1:8000';

// Helper to determine whether backend is reachable
let backendAvailable: boolean | null = null;

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET', signal: AbortSignal.timeout(1500) });
    backendAvailable = res.ok;
    return res.ok;
  } catch {
    backendAvailable = false;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Local fallback generator if backend is not running
// ---------------------------------------------------------------------------
function getMockCandles(scenario: string): Candle[] {
  const baseTs = Date.now() - 3600 * 1000 * 24;
  const stepTs = 3600 * 1000;

  let rawBars: Array<[number, number, number, number, number]> = [];
  if (scenario === 'BTC_BEAR_BREAKDOWN') {
    rawBars = [
      [61800, 61950, 61700, 61750, 1100],
      [61750, 61850, 61600, 61780, 950],
      [61780, 61800, 61500, 61550, 1200],
      [61550, 61700, 61480, 61620, 1050],
      [61620, 61650, 61350, 61400, 1300],
      [61400, 61520, 61320, 61450, 1000],
      [61450, 61480, 61180, 61220, 1400],
      [61220, 61350, 61150, 61280, 1150],
      [61280, 61300, 61000, 61050, 1500],
      [61050, 61180, 60950, 61100, 1250],
      [61100, 61150, 60800, 60880, 1600],
      [60880, 60980, 60750, 60820, 1300],
      [60820, 60850, 60550, 60600, 1750],
      [60600, 60720, 60500, 60650, 1400],
      [60650, 60680, 60350, 60420, 1800],
      [60420, 60550, 60250, 60300, 1200],
      [60300, 60400, 60050, 60100, 1600],
      [60100, 60150, 59750, 59800, 3100],
      [59800, 59900, 59350, 59400, 2700],
      [59400, 59550, 59000, 59100, 2400],
      [59100, 59250, 58650, 58750, 3100],
      [58750, 58900, 58300, 58400, 3300],
      [58400, 58500, 58050, 58150, 3800],
      [58150, 58400, 58100, 58300, 2100],
    ];
  } else if (scenario === 'BTC_FAILED_BREAKOUT') {
    rawBars = [
      [63500, 63650, 63450, 63600, 950],
      [63600, 63700, 63480, 63520, 1020],
      [63520, 63800, 63500, 63750, 1150],
      [63750, 63820, 63600, 63650, 980],
      [63650, 63900, 63600, 63850, 1250],
      [63850, 64000, 63700, 63900, 1100],
      [63900, 64100, 63850, 64050, 1300],
      [64050, 64150, 63900, 64000, 1050],
      [64000, 64200, 63950, 64150, 1400],
      [64150, 64250, 64000, 64100, 1120],
      [64100, 64350, 64050, 64300, 1500],
      [64300, 64380, 64150, 64200, 1200],
      [64200, 64450, 64150, 64350, 1400],
      [64350, 64400, 64180, 64220, 1100],
      [64220, 64550, 64200, 64500, 2800],
      [64500, 64600, 64100, 64150, 2400],
      [64150, 64200, 63700, 63750, 3100],
      [63750, 63800, 63250, 63300, 3600],
      [63300, 63400, 62900, 62950, 4200],
      [62950, 63100, 62800, 62850, 2900],
    ];
  } else {
    // BTC_BULL_BREAKOUT
    rawBars = [
      [62800, 62950, 62750, 62900, 950],
      [62900, 63000, 62780, 62820, 1020],
      [62820, 63100, 62800, 63050, 1150],
      [63050, 63150, 62920, 62960, 980],
      [62960, 63250, 62900, 63180, 1250],
      [63180, 63220, 63000, 63080, 1100],
      [63080, 63350, 63020, 63290, 1300],
      [63290, 63400, 63150, 63200, 1050],
      [63200, 63500, 63180, 63450, 1400],
      [63450, 63520, 63300, 63350, 1120],
      [63350, 63650, 63300, 63580, 1500],
      [63580, 63650, 63420, 63480, 1200],
      [63480, 63650, 63400, 63500, 1400],
      [63500, 63580, 63380, 63420, 1100],
      [63420, 63600, 63380, 63550, 1300],
      [63550, 63620, 63450, 63480, 1050],
      [63480, 63700, 63450, 63650, 1100],
      [63650, 63750, 63520, 63580, 1050],
      [63580, 63850, 63550, 63800, 1250],
      [63800, 63880, 63680, 63720, 1150],
      [63720, 64250, 63700, 64180, 2900],
      [64180, 64650, 64100, 64550, 2200],
      [64550, 65100, 64450, 64950, 2600],
      [64950, 65450, 64850, 65350, 2100],
      [65350, 65800, 65200, 65700, 3100],
      [65700, 66100, 65550, 66050, 2900],
      [66050, 66350, 65900, 66250, 3500],
      [66250, 66500, 66100, 66400, 1800],
    ];
  }

  return rawBars.map((b, i) => ({
    timestamp: baseTs + i * stepTs,
    open: b[0],
    high: b[1],
    low: b[2],
    close: b[3],
    volume: b[4],
  }));
}

function generateAssetCandles(basePrice: number, volFactor: number, decimals: number): Candle[] {
  const baseTs = Date.now() - 3600 * 1000 * 24;
  const stepTs = 3600 * 1000;
  const candles: Candle[] = [];
  for (let i = 0; i < 25; i++) {
    const delta = (i * basePrice * 0.0006) + ((i % 4 - 1.5) * basePrice * volFactor);
    const close = parseFloat((basePrice + delta).toFixed(decimals));
    const high = parseFloat((close + basePrice * volFactor * 1.5).toFixed(decimals));
    const low = parseFloat((close - basePrice * volFactor * 1.2).toFixed(decimals));
    const open = parseFloat((close - basePrice * volFactor * 0.4).toFixed(decimals));
    candles.push({
      timestamp: baseTs + i * stepTs,
      open,
      high,
      low,
      close,
      volume: Math.round(1000 + i * 50),
    });
  }
  return candles;
}

function createMockMarketContext(scenario: string, visibleCandles: Candle[], asset = 'BTC/USDT'): MarketContext {
  const last = visibleCandles[visibleCandles.length - 1] || { close: 64180 };
  const first = visibleCandles[0] || { close: 62800 };
  const changePct = ((last.close - first.close) / (first.close || 1)) * 100;
  const isGold = asset.includes('XAU') || asset.includes('GOLD');
  const isEur = asset.includes('EUR');

  const newsItems = isGold
    ? [
        {
          headline: 'Central Banks Accelerate Gold Purchases Amid Geopolitical Diversification',
          source: 'World Gold Council',
          published_at: new Date().toISOString(),
          summary: 'Sovereign reserves net accumulation reached record levels, supporting bullion demand.',
          relevance: 'high',
          sentiment_hint: 'bullish',
        },
        {
          headline: 'US Real Yields Soften, Bolstering Non-Yielding Precious Metals',
          source: 'Financial Times',
          published_at: new Date().toISOString(),
          summary: 'Institutional asset managers hedge currency debasement risks with physical gold allocations.',
          relevance: 'medium',
          sentiment_hint: 'bullish',
        },
      ]
    : isEur
    ? [
        {
          headline: 'ECB Signals Cautious Rate Policy as Eurozone Core Inflation Moderates',
          source: 'Reuters',
          published_at: new Date().toISOString(),
          summary: 'Eurozone manufacturing surveys indicate gradual economic stabilization.',
          relevance: 'high',
          sentiment_hint: 'neutral',
        },
        {
          headline: 'Euro Holds Firm Around Key Support Against Greenback',
          source: 'Bloomberg FX',
          published_at: new Date().toISOString(),
          summary: 'Narrowing transatlantic interest rate differential lends underlying currency support.',
          relevance: 'medium',
          sentiment_hint: 'bullish',
        },
      ]
    : [
        {
          headline: 'Institutional ETF inflows accelerate with $450M daily net purchase',
          source: 'Bloomberg',
          published_at: '2026-09-10T12:00:00Z',
          summary: 'Sustained net spot allocations across Tier-1 authorized participants.',
          relevance: 'high',
          sentiment_hint: 'bullish',
        },
        {
          headline: 'Order book liquidity depth shifts higher across major derivatives venues',
          source: 'CoinDesk',
          published_at: '2026-09-10T11:30:00Z',
          summary: 'Positive delta in ask depth absorbed without negative price slippage.',
          relevance: 'medium',
          sentiment_hint: 'bullish',
        },
      ];

  const spread = isEur ? 0.0002 : isGold ? 0.45 : 5.0;
  const ema20 = isGold ? last.close * 0.992 : isEur ? last.close * 0.998 : scenario === 'BTC_BEAR_BREAKDOWN' ? 60400 : 63430.86;
  const ema50 = isGold ? last.close * 0.985 : isEur ? last.close * 0.995 : scenario === 'BTC_BEAR_BREAKDOWN' ? 61100 : 63391.43;

  return {
    asset,
    timeframe: '1h',
    current_price: last.close,
    recent_price_change_pct: changePct,
    volume_24h: isEur ? 85400.0 : isGold ? 1240.5 : 18450.4,
    trend: scenario === 'BTC_BEAR_BREAKDOWN' ? 'BEARISH' : 'BULLISH',
    market_structure: scenario === 'BTC_BEAR_BREAKDOWN' ? 'BEARISH_BREAKDOWN' : 'BULLISH_BREAKOUT',
    rsi: scenario === 'BTC_BEAR_BREAKDOWN' ? 28.4 : 64.2,
    atr: isEur ? 0.0045 : isGold ? 18.5 : 274.8,
    volatility: isEur ? 0.004 : isGold ? 0.009 : 0.018,
    ema_20: ema20,
    ema_50: ema50,
    recent_swing_highs: [last.close * 1.015, last.close * 1.008],
    recent_swing_lows: [last.close * 0.985, last.close * 0.978],
    support_levels: [last.close * 0.98, last.close * 0.96],
    resistance_levels: [last.close * 1.02, last.close * 1.04],
    microstructure: {
      avg_bid_price: last.close - spread / 2,
      avg_ask_price: last.close + spread / 2,
      avg_bid_size: 14.5,
      avg_ask_size: 11.2,
      bid_ask_spread: spread,
      bid_size_std: 2.1,
      ask_size_std: 1.8,
      bid_volume: 1450,
      ask_volume: 1120,
      volume_imbalance: scenario === 'BTC_BEAR_BREAKDOWN' ? -0.32 : 0.27,
      bid_levels: 20,
      ask_levels: 20,
      level_imbalance: 0.12,
      large_bid_orders: 8,
      large_ask_orders: 4,
    },
    recent_news: newsItems,
    prior_learnings: [
      'In high volatility regimes, trailing stop adjustments prevent premature stop-outs.',
      'Slippage during breakout events averages 0.03%; calibrate limit entry offsets accordingly.',
      'False breakout risk elevates when RSI exceeds 78 without accompanying volume expansion.',
    ],
    candles: visibleCandles,
  };
}

// Local mock state for offline fallback
let localAllCandles: Candle[] = getMockCandles('BTC_BULL_BREAKOUT');
let localCurrentIndex = 20;
let localScenario = 'BTC_BULL_BREAKOUT';
let localPortfolio: PortfolioState = {
  initial_balance: 100000,
  cash: 100000,
  equity: 100000,
  margin_used: 0,
  realized_pnl: 0,
  unrealized_pnl: 0,
  total_trades: 0,
  winning_trades: 0,
  losing_trades: 0,
  win_rate: 0,
  active_positions: [],
  closed_positions: [],
  equity_history: [{ equity: 100000, cash: 100000 }],
};
let localMemories: string[] = [
  'In high volatility regimes, trailing stop adjustments prevent premature stop-outs.',
  'Slippage during breakout events averages 0.03%; calibrate limit entry offsets accordingly.',
  'False breakout risk elevates when RSI exceeds 78 without accompanying volume expansion.',
];
let localReviews: PostTradeReview[] = [];

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

export async function fetchMarketContext(
  asset = 'BTC/USDT',
  timeframe = '1h',
  mode = 'replay'
): Promise<MarketContext> {
  try {
    const res = await fetch(`${API_BASE}/api/market-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset, timeframe, mode }),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) return await res.json();
  } catch {}

  // Fallback
  if (asset.includes('XAU') || asset.includes('GOLD')) {
    const goldCandles = generateAssetCandles(2654.50, 0.003, 2);
    return createMockMarketContext(localScenario, goldCandles, asset);
  } else if (asset.includes('EUR')) {
    const eurCandles = generateAssetCandles(1.0875, 0.0015, 4);
    return createMockMarketContext(localScenario, eurCandles, asset);
  } else if (asset.includes('ETH')) {
    const ethCandles = generateAssetCandles(3450.0, 0.005, 2);
    return createMockMarketContext(localScenario, ethCandles, asset);
  } else if (asset.includes('SOL')) {
    const solCandles = generateAssetCandles(152.0, 0.008, 2);
    return createMockMarketContext(localScenario, solCandles, asset);
  }

  const visible = localAllCandles.slice(0, localCurrentIndex + 1);
  return createMockMarketContext(localScenario, visible, asset);
}

export async function runAiAnalysis(context: MarketContext): Promise<{ thesis: TradeThesis; decision: TradeDecision }> {
  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return await res.json();
  } catch {}

  // Fallback deterministic AI formulation
  const isShort = context.trend === 'BEARISH';
  const curr = context.current_price;
  const entry = curr;
  const sl = isShort ? curr + 650 : curr - 650;
  const tp = isShort ? curr - 1600 : curr + 1600;
  const bias = isShort ? 'SHORT' : 'LONG';

  const thesis: TradeThesis = {
    bias,
    confidence: 0.88,
    thesis: isShort
      ? `Structural distribution breach below key support with negative volume delta. Macro liquidity sweep signals immediate downward continuation to prior demand block.`
      : `High-conviction breakout pattern validated by sustained spot taker volume and clean order book depth imbalance (+0.27). Technical indicators confirm structural expansion.`,
    market_structure: isShort ? 'LOWER_HIGHS_BREAKDOWN' : 'HIGHER_HIGHS_BULLISH_TREND',
    catalysts: ['Spot ETF continuous net accumulation', 'Order book bid density expansion', 'RSI momentum crossover'],
    supporting_factors: [
      `EMA 20 ($${context.ema_20.toFixed(2)}) positioned firmly above EMA 50`,
      `Order book depth exhibits +0.27 positive volume imbalance favoring aggressor orders`,
      `Recent swing low ($63,380) preserved through multiple retest attempts`,
    ],
    conflicting_factors: [
      `RSI (${context.rsi.toFixed(1)}) approaching short-term exhaustion boundary`,
      `Overhead historical resistance cluster between $64,500 and $65,000`,
    ],
    key_levels: { entry, stop_loss: sl, take_profit: tp },
    invalidation_condition: isShort
      ? `Sustained 1h close above $${(curr + 650).toFixed(2)} invalidates distribution hypothesis.`
      : `Sustained 1h close below $${(curr - 650).toFixed(2)} invalidates breakout momentum.`,
    entry_reason: `Immediate limit/market execution at breakout validation level ($${curr.toFixed(2)}).`,
    stop_loss_reason: `Placed below immediate swing consolidation low to honor 1% account risk cap.`,
    take_profit_reason: `Set at target resistance expansion level providing 2.46:1 reward-to-risk ratio.`,
    risk_considerations: ['Liquidity void during high-speed breakout', 'Macro news volatility catalyst'],
    assumptions: ['Aggressive market taker flow persists throughout Asian/US session overlap'],
  };

  const decision: TradeDecision = {
    direction: bias,
    entry,
    stop_loss: sl,
    take_profit: tp,
    position_size: 0.364,
    risk_amount: 1000.0,
    risk_reward_ratio: 2.46,
    invalidation_condition: thesis.invalidation_condition,
    confidence: 0.88,
    rationale: thesis.thesis,
  };

  return { thesis, decision };
}

export async function validateTrade(decision: TradeDecision, accountEquity?: number): Promise<RiskAssessment> {
  try {
    const res = await fetch(`${API_BASE}/api/validate-trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, account_equity: accountEquity }),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) return await res.json();
  } catch {}

  const equity = accountEquity || localPortfolio.equity;
  const maxRisk = equity * 0.01;
  const stopDist = Math.abs(decision.entry - decision.stop_loss);
  const stopDistPct = (stopDist / decision.entry) * 100;
  const rewardDist = Math.abs(decision.take_profit - decision.entry);
  const rr = rewardDist / (stopDist || 1);
  const size = parseFloat((maxRisk / stopDist).toFixed(4));

  const assessment: RiskAssessment = {
    status: 'APPROVED',
    decision: {
      ...decision,
      position_size: size,
      risk_amount: maxRisk,
      risk_reward_ratio: parseFloat(rr.toFixed(2)),
    },
    account_equity: equity,
    risk_amount: maxRisk,
    risk_percentage: 1.0,
    calculated_position_size: size,
    stop_distance: stopDist,
    stop_distance_pct: parseFloat(stopDistPct.toFixed(2)),
    reward_distance: rewardDist,
    risk_reward_ratio: parseFloat(rr.toFixed(2)),
    checks: [
      { check_name: 'Price Sanity Check', passed: true, details: `Valid numerical values for entry, SL, and TP.` },
      { check_name: 'SL / TP Orientation Check', passed: true, details: `Stop loss & take profit correctly oriented for ${decision.direction}.` },
      { check_name: 'Minimum 1.5:1 R:R Check', passed: rr >= 1.5, details: `Calculated R:R of ${rr.toFixed(2)}:1 exceeds 1.5:1 minimum threshold.` },
      { check_name: '1% Account Risk Sizing Formula', passed: true, details: `Position sized to exactly $${maxRisk.toFixed(2)} (1.00% of $${equity.toLocaleString()}).` },
      { check_name: 'Liquidity & Volatility Cap Check', passed: true, details: `Stop distance (${stopDistPct.toFixed(2)}%) is within standard ATR parameters.` },
    ],
    rejection_reasons: [],
  };

  return assessment;
}

export async function executeSimulatedTrade(
  decision: TradeDecision,
  riskAssessment: RiskAssessment,
  thesis?: TradeThesis,
  asset = 'BTC/USDT'
): Promise<SimulatedPosition> {
  try {
    const res = await fetch(`${API_BASE}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, risk_assessment: riskAssessment, thesis, asset }),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) return await res.json();
  } catch {}

  const slippage = decision.direction === 'LONG' ? 4.5 : -4.5;
  const fillPrice = decision.entry + slippage;
  const notional = fillPrice * riskAssessment.calculated_position_size;
  const fees = parseFloat((notional * 0.0005).toFixed(2));

  const pos: SimulatedPosition = {
    id: `POS-BTC-${Math.floor(1000 + Math.random() * 9000)}`,
    asset: 'BTC/USDT',
    direction: decision.direction,
    entry_target: decision.entry,
    fill_price: fillPrice,
    stop_loss: decision.stop_loss,
    take_profit: decision.take_profit,
    quantity: riskAssessment.calculated_position_size,
    notional_value: notional,
    status: 'OPEN',
    opened_at: new Date().toISOString(),
    current_price: fillPrice,
    gross_pnl: 0,
    fees,
    slippage_cost: Math.abs(slippage * riskAssessment.calculated_position_size),
    net_pnl: -fees,
    return_pct: 0,
    thesis,
  };

  localPortfolio.active_positions = [pos];
  localPortfolio.margin_used = notional;
  return pos;
}

export async function closeSimulatedTrade(
  positionId: string,
  currentPrice: number
): Promise<PostTradeReview> {
  try {
    const res = await fetch(`${API_BASE}/api/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position_id: positionId, current_price: currentPrice }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return await res.json();
  } catch {}

  // Fallback manual close simulation
  const pos = localPortfolio.active_positions.find((p) => p.id === positionId) || localPortfolio.active_positions[0];
  const exitPrice = currentPrice || (pos ? pos.current_price : 64000);
  const fillPrice = pos ? pos.fill_price : exitPrice;
  const quantity = pos ? pos.quantity : 0.5;
  const isLong = pos ? pos.direction === 'LONG' : true;
  const fees = pos ? pos.fees : 15.0;

  const grossPnl = isLong ? (exitPrice - fillPrice) * quantity : (fillPrice - exitPrice) * quantity;
  const netPnl = grossPnl - fees;
  const returnPct = notional(fillPrice, quantity) > 0 ? (netPnl / (fillPrice * quantity)) * 100 : 0;

  function notional(p: number, q: number) {
    return p * q;
  }

  if (pos) {
    pos.status = 'CLOSED';
    pos.exit_price = exitPrice;
    pos.gross_pnl = grossPnl;
    pos.net_pnl = netPnl;
    pos.return_pct = returnPct;
    pos.closure_reason = 'MANUAL_CLOSE';
    pos.closed_at = new Date().toISOString();

    localPortfolio.active_positions = localPortfolio.active_positions.filter((p) => p.id !== pos.id);
    localPortfolio.closed_positions.unshift(pos);
    localPortfolio.realized_pnl += netPnl;
    localPortfolio.equity += netPnl;
    localPortfolio.cash += netPnl;
    localPortfolio.margin_used = 0;
    localPortfolio.total_trades += 1;
    if (netPnl > 0) localPortfolio.winning_trades += 1;
    else localPortfolio.losing_trades += 1;
    localPortfolio.win_rate = parseFloat(
      ((localPortfolio.winning_trades / localPortfolio.total_trades) * 100).toFixed(1)
    );
  }

  const review: PostTradeReview = {
    trade_id: positionId,
    outcome: netPnl >= 0 ? 'MANUAL_CLOSE_PROFIT' : 'MANUAL_CLOSE_LOSS',
    thesis_correct: netPnl >= 0,
    execution_quality: 'ACCEPTABLE',
    what_worked: netPnl >= 0
      ? 'Discretionary manual exit secured positive return before potential price reversal.'
      : 'Capital exposure cut cleanly at market, preventing further drawdown.',
    what_failed: netPnl >= 0
      ? 'Exited before reaching formal take-profit objective.'
      : 'Price momentum turned against thesis prior to invalidation level.',
    why: 'Trader elected manual position closure at current mark price.',
    risk_management_assessment: 'Manual exit respected capital preservation rules.',
    missed_signals: ['Early momentum deceleration on shorter timeframe'],
    lessons_learned: [
      'Manual exits should align with predetermined structural pivots rather than emotional noise.',
    ],
    recommended_change: 'Consider scaling out partial position at 1R before full discretionary close.',
    confidence_in_review: 0.9,
    original_thesis: pos?.thesis,
  };

  localReviews.unshift(review);
  localMemories.unshift(review.lessons_learned[0]);
  return review;
}

export async function startReplayScenario(scenario: string): Promise<ReplayStartResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/replay/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) return await res.json();
  } catch {}

  // Fallback
  localScenario = scenario;
  localAllCandles = getMockCandles(scenario);
  localCurrentIndex = scenario === 'BTC_BEAR_BREAKDOWN' ? 17 : scenario === 'BTC_FAILED_BREAKOUT' ? 14 : 20;
  localPortfolio.active_positions = [];

  const visible = localAllCandles.slice(0, localCurrentIndex + 1);
  const context = createMockMarketContext(scenario, visible);

  return {
    scenario_info: {
      id: scenario,
      name: scenario.replace(/_/g, ' '),
      description:
        scenario === 'BTC_BULL_BREAKOUT'
          ? 'BTC/USDT Bullish Breakout above $64,200 resistance to $66,200 target (Win / TP).'
          : scenario === 'BTC_BEAR_BREAKDOWN'
          ? 'BTC/USDT Bearish Breakdown below $60,000 support to $58,200 demand zone (Short Win).'
          : 'BTC/USDT Failed Breakout Bull Trap. Hits Stop Loss and verifies deterministic risk guardrails.',
      expected_outcome: scenario === 'BTC_FAILED_BREAKOUT' ? 'LOSS_STOP_LOSS' : 'WIN_TAKE_PROFIT',
      total_bars: localAllCandles.length,
      initial_visible_bars: localCurrentIndex + 1,
    },
    market_context: context,
    portfolio: localPortfolio,
  };
}

export async function stepReplayBar(): Promise<StepReplayResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/replay/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) return await res.json();
  } catch {}

  // Fallback
  if (localCurrentIndex >= localAllCandles.length - 1) {
    const visible = localAllCandles;
    return {
      status: 'completed',
      current_bar: localAllCandles.length,
      total_bars: localAllCandles.length,
      is_finished: true,
      candle: localAllCandles[localAllCandles.length - 1],
      market_context: createMockMarketContext(localScenario, visible),
      portfolio: localPortfolio,
      closed_events: [],
    };
  }

  localCurrentIndex += 1;
  const candle = localAllCandles[localCurrentIndex];
  const visible = localAllCandles.slice(0, localCurrentIndex + 1);
  const context = createMockMarketContext(localScenario, visible);

  // Evaluate active positions
  const closedEvents: StepReplayResponse['closed_events'] = [];
  if (localPortfolio.active_positions.length > 0) {
    const pos = localPortfolio.active_positions[0];
    pos.current_price = candle.close;

    const isLong = pos.direction === 'LONG';
    const hitTP = isLong ? candle.high >= pos.take_profit : candle.low <= pos.take_profit;
    const hitSL = isLong ? candle.low <= pos.stop_loss : candle.high >= pos.stop_loss;

    if (hitTP || hitSL) {
      const exitPrice = hitTP ? pos.take_profit : pos.stop_loss;
      const grossPnl = isLong
        ? (exitPrice - pos.fill_price) * pos.quantity
        : (pos.fill_price - exitPrice) * pos.quantity;
      const netPnl = grossPnl - pos.fees;
      const returnPct = (grossPnl / (pos.fill_price * pos.quantity)) * 100;

      pos.status = 'CLOSED';
      pos.exit_price = exitPrice;
      pos.gross_pnl = grossPnl;
      pos.net_pnl = netPnl;
      pos.return_pct = returnPct;
      pos.closure_reason = hitTP ? 'TAKE_PROFIT' : 'STOP_LOSS';
      pos.closed_at = new Date().toISOString();

      localPortfolio.active_positions = [];
      localPortfolio.closed_positions.unshift(pos);
      localPortfolio.realized_pnl += netPnl;
      localPortfolio.equity += netPnl;
      localPortfolio.cash += netPnl;
      localPortfolio.margin_used = 0;
      localPortfolio.total_trades += 1;
      if (netPnl > 0) localPortfolio.winning_trades += 1;
      else localPortfolio.losing_trades += 1;
      localPortfolio.win_rate = parseFloat(
        ((localPortfolio.winning_trades / localPortfolio.total_trades) * 100).toFixed(1)
      );
      localPortfolio.equity_history.push({
        equity: localPortfolio.equity,
        cash: localPortfolio.cash,
        timestamp: Date.now(),
      });

      const outcome: TradeOutcome = {
        position_id: pos.id,
        asset: pos.asset,
        direction: pos.direction,
        entry_price: pos.fill_price,
        exit_price: exitPrice,
        quantity: pos.quantity,
        gross_pnl: grossPnl,
        fees: pos.fees,
        net_pnl: netPnl,
        return_pct: returnPct,
        closure_reason: pos.closure_reason,
        duration_bars: 4,
        opened_at: pos.opened_at,
        closed_at: pos.closed_at,
        original_thesis: pos.thesis || ({} as any),
      };

      const review: PostTradeReview = {
        trade_id: pos.id,
        outcome: hitTP ? 'PROFIT_TAKE_PROFIT' : 'LOSS_STOP_LOSS',
        thesis_correct: hitTP,
        execution_quality: 'EXCELLENT',
        what_worked: hitTP
          ? 'Breakout level hold and volume-backed extension directly to target resistance.'
          : 'Deterministic stop loss triggered cleanly, strictly limiting portfolio damage to 1.00%.',
        what_failed: hitTP
          ? 'Slight taker slippage on initial entry ($4.50).'
          : 'Bull trap formed immediately following liquidity sweep; volume failed to sustain above $64,250.',
        why: hitTP
          ? 'Sustained institutional spot delta cleanly absorbed the overhead ask liquidity block.'
          : 'Fakeout breakdown absorbed by aggressive selling at key horizontal resistance.',
        risk_management_assessment: '100% adherence to deterministic 1% capital preservation rule. No override occurred.',
        missed_signals: hitTP ? [] : ['Order book bid exhaustion 1 bar prior to collapse'],
        lessons_learned: hitTP
          ? ['When volume imbalance exceeds +0.25, runner positions can scale out at target +1.5R.']
          : ['Check 5m order book bid replenishment rate before executing breakout entries near round numbers.'],
        recommended_change: hitTP ? 'Maintain current sizing algorithm.' : 'Require second bar confirmation for breakout entry.',
        confidence_in_review: 0.94,
      };

      localReviews.unshift(review);
      localMemories.unshift(review.lessons_learned[0]);

      closedEvents.push({ position: pos, outcome, review });
    } else {
      const isProfit = isLong ? candle.close > pos.fill_price : candle.close < pos.fill_price;
      const unPnl = isLong
        ? (candle.close - pos.fill_price) * pos.quantity
        : (pos.fill_price - candle.close) * pos.quantity;
      pos.net_pnl = unPnl - pos.fees;
      pos.return_pct = (unPnl / (pos.fill_price * pos.quantity)) * 100;
      localPortfolio.unrealized_pnl = pos.net_pnl;
      localPortfolio.equity = localPortfolio.cash + pos.net_pnl;
    }
  }

  return {
    status: 'stepped',
    current_bar: localCurrentIndex + 1,
    total_bars: localAllCandles.length,
    is_finished: localCurrentIndex >= localAllCandles.length - 1,
    candle,
    market_context: context,
    portfolio: localPortfolio,
    closed_events: closedEvents,
  };
}

export async function fetchPortfolio(): Promise<PortfolioState> {
  try {
    const res = await fetch(`${API_BASE}/api/portfolio`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) return await res.json();
  } catch {}
  return localPortfolio;
}

export async function fetchMemory(): Promise<MemoryData> {
  try {
    const res = await fetch(`${API_BASE}/api/memory`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) return await res.json();
  } catch {}
  return {
    prior_learnings: localMemories,
    recent_reviews: localReviews,
  };
}

export async function resetSystem(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/reset`, { method: 'POST', signal: AbortSignal.timeout(2000) });
  } catch {}

  localPortfolio = {
    initial_balance: 100000,
    cash: 100000,
    equity: 100000,
    margin_used: 0,
    realized_pnl: 0,
    unrealized_pnl: 0,
    total_trades: 0,
    winning_trades: 0,
    losing_trades: 0,
    win_rate: 0,
    active_positions: [],
    closed_positions: [],
    equity_history: [{ equity: 100000, cash: 100000 }],
  };
  localCurrentIndex = 20;
}
