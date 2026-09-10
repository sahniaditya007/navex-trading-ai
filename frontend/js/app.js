// NAVEX Trading AI - Frontend Application Controller
const API_BASE = "";

const state = {
  asset: "BTC/USDT",
  timeframe: "1h",
  mode: "replay", // "replay" or "demo" or "live"
  scenario: "BTC_BULL_BREAKOUT",
  context: null,
  thesis: null,
  decision: null,
  riskAssessment: null,
  activePosition: null,
  portfolio: null,
  replayFinished: false,
  autoPlayTimer: null,
};

let chart = null;

document.addEventListener("DOMContentLoaded", () => {
  chart = new NavexChart("chartCanvas");
  setupEventListeners();
  initDashboard();
});

function setupEventListeners() {
  document.getElementById("assetSelect").addEventListener("change", (e) => {
    state.asset = e.target.value;
    loadMarketContext();
  });

  document.getElementById("modeSelect").addEventListener("change", (e) => {
    state.mode = e.target.value;
    const scenarioGroup = document.getElementById("scenarioGroup");
    const replayControls = document.getElementById("replayControls");

    if (state.mode === "replay") {
      scenarioGroup.style.display = "flex";
      replayControls.style.display = "flex";
      startReplayScenario();
    } else {
      scenarioGroup.style.display = "none";
      replayControls.style.display = "none";
      loadMarketContext();
    }
  });

  document.getElementById("scenarioSelect").addEventListener("change", (e) => {
    state.scenario = e.target.value;
    startReplayScenario();
  });

  document.getElementById("btnRefreshContext").addEventListener("click", loadMarketContext);
  document.getElementById("btnAnalyze").addEventListener("click", runAiAnalysis);
  document.getElementById("btnValidateRisk").addEventListener("click", runRiskValidation);
  document.getElementById("btnExecute").addEventListener("click", executeSimulatedTrade);
  document.getElementById("btnReplayStep").addEventListener("click", stepReplayBar);
  document.getElementById("btnAutoPlay").addEventListener("click", toggleAutoPlay);
  document.getElementById("btnReset").addEventListener("click", resetSystem);
}

async function initDashboard() {
  log("Initializing NAVEX Trading AI Dashboard...");
  await loadPortfolio();
  await loadMemory();
  if (state.mode === "replay") {
    await startReplayScenario();
  } else {
    await loadMarketContext();
  }
}

function log(msg) {
  const box = document.getElementById("terminalLog");
  if (!box) return;
  const time = new Date().toLocaleTimeString();
  box.innerHTML += `[${time}] ${msg}\n`;
  box.scrollTop = box.scrollHeight;
}

