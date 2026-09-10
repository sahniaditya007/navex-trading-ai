'use client';

import React, { useEffect, useState } from 'react';
import { SimulatedPosition, RiskAssessment, TradeDecision } from '@/types/trading';
import { Play, TrendingUp, TrendingDown, ArrowRight, ShieldCheck } from 'lucide-react';

interface PaperExecutionPanelProps {
  activePosition: SimulatedPosition | null;
  riskAssessment: RiskAssessment | null;
  onExecute: (decision: TradeDecision) => void;
  onClose?: () => void;
  isExecuting?: boolean;
}

export const PaperExecutionPanel: React.FC<PaperExecutionPanelProps> = ({
  activePosition,
  riskAssessment,
  onExecute,
  onClose,
  isExecuting = false,
}) => {
  const isApproved = riskAssessment && riskAssessment.status === 'APPROVED';
  const canExecute = isApproved && !activePosition;
  const [parameters, setParameters] = useState({
    entry: '',
    stop_loss: '',
    take_profit: '',
    position_size: '',
  });

  useEffect(() => {
    if (!riskAssessment) return;
    const d = riskAssessment.decision;
    setParameters({
      entry: String(d.entry),
      stop_loss: String(d.stop_loss),
      take_profit: String(d.take_profit),
      position_size: String(riskAssessment.calculated_position_size),
    });
  }, [riskAssessment]);

  const entryNum = parseFloat(parameters.entry) || 0;
  const slNum = parseFloat(parameters.stop_loss) || 0;
  const tpNum = parseFloat(parameters.take_profit) || 0;
  const sizeNum = parseFloat(parameters.position_size) || 0;

  const isLong = (riskAssessment?.decision.direction ?? 'LONG') === 'LONG';
  const potentialProfit = isLong ? (tpNum - entryNum) * sizeNum : (entryNum - tpNum) * sizeNum;
  const potentialLoss = isLong ? (entryNum - slNum) * sizeNum : (slNum - entryNum) * sizeNum;
  const calculatedRR = potentialLoss > 0 ? (potentialProfit / potentialLoss).toFixed(2) : '--';

  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = () => {
    if (!riskAssessment) return;
    if (entryNum <= 0 || slNum <= 0 || tpNum <= 0 || sizeNum <= 0) {
      setValidationError('All execution parameters must be positive numbers.');
      return;
    }
    if (isLong && (slNum >= entryNum || tpNum <= entryNum)) {
      setValidationError('For LONG trades: Stop Loss < Entry < Take Profit.');
      return;
    }
    if (!isLong && (tpNum >= entryNum || slNum <= entryNum)) {
      setValidationError('For SHORT trades: Take Profit < Entry < Stop Loss.');
      return;
    }
    setValidationError(null);
    onExecute({
      ...riskAssessment.decision,
      entry: entryNum,
      stop_loss: slNum,
      take_profit: tpNum,
      position_size: sizeNum,
    });
  };

  return (
    <section className="card-frame flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-sans font-medium text-[16px] text-paper tracking-[-0.011em]">
              Simulated Execution
            </h2>
            <span className="px-2 py-0.5 rounded-[4px] bg-white/[0.04] border border-graphite text-[10px] font-mono-linear text-fog">
              ⚪ Zero Live Risk
            </span>
          </div>
          <p className="font-sans text-[13px] text-ash font-normal">
            Includes realistic taker fees (0.05%) and order-book execution slippage
          </p>
        </div>

        {/* Secondary Action - White Pill Neutral */}
        <button
          onClick={submit}
          disabled={!canExecute || isExecuting}
          className="btn-pill-neutral disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <span>{isExecuting ? 'Submitting...' : 'Simulate Trade'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {riskAssessment && !activePosition && (
        <div className="space-y-3 rounded-[8px] border border-graphite bg-void/60 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-mono-linear uppercase text-ash">
              ⚪ User-Defined Trade Parameters
            </p>
            <span className="text-[10px] font-mono-linear text-[#02b8cc]">
              Editable Before Fill
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {(['entry', 'stop_loss', 'take_profit', 'position_size'] as const).map((field) => (
              <label key={field} className="min-w-0 text-[10px] font-mono-linear uppercase text-ash">
                {field.replace('_', ' ')}
                <input
                  className="linear-input mt-1 w-full min-w-0"
                  type="number"
                  min="0"
                  step="any"
                  value={parameters[field]}
                  onChange={(event) => {
                    setValidationError(null);
                    setParameters((current) => ({ ...current, [field]: event.target.value }));
                  }}
                />
              </label>
            ))}
          </div>

          {/* Live Simulated P&L Preview Calculation */}
          {entryNum > 0 && sizeNum > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-graphite/60 text-center">
              <div className="p-2 rounded bg-white/[0.02] border border-graphite/40">
                <span className="text-[10px] font-mono-linear text-ash block">Est. Profit @ TP</span>
                <span className={`text-xs font-mono-linear font-medium ${potentialProfit >= 0 ? 'text-pulse-green' : 'text-coral-red'}`}>
                  {potentialProfit >= 0 ? '+' : ''}${potentialProfit.toFixed(2)}
                </span>
              </div>
              <div className="p-2 rounded bg-white/[0.02] border border-graphite/40">
                <span className="text-[10px] font-mono-linear text-ash block">Est. Loss @ SL</span>
                <span className="text-xs font-mono-linear font-medium text-coral-red">
                  -${Math.abs(potentialLoss).toFixed(2)}
                </span>
              </div>
              <div className="p-2 rounded bg-white/[0.02] border border-graphite/40">
                <span className="text-[10px] font-mono-linear text-ash block">Est. R:R Ratio</span>
                <span className="text-xs font-mono-linear font-medium text-paper">
                  {calculatedRR}:1
                </span>
              </div>
            </div>
          )}

          {validationError && (
            <div className="text-xs text-coral-red font-mono-linear bg-coral-red/10 border border-coral-red/30 p-2 rounded">
              {validationError}
            </div>
          )}
        </div>
      )}

      {activePosition ? (
        <div className="p-4 rounded-[8px] bg-void border border-graphite space-y-4">
          {/* Position Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono-linear text-xs font-medium text-paper">
                {activePosition.id}
              </span>
              <span
                className={`font-mono-linear text-[11px] px-2 py-0.5 rounded-[4px] font-medium ${
                  activePosition.direction === 'LONG'
                    ? 'bg-pulse-green/10 text-pulse-green border border-pulse-green/30'
                    : 'bg-coral-red/10 text-coral-red border border-coral-red/30'
                }`}
              >
                {activePosition.direction} {activePosition.asset}
              </span>
            </div>

            <div className="font-mono-linear text-[11px] text-pulse-green flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-pulse-green animate-ping" />
              <span>POSITION ACTIVE</span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="btn-ghost-outline w-full text-xs text-coral-red hover:border-coral-red/50"
            >
              Mark trade complete at current mark
            </button>
          )}

          {/* Hero PnL */}
          <div className="p-3 rounded-[6px] bg-white/[0.02] border border-graphite/60 flex items-baseline justify-between">
            <div>
              <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">
                Unrealized Net P&L (Post-Fees)
              </div>
              <div
                className={`font-mono-linear text-[24px] font-medium mt-0.5 ${
                  activePosition.net_pnl >= 0 ? 'text-pulse-green' : 'text-coral-red'
                }`}
              >
                {activePosition.net_pnl >= 0 ? '+' : ''}${activePosition.net_pnl.toFixed(2)}
                <span className="text-[13px] ml-2 opacity-80">
                  ({activePosition.net_pnl >= 0 ? '+' : ''}
                  {activePosition.return_pct.toFixed(2)}%)
                </span>
              </div>
            </div>

            <div className="text-right font-mono-linear text-xs text-ash">
              Fees: ${activePosition.fees.toFixed(2)}
            </div>
          </div>

          {/* Position Parameters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono-linear">
            <div className="p-2 rounded bg-white/[0.02] border border-graphite/40">
              <span className="text-ash block text-[10px]">ENTRY FILL</span>
              <span className="text-mist">${activePosition.fill_price.toFixed(2)}</span>
            </div>
            <div className="p-2 rounded bg-white/[0.02] border border-graphite/40">
              <span className="text-ash block text-[10px]">CURRENT MARK</span>
              <span className="text-paper">${activePosition.current_price.toFixed(2)}</span>
            </div>
            <div className="p-2 rounded bg-white/[0.02] border border-graphite/40">
              <span className="text-ash block text-[10px]">POSITION SIZE</span>
              <span className="text-mist">{activePosition.quantity} BTC</span>
            </div>
            <div className="p-2 rounded bg-white/[0.02] border border-graphite/40">
              <span className="text-ash block text-[10px]">STOP LOSS</span>
              <span className="text-coral-red">${activePosition.stop_loss.toFixed(2)}</span>
            </div>
            <div className="p-2 rounded bg-white/[0.02] border border-graphite/40">
              <span className="text-ash block text-[10px]">TAKE PROFIT</span>
              <span className="text-pulse-green">${activePosition.take_profit.toFixed(2)}</span>
            </div>
            <div className="p-2 rounded bg-white/[0.02] border border-graphite/40">
              <span className="text-ash block text-[10px]">SLIPPAGE COST</span>
              <span className="text-ash">${activePosition.slippage_cost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-[8px] border border-dashed border-graphite text-center">
          <p className="font-sans text-[13px] text-fog">
            No active open position. Run AI Analysis and click &ldquo;Simulate Trade&rdquo; to execute paper order.
          </p>
        </div>
      )}
    </section>
  );
};
