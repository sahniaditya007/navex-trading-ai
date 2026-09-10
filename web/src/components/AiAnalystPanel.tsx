'use client';

import React from 'react';
import { TradeThesis } from '@/types/trading';
import { Sparkles, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AiAnalystPanelProps {
  thesis: TradeThesis | null;
  onRunAnalysis: () => void;
  isLoading?: boolean;
}

export const AiAnalystPanel: React.FC<AiAnalystPanelProps> = ({
  thesis,
  onRunAnalysis,
  isLoading = false,
}) => {
  return (
    <section className="card-frame flex flex-col gap-5">
      {/* Panel Header with the single Acid Lime Primary Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-sans font-medium text-[16px] text-paper tracking-[-0.011em]">
              AI Analyst Agent
            </h2>
            <span className="px-2 py-0.5 rounded-[4px] bg-white/[0.04] border border-graphite text-[10px] font-mono-linear text-fog">
              🔵 LLM / ⚪ Deterministic
            </span>
          </div>
          <p className="font-sans text-[13px] text-ash font-normal mt-0.5">
            Formulates structured TradeThesis with explicit bias, key levels, risks, and reasoning
          </p>
        </div>

        {/* PRIMARY ACTION BUTTON (Acid Lime) - The ONLY chromatic action in the system */}
        <button
          onClick={onRunAnalysis}
          disabled={isLoading}
          className="btn-primary-action flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Synthesizing...' : 'Run AI Analysis'}</span>
        </button>
      </div>

      {thesis ? (
        <div className="space-y-4">
          {/* Bias & Confidence Bar */}
          <div className="flex items-center justify-between p-3 rounded-[8px] bg-void border border-graphite">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono-linear text-ash">DECISION CONCLUSION:</span>
              <span
                className={`font-mono-linear text-xs px-2 py-0.5 rounded-[4px] font-medium tracking-tight ${
                  thesis.bias === 'LONG'
                    ? 'bg-pulse-green/10 text-pulse-green border border-pulse-green/30'
                    : thesis.bias === 'SHORT'
                    ? 'bg-coral-red/10 text-coral-red border border-coral-red/30'
                    : 'bg-white/[0.05] text-fog border-graphite'
                }`}
              >
                {thesis.bias}
              </span>
            </div>

            <div className="font-mono-linear text-xs text-fog">
              Confidence:{' '}
              <span className="text-paper font-medium">
                {(thesis.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Thesis Narrative */}
          <div className="p-3.5 rounded-[8px] bg-white/[0.02] border border-graphite">
            <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight mb-1.5">
              Synthesis & Market Thesis Narrative
            </div>
            <p className="font-sans text-[14px] text-mist leading-[1.6]">
              {thesis.thesis}
            </p>
          </div>

          {/* Key Levels Grid (Entry, Stop Loss, Take Profit) */}
          {thesis.key_levels && Object.keys(thesis.key_levels).length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded bg-void border border-graphite/80 text-center">
                <span className="font-mono-linear text-[10px] uppercase text-ash block">Proposed Entry</span>
                <span className="font-mono-linear text-xs font-medium text-paper">
                  ${thesis.key_levels.entry?.toFixed(2) ?? '--'}
                </span>
              </div>
              <div className="p-2 rounded bg-void border border-graphite/80 text-center">
                <span className="font-mono-linear text-[10px] uppercase text-ash block">Stop Loss</span>
                <span className="font-mono-linear text-xs font-medium text-coral-red">
                  ${thesis.key_levels.stop_loss?.toFixed(2) ?? '--'}
                </span>
              </div>
              <div className="p-2 rounded bg-void border border-graphite/80 text-center">
                <span className="font-mono-linear text-[10px] uppercase text-ash block">Take Profit</span>
                <span className="font-mono-linear text-xs font-medium text-pulse-green">
                  ${thesis.key_levels.take_profit?.toFixed(2) ?? '--'}
                </span>
              </div>
            </div>
          )}

          {/* Invalidation Condition */}
          <div className="p-3 rounded-[8px] bg-coral-red/[0.04] border border-coral-red/20">
            <div className="flex items-center gap-1.5 font-mono-linear text-[11px] text-coral-red font-medium uppercase mb-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Invalidation Condition</span>
            </div>
            <p className="font-sans text-[13px] text-mist">
              {thesis.invalidation_condition}
            </p>
          </div>

          {/* Risk Considerations */}
          {thesis.risk_considerations && thesis.risk_considerations.length > 0 && (
            <div className="p-3 rounded-[8px] bg-void/70 border border-graphite/80 space-y-1">
              <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">
                Identified Risk Considerations
              </div>
              <ul className="space-y-1">
                {thesis.risk_considerations.map((r, i) => (
                  <li key={i} className="text-xs text-mist font-sans flex items-start gap-1.5">
                    <span className="text-coral-red">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Supporting Confluences vs Conflicting Risks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-mono-linear text-[11px] text-pulse-green uppercase font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Supporting Confluences</span>
              </div>
              <ul className="space-y-1.5">
                {thesis.supporting_factors.map((f, i) => (
                  <li
                    key={i}
                    className="p-2 rounded-[6px] bg-void/60 border border-graphite text-[12px] text-mist leading-snug font-sans"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-mono-linear text-[11px] text-coral-red uppercase font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Conflicting Risks</span>
              </div>
              <ul className="space-y-1.5">
                {thesis.conflicting_factors.map((f, i) => (
                  <li
                    key={i}
                    className="p-2 rounded-[6px] bg-void/60 border border-graphite text-[12px] text-mist leading-snug font-sans"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-[8px] border border-dashed border-graphite text-center flex flex-col items-center justify-center">
          <Sparkles className="w-6 h-6 text-ash mb-2" />
          <p className="font-sans text-[13px] text-fog max-w-sm">
            Awaiting analysis. Click &ldquo;Run AI Analysis&rdquo; to formulate a structured TradeThesis incorporating
            momentum, depth imbalance, and episodic memory.
          </p>
        </div>
      )}
    </section>
  );
};