// 1. Market Context
async function loadMarketContext() {
  try {
    log(`Fetching market context for ${state.asset} (${state.mode} mode)...`);
    const resp = await fetch(`${API_BASE}/api/market-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset: state.asset, timeframe: state.timeframe, mode: state.mode })
    });
    if (!resp.ok) throw new Error(await resp.text());
    state.context = await resp.json();
    renderContext();
    highlightStep("step-context");
  } catch (err) {
    log(`ERROR loading context: ${err.message}`);
  }
}

function renderContext() {
  const ctx = state.context;
  if (!ctx) return;

  document.getElementById("currentPrice").textContent = `$${ctx.current_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  
  const chgEl = document.getElementById("priceChange");
  const isUp = ctx.recent_price_change_pct >= 0;
  chgEl.textContent = `${isUp ? "+" : ""}${ctx.recent_price_change_pct.toFixed(2)}%`;
  chgEl.className = `price-change ${isUp ? "change-up" : "change-down"}`;

  document.getElementById("metricTrend").textContent = ctx.trend;
  document.getElementById("metricStructure").textContent = ctx.market_structure;
  document.getElementById("metricRsi").textContent = ctx.rsi.toFixed(1);
  document.getElementById("metricAtr").textContent = `$${ctx.atr.toFixed(2)}`;
  document.getElementById("metricEma20").textContent = `$${ctx.ema_20.toFixed(2)}`;
  document.getElementById("metricEma50").textContent = `$${ctx.ema_50.toFixed(2)}`;
  
  if (ctx.microstructure) {
    document.getElementById("metricSpread").textContent = `$${ctx.microstructure.bid_ask_spread.toFixed(2)}`;
    document.getElementById("metricImbalance").textContent = `${ctx.microstructure.volume_imbalance > 0 ? "+" : ""}${ctx.microstructure.volume_imbalance.toFixed(2)}`;
  }

  // News ticker
  const newsList = document.getElementById("newsList");
  if (ctx.recent_news && ctx.recent_news.length > 0) {
    newsList.innerHTML = ctx.recent_news.map(n => `
      <div style="margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
        <span style="font-weight: 700; color: #60a5fa;">[${n.source}]</span>
        <span style="color: #e5e7eb;">${n.headline}</span>
      </div>
    `).join("");
  }

  // Render chart
  chart.setData(ctx.candles);
}

// 2. AI Analyst
async function runAiAnalysis() {
  if (!state.context) {
    log("Please load market context first.");
    return;
  }
  try {
    log("AI Analyst Agent formulating structured TradeThesis...");
    const resp = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: state.context })
    });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    state.thesis = data.thesis;
    state.decision = data.decision;

    renderThesis();
    highlightStep("step-analysis");
    log(`Thesis complete: Bias = ${state.thesis.bias} (${(state.thesis.confidence * 100).toFixed(1)}% confidence)`);
    
    // Automatically trigger risk validation for seamless demo
    await runRiskValidation();
  } catch (err) {
    log(`ERROR in analysis: ${err.message}`);
  }
}

function renderThesis() {
  const t = state.thesis;
  if (!t) return;

  const biasBadge = document.getElementById("thesisBiasBadge");
  biasBadge.textContent = t.bias;
  biasBadge.className = `thesis-bias-badge bias-${t.bias}`;

  document.getElementById("thesisConfidence").textContent = `Confidence: ${(t.confidence * 100).toFixed(0)}%`;
  document.getElementById("thesisText").textContent = t.thesis;
  document.getElementById("thesisInvalidation").textContent = t.invalidation_condition;

  const suppList = document.getElementById("supportingList");
  suppList.innerHTML = t.supporting_factors.map(f => `<li>${f}</li>`).join("");

  const confList = document.getElementById("conflictingList");
  confList.innerHTML = t.conflicting_factors.map(f => `<li>${f}</li>`).join("");

  // Update chart overlays with proposed levels
  if (t.bias !== "NO_TRADE") {
    chart.setData(state.context.candles, {
      entry: state.decision.entry,
      stopLoss: state.decision.stop_loss,
      takeProfit: state.decision.take_profit
    });
  }
}

