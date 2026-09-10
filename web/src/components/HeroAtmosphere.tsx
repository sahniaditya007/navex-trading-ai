'use client';

import React from 'react';
import { ArrowUpRight, Shield, Zap, Database } from 'lucide-react';

interface HeroAtmosphereProps {
  equity: number;
  winRate: number;
  activeTrades: number;
  scenarioName: string;
}

export const HeroAtmosphere: React.FC<HeroAtmosphereProps> = ({
  equity,
  winRate,
  activeTrades,
  scenarioName,
}) => {
  return (
    <div className="relative pt-12 pb-8 overflow-hidden border-b border-graphite/60">
      {/* Hero Atmospheric Gradient Floor */}
      <div className="absolute inset-0 pointer-events-none hero-gradient-floor opacity-80" />

      <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          {/* Main Typography */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] bg-white/[0.04] border border-graphite mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-pulse-green" />
              <span className="font-mono-linear text-[11px] text-fog uppercase tracking-tight">
                Simulated Evaluation Environment
              </span>
            </div>

            <h1 className="font-sans font-medium text-[36px] sm:text-[48px] lg:text-[56px] text-paper leading-[1.05] tracking-[-0.022em] mb-4">
              Autonomous Quantitative Precision.
            </h1>

            <p className="font-sans font-normal text-[15px] sm:text-[16px] text-fog leading-[1.5] max-w-xl">
              Midnight command center built on near-black substrate with deterministic 1% risk guardrails,
              structured multi-factor TradeThesis, and episodic SQLite memory persistence.
            </p>
          </div>

          {/* Quick Metrics Ticker Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 self-start md:self-end">
            <div className="card-frame-subtle min-w-[130px]">
              <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">
                Simulated Equity
              </div>
              <div className="font-mono-linear text-[16px] text-paper font-medium mt-0.5">
                ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="card-frame-subtle min-w-[120px]">
              <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">
                Win Rate
              </div>
              <div className="font-mono-linear text-[16px] text-paper font-medium mt-0.5">
                {winRate.toFixed(1)}%
              </div>
            </div>

            <div className="card-frame-subtle min-w-[120px] col-span-2 sm:col-span-1">
              <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">
                Risk Cap
              </div>
              <div className="font-mono-linear text-[16px] text-pulse-green font-medium mt-0.5 flex items-center gap-1">
                <span>1.00%</span>
                <span className="text-[10px] text-ash font-normal">MAX</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
