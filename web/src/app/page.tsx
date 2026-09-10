'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MarketContext,
  TradeThesis,
  TradeDecision,
  RiskAssessment,
  SimulatedPosition,
  PostTradeReview,
  PortfolioState,
} from '@/types/trading';
import {
  checkBackendHealth,
  fetchMarketContext,
  runAiAnalysis,
  validateTrade,
  executeSimulatedTrade,
  closeSimulatedTrade,
  startReplayScenario,
  stepReplayBar,
  fetchPortfolio,
  fetchMemory,
  resetSystem,
} from '@/lib/api';

import { HeaderNav } from '@/components/HeaderNav';
import { WorkflowRibbon, WorkflowStepId } from '@/components/WorkflowRibbon';
import { HeroAtmosphere } from '@/components/HeroAtmosphere';
import { CandlestickChart } from '@/components/CandlestickChart';
import { ReplayControlBar } from '@/components/ReplayControlBar';
import { MarketContextPanel } from '@/components/MarketContextPanel';
import { PortfolioLedger } from '@/components/PortfolioLedger';
import { AiAnalystPanel } from '@/components/AiAnalystPanel';
import { RiskEnginePanel } from '@/components/RiskEnginePanel';
import { PaperExecutionPanel } from '@/components/PaperExecutionPanel';
import { PostTradeReviewPanel } from '@/components/PostTradeReviewPanel';
import { EpisodicMemoryPanel } from '@/components/EpisodicMemoryPanel';
import { SystemAuditLog } from '@/components/SystemAuditLog';
import { CustomerStrip } from '@/components/CustomerStrip';