// 3. Deterministic Risk Engine
async function runRiskValidation() {
  if (!state.decision) {
    log("Please run AI Analysis first.");
    return;
  }
  try {
    log("Deterministic Risk Engine evaluating guardrails and position sizing...");
    const resp = await fetch(`${API_BASE}/api/validate-trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: state.decision })
    });
    if (!resp.ok) throw new Error(await resp.text());
    state.riskAssessment = await resp.json();

    renderRiskAssessment();
    highlightStep("step-risk");
    log(`Risk Evaluation: ${state.riskAssessment.status} | Sized: ${state.riskAssessment.calculated_position_size} units`);
  } catch (err) {
    log(`ERROR in risk validation: ${err.message}`);
  }
}

function renderRiskAssessment() {
  const r = state.riskAssessment;
  if (!r) return;

  const statusBadge = document.getElementById("riskStatusBadge");
  statusBadge.textContent = r.status;
  statusBadge.className = `risk-badge risk-${r.status}`;

  document.getElementById("riskSizing").textContent = `${r.calculated_position_size} BTC ($${r.risk_amount.toFixed(2)} risk / ${r.risk_percentage}%)`;
  document.getElementById("riskReward").textContent = `${r.risk_reward_ratio}:1`;
  document.getElementById("riskStopDist").textContent = `$${r.stop_distance.toFixed(2)} (${r.stop_distance_pct}%)`;

  const checklistEl = document.getElementById("riskChecklist");
  checklistEl.innerHTML = r.checks.map(c => `
    <div class="check-item ${c.passed ? "pass" : "fail"}">
      <span>${c.check_name}</span>
      <span style="color: ${c.passed ? "#10b981" : "#ef4444"}; font-weight: 700;">${c.passed ? "PASS" : "FAIL"}</span>
    </div>
  `).join("");

  const execBtn = document.getElementById("btnExecute");
  if (r.status === "APPROVED" && r.decision.direction !== "NO_TRADE") {
    execBtn.disabled = false;
    execBtn.className = "btn btn-success";

    const paramsForm = document.getElementById("executionParamsForm");
    if (paramsForm) {
      paramsForm.style.display = "block";
      document.getElementById("inputEntry").value = r.decision.entry;
      document.getElementById("inputStopLoss").value = r.decision.stop_loss;
      document.getElementById("inputTakeProfit").value = r.decision.take_profit;
      document.getElementById("inputSize").value = r.calculated_position_size;
    }
  } else {
    execBtn.disabled = true;
    execBtn.className = "btn btn-secondary";
  }
}

// 4. Execution Simulation
async function executeSimulatedTrade() {
  if (!state.riskAssessment || state.riskAssessment.status !== "APPROVED") {
    log("Cannot execute: Trade is not approved by Risk Engine.");
    return;
  }
  try {
    log("Simulating paper trade execution with slippage and taker fee deduction...");
    const customEntry = parseFloat(document.getElementById("inputEntry")?.value) || state.riskAssessment.decision.entry;
    const customSL = parseFloat(document.getElementById("inputStopLoss")?.value) || state.riskAssessment.decision.stop_loss;
    const customTP = parseFloat(document.getElementById("inputTakeProfit")?.value) || state.riskAssessment.decision.take_profit;
    const customSize = parseFloat(document.getElementById("inputSize")?.value) || state.riskAssessment.calculated_position_size;

    const modifiedDecision = {
      ...state.riskAssessment.decision,
      entry: customEntry,
      stop_loss: customSL,
      take_profit: customTP,
      position_size: customSize
    };

    const resp = await fetch(`${API_BASE}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: modifiedDecision,
        risk_assessment: state.riskAssessment,
        thesis: state.thesis,
        asset: state.asset
      })
    });
    if (!resp.ok) throw new Error(await resp.text());
    state.activePosition = await resp.json();

    log(`Order filled: ID=${state.activePosition.id} at $${state.activePosition.fill_price.toFixed(2)} (Fees: $${state.activePosition.fees})`);
    renderActivePosition();
    await loadPortfolio();
    highlightStep("step-execution");
  } catch (err) {
    log(`ERROR executing trade: ${err.message}`);
  }
}

