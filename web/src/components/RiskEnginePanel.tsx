'use client';

import React from 'react';
import { RiskAssessment } from '@/types/trading';
import { Shield, Check, X, ShieldAlert } from 'lucide-react';

interface RiskEnginePanelProps {
  assessment: RiskAssessment | null;
  onValidate?: () => void;
  isValidating?: boolean;
}

export const RiskEnginePanel: React.FC<RiskEnginePanelProps> = ({
  assessment,
  onValidate,
  isValidating = false,
}) => {
  return (
    <section className="card-frame flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-sans font-medium text-[16px] text-paper tracking-[-0.011em]">
              Deterministic Risk Guardrails (1% Cap)
            </h2>
            <span className="px-2 py-0.5 rounded-[4px] bg-white/[0.04] border border-graphite text-[10px] font-mono-linear text-fog">
              Veto Authority
            </span>
          </div>
          <p className="font-sans text-[13px] text-ash font-normal">
            Mathematical constraints enforced before any paper execution is permitted
          </p>
        </div>

        {onValidate && (
          <button
            onClick={onValidate}
            disabled={isValidating}
            className="btn-ghost-outline py-1 px-2.5 text-xs"
          >
            {isValidating ? 'Validating...' : 'Validate'}
          </button>
        )}
      </div>

      {assessment ? (
        <div className="space-y-4">
          {/* Status Ribbon */}
          <div className="flex items-center justify-between p-3 rounded-[8px] bg-void border border-graphite">
            <div className="flex items-center gap-2 font-mono-linear text-xs">
              <span className="text-ash">ENGINE STATUS:</span>
              <span
                className={`px-2 py-0.5 rounded-[4px] font-medium ${
                  assessment.status === 'APPROVED'
                    ? 'bg-pulse-green/10 text-pulse-green border border-pulse-green/30'
                    : 'bg-coral-red/10 text-coral-red border border-coral-red/30'
                }`}
              >
                {assessment.status}
              </span>
            </div>

            <div className="font-mono-linear text-xs text-fog">
              Risk:{' '}
              <span className="text-pulse-green font-medium">
                ${assessment.risk_amount.toFixed(2)} ({assessment.risk_percentage.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Sizing & Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="card-frame-subtle">
              <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">Position Sized</div>
              <div className="font-mono-linear text-[14px] font-medium text-paper mt-0.5">
                {assessment.calculated_position_size} BTC
              </div>
            </div>

            <div className="card-frame-subtle">
              <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">Risk / Reward</div>
              <div className="font-mono-linear text-[14px] font-medium text-pulse-green mt-0.5">
                {assessment.risk_reward_ratio}:1
              </div>
            </div>

            <div className="card-frame-subtle">
              <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">Stop Distance</div>
              <div className="font-mono-linear text-[14px] font-medium text-mist mt-0.5">
                ${assessment.stop_distance.toFixed(1)} ({assessment.stop_distance_pct}%)
              </div>
            </div>
          </div>

          {/* Deterministic Guardrail Checklist */}
          <div className="min-w-0 space-y-1.5 pt-1">
            <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight mb-1">
              Deterministic Guardrail Checklist
            </div>
            {assessment.checks.map((check, idx) => (
              <div
                key={idx}
                className="flex min-w-0 items-center justify-between gap-3 p-2 rounded-[6px] bg-void/50 border border-graphite text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono-linear ${
                      check.passed
                        ? 'bg-pulse-green/20 text-pulse-green'
                        : 'bg-coral-red/20 text-coral-red'
                    }`}
                  >
                    {check.passed ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                  </span>
                  <span className="min-w-0 truncate font-sans text-mist" title={check.check_name}>{check.check_name}</span>
                </div>
                <span
                  className={`font-mono-linear text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    check.passed ? 'text-pulse-green bg-pulse-green/10' : 'text-coral-red bg-coral-red/10'
                  }`}
                >
                  {check.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-[8px] border border-dashed border-graphite text-center">
          <p className="font-sans text-[13px] text-fog">
            Guardrails will automatically validate position sizing and R:R threshold once AI thesis is formed.
          </p>
        </div>
      )}
    </section>
  );
};
