'use client';

import React from 'react';
import { MarketContext } from '@/types/trading';
import { RefreshCw, Newspaper, BrainCircuit } from 'lucide-react';

interface MarketContextPanelProps {
  context: MarketContext | null;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const MarketContextPanel: React.FC<MarketContextPanelProps> = ({
  context,
  onRefresh,
  isLoading = false,
}) => {
  if (!context) {
    return (
      <div className="card-frame animate-pulse">
        <div className="h-6 w-36 bg-white/[0.04] rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-white/[0.02] rounded-[6px]" />
          ))}
        </div>
      </div>
    );
  }

  const isUp = context.recent_price_change_pct >= 0;
  const isBull = context.trend === 'BULLISH';

  return (
    <section className="card-frame flex flex-col gap-5">
      {/* Panel Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-sans font-medium text-[16px] text-paper tracking-[-0.011em]">
              Market Context & Microstructure
            </h2>
            <span className="px-2 py-0.5 rounded-[4px] bg-white/[0.04] border border-graphite text-[10px] font-mono-linear text-fog">
              🔵 Public API / ⚪ Replay Data
            </span>
          </div>
          <p className="font-sans text-[13px] text-ash font-normal">
            Real-time technical indicators, order book microstructure, and episodic memory feed
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="btn-ghost-outline py-1 px-2.5 text-xs flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Hero Price Strip */}
      <div className="flex items-baseline justify-between p-3.5 bg-void rounded-[8px] border border-graphite">
        <div>
          <div className="font-mono-linear text-[11px] text-ash uppercase tracking-tight">
            {context.asset} Mark Price
          </div>
          <div className="font-mono-linear text-[28px] font-medium text-paper tracking-[-0.012em]">
            ${context.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="text-right">
          <span
            className={`inline-block font-mono-linear text-[13px] px-2 py-0.5 rounded-[4px] font-medium ${
              isUp
                ? 'bg-pulse-green/10 text-pulse-green border border-pulse-green/30'
                : 'bg-coral-red/10 text-coral-red border border-coral-red/30'
            }`}
          >
            {isUp ? '+' : ''}
            {context.recent_price_change_pct.toFixed(2)}%
          </span>
          <div className="font-mono-linear text-[11px] text-ash mt-1">24h Vol: {context.volume_24h.toLocaleString('en-US')}</div>
        </div>
      </div>

      {/* 8-Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="card-frame-subtle">
          <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">Trend</div>
          <div
            className={`font-mono-linear text-[14px] font-medium mt-0.5 ${
              isBull ? 'text-pulse-green' : 'text-coral-red'
            }`}
          >
            {context.trend}
          </div>
        </div>

        <div className="card-frame-subtle">
          <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">Structure</div>
          <div className="font-mono-linear text-[13px] font-medium text-mist mt-0.5 truncate" title={context.market_structure}>
            {context.market_structure}
          </div>
        </div>

        <div className="card-frame-subtle">
          <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">RSI (14)</div>
          <div
            className={`font-mono-linear text-[14px] font-medium mt-0.5 ${
              context.rsi >= 70 ? 'text-coral-red' : context.rsi <= 30 ? 'text-pulse-green' : 'text-mist'
            }`}
          >
            {context.rsi.toFixed(1)}
          </div>
        </div>

        <div className="card-frame-subtle">
          <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">ATR (14)</div>
          <div className="font-mono-linear text-[14px] font-medium text-mist mt-0.5">
            ${context.atr.toFixed(2)}
          </div>
        </div>

        <div className="card-frame-subtle">
          <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">EMA 20</div>
          <div className="font-mono-linear text-[14px] font-medium text-[#02b8cc] mt-0.5">
            ${context.ema_20.toFixed(2)}
          </div>
        </div>

        <div className="card-frame-subtle">
          <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">EMA 50</div>
          <div className="font-mono-linear text-[14px] font-medium text-[#8b5cf6] mt-0.5">
            ${context.ema_50.toFixed(2)}
          </div>
        </div>

        <div className="card-frame-subtle">
          <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">Bid-Ask Spread</div>
          <div className="font-mono-linear text-[14px] font-medium text-mist mt-0.5">
            ${context.microstructure ? context.microstructure.bid_ask_spread.toFixed(2) : '--'}
          </div>
        </div>

        <div className="card-frame-subtle">
          <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">Depth Imbalance</div>
          <div
            className={`font-mono-linear text-[14px] font-medium mt-0.5 ${
              context.microstructure && context.microstructure.volume_imbalance > 0
                ? 'text-pulse-green'
                : 'text-coral-red'
            }`}
          >
            {context.microstructure
              ? `${context.microstructure.volume_imbalance > 0 ? '+' : ''}${context.microstructure.volume_imbalance.toFixed(2)}`
              : '--'}
          </div>
        </div>
      </div>

      {/* Curated News Ticker */}
      {context.recent_news && context.recent_news.length > 0 && (
        <div className="border-t border-graphite pt-3.5">
          <div className="flex items-center gap-2 mb-2.5 text-[11px] font-mono-linear text-ash uppercase">
            <Newspaper className="w-3.5 h-3.5 text-fog" />
            <span>Market News & Macro Catalysts</span>
          </div>

          <div className="space-y-2">
            {context.recent_news.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-2 rounded-[6px] bg-void/50 border border-graphite/60 text-xs"
              >
                <span className="font-mono-linear text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-[#02b8cc] flex-shrink-0">
                  {item.source}
                </span>
                <span className="text-mist leading-relaxed font-sans">{item.headline}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prior Trade Learnings Injected From Memory (Feedback Loop) */}
      {context.prior_learnings && context.prior_learnings.length > 0 && (
        <div className="border-t border-graphite pt-3.5">
          <div className="flex items-center gap-2 mb-2 text-[11px] font-mono-linear text-ash uppercase">
            <BrainCircuit className="w-3.5 h-3.5 text-[#8b5cf6]" />
            <span>Active Memory Feedback (Injected from SQLite)</span>
          </div>
          <div className="space-y-1.5">
            {context.prior_learnings.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                className="p-2 rounded-[6px] bg-void/60 border border-graphite/60 text-xs font-sans text-mist flex items-start gap-2"
              >
                <span className="text-[#8b5cf6] font-mono-linear text-[10px] mt-0.5">•</span>
                <span className="leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