async function closePositionManually() {
  if (!state.activePosition) return;
  try {
    log(`Closing position ${state.activePosition.id} manually at $${state.activePosition.current_price.toFixed(2)}...`);
    const resp = await fetch(`${API_BASE}/api/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        position_id: state.activePosition.id,
        current_price: state.activePosition.current_price
      })
    });
    if (!resp.ok) throw new Error(await resp.text());
    const review = await resp.json();

    log(`TRADE CLOSED MANUALLY: ${review.outcome} | Root cause: ${review.why}`);
    state.activePosition = null;
    renderActivePosition();
    renderTradeReview(review);
    highlightStep("step-review");
    await loadPortfolio();
    await loadMemory();
  } catch (err) {
    log(`ERROR closing position: ${err.message}`);
  }
}

function renderActivePosition() {
  const p = state.activePosition;
  const container = document.getElementById("activePositionContainer");
  if (!p || p.status === "CLOSED") {
    container.innerHTML = `<div style="color: #9ca3af; font-size: 0.85rem; padding: 10px;">No open position.</div>`;
    return;
  }

  const isProfit = p.net_pnl >= 0;
  container.innerHTML = `
    <div class="position-card">
      <div class="position-header">
        <span style="font-weight: 800; color: #60a5fa;">${p.id}</span>
        <span class="badge-tag">${p.direction} ${p.asset}</span>
      </div>
      <div class="pnl-hero ${isProfit ? "change-up" : "change-down"}">
        ${isProfit ? "+" : ""}$${p.net_pnl.toFixed(2)} (${isProfit ? "+" : ""}${p.return_pct.toFixed(2)}%)
      </div>
      <div class="position-metrics" style="margin-top: 10px;">
        <div><span style="color: #9ca3af; font-size: 0.75rem;">ENTRY:</span> $${p.fill_price.toFixed(2)}</div>
        <div><span style="color: #9ca3af; font-size: 0.75rem;">MARK:</span> $${p.current_price.toFixed(2)}</div>
        <div><span style="color: #9ca3af; font-size: 0.75rem;">SIZE:</span> ${p.quantity}</div>
        <div><span style="color: #9ca3af; font-size: 0.75rem;">SL:</span> $${p.stop_loss.toFixed(2)}</div>
        <div><span style="color: #9ca3af; font-size: 0.75rem;">TP:</span> $${p.take_profit.toFixed(2)}</div>
        <div><span style="color: #9ca3af; font-size: 0.75rem;">FEES:</span> $${p.fees.toFixed(2)}</div>
      </div>
      <button id="btnCloseManual" class="btn btn-danger" style="margin-top: 12px; width: 100%; justify-content: center; font-size: 0.8rem;">
        Close Position Manually
      </button>
    </div>
  `;

  const closeBtn = document.getElementById("btnCloseManual");
  if (closeBtn) {
    closeBtn.addEventListener("click", closePositionManually);
  }
}

// 5. Replay Mode & Stepping
async function startReplayScenario() {
  try {
    log(`Starting Replay Scenario: ${state.scenario}...`);
    const resp = await fetch(`${API_BASE}/api/replay/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: state.scenario })
    });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    state.context = data.market_context;
    state.portfolio = data.portfolio;
    state.replayFinished = false;

    renderContext();
    renderPortfolio();
    renderActivePosition();
    log(`Scenario loaded: ${data.scenario_info.description}`);
  } catch (err) {
    log(`ERROR starting replay: ${err.message}`);
  }
}

async function stepReplayBar() {
  try {
    const resp = await fetch(`${API_BASE}/api/replay/step`, { method: "POST" });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();

    if (data.status === "completed") {
      log("Replay scenario completed.");
      state.replayFinished = true;
      if (state.autoPlayTimer) toggleAutoPlay();
      return;
    }

    state.context = data.market_context;
    state.portfolio = data.portfolio;
    renderContext();
    renderPortfolio();

    // Check if any position closed
    if (data.closed_events && data.closed_events.length > 0) {
      for (const ev of data.closed_events) {
        log(`TRADE CLOSED: ${ev.outcome.closure_reason} at $${ev.outcome.exit_price.toFixed(2)} | Net P&L: $${ev.outcome.net_pnl.toFixed(2)}`);
        renderTradeReview(ev.review);
        highlightStep("step-review");
        await loadMemory();
      }
      state.activePosition = null;
      renderActivePosition();
    } else {
      // Update active position if still open
      if (state.portfolio.active_positions && state.portfolio.active_positions.length > 0) {
        state.activePosition = state.portfolio.active_positions[0];
        renderActivePosition();
      }
    }

    log(`Bar ${data.current_bar}/${data.total_bars} | Close: $${data.candle.close.toFixed(2)} | High: $${data.candle.high.toFixed(2)}`);
  } catch (err) {
    log(`ERROR stepping replay: ${err.message}`);
  }
}