export default function NavexDashboard() {
  // Global configuration
  const [asset, setAsset] = useState('BTC/USDT');
  const [mode, setMode] = useState('replay');
  const [scenario, setScenario] = useState('BTC_BULL_BREAKOUT');
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Workflow step
  const [currentStep, setCurrentStep] = useState<WorkflowStepId>('context');

  // Core Trading State
  const [context, setContext] = useState<MarketContext | null>(null);
  const [thesis, setThesis] = useState<TradeThesis | null>(null);
  const [decision, setDecision] = useState<TradeDecision | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [activePosition, setActivePosition] = useState<SimulatedPosition | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [reviews, setReviews] = useState<PostTradeReview[]>([]);
  const [memories, setMemories] = useState<string[]>([]);

  // Replay State
  const [currentBar, setCurrentBar] = useState(21);
  const [totalBars, setTotalBars] = useState(28);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Loading States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Audit Logs
  const [logs, setLogs] = useState<string[]>([]);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
  }, []);

  // Initial Load
  useEffect(() => {
    async function init() {
      addLog('Initializing NAVEX Autonomous Quantitative Command Center...');
      const connected = await checkBackendHealth();
      setIsBackendConnected(connected);
      if (connected) {
        addLog('FastAPI REST Engine connected at http://127.0.0.1:8000.');
      } else {
        addLog('Operating in Autonomous Standalone simulation mode.');
      }

      // Load initial portfolio & memory
      const port = await fetchPortfolio();
      setPortfolio(port);

      const mem = await fetchMemory();
      setMemories(mem.prior_learnings);
      setReviews(mem.recent_reviews);

      // Start default scenario
      await loadScenarioData('BTC_BULL_BREAKOUT');
    }
    init();
  }, [addLog]);

  // Load Scenario Data
  const loadScenarioData = async (scenId: string) => {
    try {
      addLog(`Loading Scenario: ${scenId}...`);
      const resp = await startReplayScenario(scenId);
      setContext(resp.market_context);
      setPortfolio(resp.portfolio);
      setCurrentBar(resp.scenario_info.initial_visible_bars);
      setTotalBars(resp.scenario_info.total_bars);
      setIsFinished(false);
      setThesis(null);
      setDecision(null);
      setRiskAssessment(null);
      setActivePosition(null);
      setCurrentStep('context');
      addLog(`Scenario Ready: ${resp.scenario_info.description}`);
    } catch (err: any) {
      addLog(`ERROR loading scenario: ${err.message}`);
    }
  };

  // Switch Scenario
  const handleScenarioChange = (newScen: string) => {
    setScenario(newScen);
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
      setIsPlaying(false);
    }
    loadScenarioData(newScen);
  };

  // Switch Mode
  const handleModeChange = (newMode: string) => {
    setMode(newMode);
    addLog(`Switched operational mode to: ${newMode}`);
    if (newMode === 'replay') {
      loadScenarioData(scenario);
    } else {
      handleRefreshContext();
    }
  };

  const handleAssetChange = (newAsset: string) => {
    setAsset(newAsset);
    if (mode !== 'replay') {
      void handleRefreshContext(newAsset);
    }
  };

  // Refresh Context
  const handleRefreshContext = async (assetOverride = asset) => {
    setIsRefreshing(true);
    try {
      addLog(`Fetching updated market context for ${assetOverride}...`);
      const ctx = await fetchMarketContext(assetOverride, '1h', mode);
      setContext(ctx);
      setCurrentStep('context');
      addLog(`Context synchronized at mark price $${ctx.current_price.toFixed(2)}`);
    } catch (err: any) {
      addLog(`ERROR refreshing context: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 1. Run AI Analysis
  const handleRunAnalysis = async () => {
    if (!context) return;
    setIsAnalyzing(true);
    setCurrentStep('analysis');
    addLog('AI Analyst Agent synthesizing structured TradeThesis...');
    try {
      const { thesis: newThesis, decision: newDecision } = await runAiAnalysis(context);
      setThesis(newThesis);
      setDecision(newDecision);
      addLog(`THESIS: Bias = ${newThesis.bias} | Confidence = ${(newThesis.confidence * 100).toFixed(0)}%`);

      // Automatically evaluate risk guardrails
      setIsValidating(true);
      addLog('Deterministic Risk Engine evaluating mathematical constraints & position sizing...');
      const assessment = await validateTrade(newDecision, portfolio?.equity);
      setRiskAssessment(assessment);
      setIsValidating(false);

      if (assessment.status === 'APPROVED') {
        addLog(
          `RISK APPROVED: Sized to ${assessment.calculated_position_size} BTC ($${assessment.risk_amount.toFixed(2)} / 1.00% risk)`
        );
      } else {
        addLog(`RISK VETO: Trade proposal rejected by deterministic guardrails.`);
      }
    } catch (err: any) {
      addLog(`ERROR formulating analysis: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 2. Validate Risk Manually
  const handleValidateRisk = async () => {
    if (!decision) return;
    setIsValidating(true);
    setCurrentStep('execution');
    addLog('Deterministic Risk Engine verifying guardrail checklist...');
    try {
      const assessment = await validateTrade(decision, portfolio?.equity);
      setRiskAssessment(assessment);
      addLog(`Risk evaluation complete: ${assessment.status}`);
    } catch (err: any) {
      addLog(`ERROR during risk validation: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  // 3. Execute Simulated Paper Trade
  const handleExecuteTrade = async (parameterOverride?: TradeDecision) => {
    const proposedDecision = parameterOverride || decision;
    if (!proposedDecision || !riskAssessment || riskAssessment.status !== 'APPROVED') {
      addLog('Cannot execute: Trade is not approved by Deterministic Risk Engine.');
      return;
    }
    setIsExecuting(true);
    setCurrentStep('execution');
    addLog('Simulating paper execution with slippage and taker fee deduction...');
    try {
      const finalAssessment = parameterOverride
        ? await validateTrade(proposedDecision, portfolio?.equity)
        : riskAssessment;
      if (finalAssessment.status !== 'APPROVED') {
        setRiskAssessment(finalAssessment);
        addLog('Cannot execute: edited parameters failed deterministic risk validation.');
        return;
      }
      setRiskAssessment(finalAssessment);
      const pos = await executeSimulatedTrade(proposedDecision, finalAssessment, thesis || undefined, asset);
      setActivePosition(pos);
      addLog(`ORDER FILLED: ${pos.id} ${pos.direction} ${pos.quantity} BTC at $${pos.fill_price.toFixed(2)} (Fees: $${pos.fees})`);

      const updatedPort = await fetchPortfolio();
      setPortfolio(updatedPort);
    } catch (err: any) {
      addLog(`ERROR executing simulated trade: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // 4. Step Replay Bar
  const handleStepReplay = async () => {
    try {
      const res = await stepReplayBar();
      if (res.status === 'completed' || res.is_finished) {
        setIsFinished(true);
        if (autoPlayRef.current) {
          clearInterval(autoPlayRef.current);
          autoPlayRef.current = null;
          setIsPlaying(false);
        }
        addLog('Replay scenario sequence reached termination bar.');
      }

      setContext(res.market_context);
      setPortfolio(res.portfolio);
      setCurrentBar(res.current_bar);
      setTotalBars(res.total_bars);

      // Check for closed trade events
      if (res.closed_events && res.closed_events.length > 0) {
        for (const ev of res.closed_events) {
          addLog(
            `TRADE CLOSED: ${ev.outcome.closure_reason} at $${ev.outcome.exit_price.toFixed(2)} | Net P&L: $${ev.outcome.net_pnl.toFixed(2)}`
          );
          setActivePosition(null);
          setReviews((prev) => [ev.review, ...prev]);
          setMemories((prev) => [ev.review.lessons_learned[0], ...prev]);
          setCurrentStep('review');
        }
      } else if (res.portfolio.active_positions && res.portfolio.active_positions.length > 0) {
        setActivePosition(res.portfolio.active_positions[0]);
      }
    } catch (err: any) {
      addLog(`ERROR advancing bar: ${err.message}`);
    }
  };

  const handleCloseTrade = async () => {
    if (!activePosition) return;
    try {
      const review = await closeSimulatedTrade(activePosition.id, activePosition.current_price);
      setActivePosition(null);
      setReviews((prev) => [review, ...prev]);
      setMemories((prev) => [...(review.lessons_learned || []), ...prev]);
      setCurrentStep('review');
      const updatedPortfolio = await fetchPortfolio();
      setPortfolio(updatedPortfolio);
      addLog(`TRADE CLOSED MANUALLY: ${review.outcome}`);
    } catch (err: any) {
      addLog(`ERROR closing trade: ${err.message}`);
    }
  };

  // 5. Toggle Auto Play
  const handleTogglePlay = () => {
    if (isPlaying) {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
      setIsPlaying(false);
      addLog('Playback paused.');
    } else {
      setIsPlaying(true);
      addLog(`Playback started at ${playbackSpeed}x velocity.`);
      const intervalMs = Math.max(300, 1200 / playbackSpeed);
      autoPlayRef.current = setInterval(async () => {
        await handleStepReplay();
      }, intervalMs);
    }
  };

  // Playback speed change
  const handleSpeedChange = (spd: number) => {
    setPlaybackSpeed(spd);
    if (isPlaying) {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
      const intervalMs = Math.max(300, 1200 / spd);
      autoPlayRef.current = setInterval(async () => {
        await handleStepReplay();
      }, intervalMs);
    }
  };

  // 6. Reset System
  const handleReset = async () => {
    if (confirm('Reset virtual portfolio to $100,000 and restart scenario?')) {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
        setIsPlaying(false);
      }
      await resetSystem();
      setThesis(null);
      setDecision(null);
      setRiskAssessment(null);
      setActivePosition(null);
      await loadScenarioData(scenario);
      addLog('System successfully reset to $100,000 starting virtual balance.');
    }
  };

  const handleStepClick = (step: WorkflowStepId) => {
    setCurrentStep(step);
    const targetMap: Record<WorkflowStepId, string> = {
      context: 'market-context-section',
      analysis: 'ai-analyst-section',
      execution: 'paper-execution-section',
      review: 'post-trade-review-section',
      memory: 'episodic-memory-section',
    };
    const el = document.getElementById(targetMap[step]);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-void flex flex-col justify-between selection:bg-acid-lime selection:text-void">
      <div>
        {/* Sticky Precision Header */}
        <HeaderNav
          asset={asset}
          onAssetChange={handleAssetChange}
          mode={mode}
          onModeChange={handleModeChange}
          scenario={scenario}
          onScenarioChange={handleScenarioChange}
          onReset={handleReset}
          isBackendConnected={isBackendConnected}
        />

        {/* 5-Stage Workflow Ribbon */}
        <WorkflowRibbon
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />

        {/* Atmospheric Display Hero */}
        <HeroAtmosphere
          equity={portfolio?.equity || 100000}
          winRate={portfolio?.win_rate || 0}
          activeTrades={portfolio?.total_trades || 0}
          scenarioName={scenario}
        />

        {/* Main Dashboard Surface */}
        <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
          <div className="grid min-w-0 grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: 7 cols - Chart, Replay Bar, Context, Portfolio, Terminal */}
            <div className="min-w-0 lg:col-span-7 flex flex-col gap-6">
              {/* Candlestick Chart */}
              <CandlestickChart
                candles={context?.candles || []}
                overlays={{
                  entry: decision?.entry || activePosition?.fill_price,
                  stopLoss: decision?.stop_loss || activePosition?.stop_loss,
                  takeProfit: decision?.take_profit || activePosition?.take_profit,
                }}
                height={380}
              />

              {/* Replay Controls (in replay mode) */}
              {mode === 'replay' && (
                <ReplayControlBar
                  currentBar={currentBar}
                  totalBars={totalBars}
                  isPlaying={isPlaying}
                  isFinished={isFinished}
                  onStep={handleStepReplay}
                  onTogglePlay={handleTogglePlay}
                  speed={playbackSpeed}
                  onSpeedChange={handleSpeedChange}
                />
              )}

              {/* Market Context & Microstructure */}
              <div id="market-context-section">
                <MarketContextPanel
                  context={context}
                  onRefresh={handleRefreshContext}
                  isLoading={isRefreshing}
                />
              </div>

              {/* Portfolio Balance Ledger */}
              <PortfolioLedger portfolio={portfolio} />

              {/* Real-time Terminal Log */}
              <SystemAuditLog
                logs={logs}
                onClear={() => setLogs([])}
              />
            </div>

            {/* RIGHT COLUMN: 5 cols - AI Analyst, Risk Guardrails, Paper Execution */}
            <div className="min-w-0 lg:col-span-5 flex flex-col gap-6">
              {/* AI Analyst Agent with the ONLY Acid-Lime Primary Action Button */}
              <div id="ai-analyst-section">
                <AiAnalystPanel
                  thesis={thesis}
                  onRunAnalysis={handleRunAnalysis}
                  isLoading={isAnalyzing}
                />
              </div>

              {/* Deterministic Risk Engine */}
              <RiskEnginePanel
                assessment={riskAssessment}
                onValidate={handleValidateRisk}
                isValidating={isValidating}
              />

              {/* Simulated Paper Execution */}
              <div id="paper-execution-section">
                <PaperExecutionPanel
                  activePosition={activePosition}
                  riskAssessment={riskAssessment}
                  onExecute={handleExecuteTrade}
                  onClose={handleCloseTrade}
                  isExecuting={isExecuting}
                />
              </div>

            </div>

            {/* Full-width feedback surfaces keep long-form review content aligned
                instead of creating a large empty area beside a tall right rail. */}
            <div className="lg:col-span-12 grid grid-cols-1 xl:grid-cols-2 gap-6">
              <PostTradeReviewPanel reviews={reviews} />
              <EpisodicMemoryPanel learnings={memories} />
            </div>
          </div>
        </main>
      </div>

      {/* Linear Customer & Technology Strip */}
      <CustomerStrip />
    </div>
  );
}
