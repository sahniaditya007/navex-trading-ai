'use client';

import React from 'react';
import { RotateCcw, Cpu, ShieldCheck, Activity, Terminal } from 'lucide-react';

interface HeaderNavProps {
  asset: string;
  onAssetChange: (asset: string) => void;
  mode: string;
  onModeChange: (mode: string) => void;
  scenario: string;
  onScenarioChange: (scenario: string) => void;
  onReset: () => void;
  isBackendConnected: boolean;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  asset,
  onAssetChange,
  mode,
  onModeChange,
  scenario,
  onScenarioChange,
  onReset,
  isBackendConnected,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-void/90 backdrop-blur-md border-b border-graphite">
      <div className="max-w-[1200px] mx-auto min-h-16 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Wordmark */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-carbon border border-graphite flex items-center justify-center font-mono-linear text-paper font-medium text-sm tracking-tight shadow-sm">
            <span className="text-acid-lime">N</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-sans font-medium text-[16px] text-paper tracking-[-0.011em]">
              NAVEX
            </span>
            <span className="hidden sm:inline font-sans text-ash text-[13px] font-normal">
              AI Trading
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-white/[0.04] border border-graphite text-[12px] text-fog font-mono-linear">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isBackendConnected ? 'bg-pulse-green' : 'bg-acid-lime'
              } animate-pulse`}
            />
            <span>{isBackendConnected ? 'API Connected' : 'Engine Standalone'}</span>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3 flex-wrap">
          {/* Asset Select */}
          <div className="flex items-center gap-1.5 text-xs text-fog">
            <span className="hidden lg:inline text-ash">Asset:</span>
            <select
              value={asset}
              onChange={(e) => onAssetChange(e.target.value)}
              className="linear-input w-[124px] text-xs py-1.5 px-2.5 bg-carbon border-graphite text-mist hover:border-smoke"
            >
              <option value="BTC/USDT">BTC/USDT</option>
              <option value="BTC/USD">BTC/USD</option>
              <option value="ETH/USD">ETH/USD</option>
              <option value="SOL/USD">SOL/USD</option>
              <option value="XAU/USD">XAU/USD (Gold)</option>
              <option value="EUR/USD">EUR/USD (Forex)</option>
            </select>
          </div>

          {/* Mode Select */}
          <div className="flex items-center gap-1.5 text-xs text-fog">
            <span className="hidden lg:inline text-ash">Mode:</span>
            <select
              value={mode}
              onChange={(e) => onModeChange(e.target.value)}
              className="linear-input w-[150px] text-xs py-1.5 px-2.5 bg-carbon border-graphite text-mist hover:border-smoke"
            >
              <option value="replay">Historical Replay</option>
              <option value="demo">Public Market Data</option>
              <option value="live" disabled>Live Exchange (disabled)</option>
            </select>
          </div>

          {/* Scenario Select (Replay mode only) */}
          {mode === 'replay' && (
            <div className="flex items-center gap-1.5 text-xs text-fog">
              <span className="hidden xl:inline text-ash">Scenario:</span>
              <select
                value={scenario}
                onChange={(e) => onScenarioChange(e.target.value)}
                className="linear-input w-[190px] max-w-[42vw] text-xs py-1.5 px-2.5 bg-carbon border-graphite text-mist hover:border-smoke truncate"
              >
                <option value="BTC_BULL_BREAKOUT">Bull Breakout (Win / TP)</option>
                <option value="BTC_BEAR_BREAKDOWN">Bear Breakdown (Short Win)</option>
                <option value="BTC_FAILED_BREAKOUT">Failed Breakout (Risk SL)</option>
              </select>
            </div>
          )}

          {/* Reset System Button */}
          <button
            onClick={onReset}
            className="btn-ghost-outline py-1.5 px-3 text-xs flex items-center gap-1.5 hover:text-paper"
            title="Reset virtual balance to $100,000"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
};