function toggleAutoPlay() {
  const btn = document.getElementById("btnAutoPlay");
  if (state.autoPlayTimer) {
    clearInterval(state.autoPlayTimer);
    state.autoPlayTimer = null;
    btn.textContent = "Auto Play";
    btn.className = "btn btn-secondary";
  } else {
    btn.textContent = "Pause";
    btn.className = "btn btn-danger";
    state.autoPlayTimer = setInterval(async () => {
      if (state.replayFinished) {
        toggleAutoPlay();
      } else {
        await stepReplayBar();
      }
    }, 1200);
  }
}

// 6. Post-Trade Review & Memory
function renderTradeReview(review) {
  const container = document.getElementById("tradeReviewContainer");
  if (!review) return;

  const isWin = review.thesis_correct;
  container.innerHTML = `
    <div class="review-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span class="badge-tag" style="color: ${isWin ? "#10b981" : "#ef4444"}; font-weight: 800;">
          ${review.outcome}
        </span>
        <span style="font-size: 0.78rem; color: #9ca3af;">Quality: ${review.execution_quality}</span>
      </div>
      <div style="font-size: 0.84rem; margin-bottom: 6px;"><strong>What Worked:</strong> ${review.what_worked}</div>
      <div style="font-size: 0.84rem; margin-bottom: 6px;"><strong>What Failed:</strong> ${review.what_failed}</div>
      <div style="font-size: 0.84rem; margin-bottom: 8px; color: #93c5fd;"><strong>Root Cause:</strong> ${review.why}</div>
      <div style="margin-top: 8px;">
        <span style="font-size: 0.75rem; text-transform: uppercase; color: #9ca3af; font-weight: 700;">Lessons Learned & Persisted:</span><br>
        ${review.lessons_learned.map(l => `<span class="lesson-chip">${l}</span>`).join("")}
      </div>
    </div>
  `;
}

async function loadMemory() {
  try {
    const resp = await fetch(`${API_BASE}/api/memory`);
    if (!resp.ok) return;
    const data = await resp.json();
    const container = document.getElementById("memoryContainer");
    if (data.prior_learnings && data.prior_learnings.length > 0) {
      container.innerHTML = data.prior_learnings.map(l => `
        <div class="lesson-chip" style="display: block; margin-bottom: 6px;">* ${l}</div>
      `).join("");
    } else {
      container.innerHTML = `<span style="color: #9ca3af; font-size: 0.8rem;">No prior memory.</span>`;
    }
  } catch (err) {}
}

async function loadPortfolio() {
  try {
    const resp = await fetch(`${API_BASE}/api/portfolio`);
    if (!resp.ok) return;
    state.portfolio = await resp.json();
    renderPortfolio();
  } catch (err) {}
}

function renderPortfolio() {
  const p = state.portfolio;
  if (!p) return;

  document.getElementById("portEquity").textContent = `$${p.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  document.getElementById("portCash").textContent = `$${p.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  
  const pnlEl = document.getElementById("portRealizedPnl");
  const isUp = p.realized_pnl >= 0;
  pnlEl.textContent = `${isUp ? "+" : ""}$${p.realized_pnl.toFixed(2)}`;
  pnlEl.className = isUp ? "change-up" : "change-down";

  document.getElementById("portWinRate").textContent = `${p.win_rate}% (${p.winning_trades}W / ${p.losing_trades}L)`;
}

async function resetSystem() {
  if (confirm("Reset virtual account to $100,000 and restart scenario?")) {
    await fetch(`${API_BASE}/api/reset`, { method: "POST" });
    state.activePosition = null;
    state.thesis = null;
    state.decision = null;
    state.riskAssessment = null;
    if (state.autoPlayTimer) toggleAutoPlay();
    await initDashboard();
    log("System successfully reset.");
  }
}

function highlightStep(stepId) {
  document.querySelectorAll(".flow-step").forEach(el => el.classList.remove("active", "passed"));
  const current = document.getElementById(stepId);
  if (current) current.classList.add("active");
}
