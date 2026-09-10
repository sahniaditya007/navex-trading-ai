'use client';

import React from 'react';
import { PortfolioState } from '@/types/trading';
import { Wallet, TrendingUp, TrendingDown, Percent, ShieldCheck } from 'lucide-react';

interface PortfolioLedgerProps {
  portfolio: PortfolioState | null;
}

export const PortfolioLedger: React.FC<PortfolioLedgerProps> = ({ portfolio }) => {
  const effectivePortfolio = portfolio || {
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
    equity_history: [],
  };

  const isProfit = effectivePortfolio.realized_pnl >= 0;

  return (
    <section className="card-frame flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-sans font-medium text-[16px] text-paper tracking-[-0.011em]">
            Simulated Portfolio Ledger
          </h2>
          <p className="font-sans text-[13px] text-ash font-normal">
            Starting virtual capital: $100,000.00 · Zero live capital risk
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-white/[0.04] border border-graphite text-[11px] font-mono-linear text-fog">
          <ShieldCheck className="w-3 h-3 text-pulse-green" />
          <span>Paper Engine</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="card-frame-subtle min-w-0">
          <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">Total Equity</div>
          <div className="font-mono-linear text-[16px] font-medium text-paper mt-0.5">
            ${effectivePortfolio.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="card-frame-subtle min-w-0">
          <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">Available Cash</div>
          <div className="font-mono-linear text-[16px] font-medium text-mist mt-0.5">
            ${effectivePortfolio.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="card-frame-subtle min-w-0">
          <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">Realized P&L</div>
          <div
            className={`font-mono-linear text-[16px] font-medium mt-0.5 flex items-center gap-1 ${
              isProfit ? 'text-pulse-green' : 'text-coral-red'
            }`}
          >
            {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span>
              {isProfit ? '+' : ''}${effectivePortfolio.realized_pnl.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="card-frame-subtle min-w-0">
          <div className="font-mono-linear text-[10px] uppercase text-ash tracking-tight">Win Rate (W / L)</div>
          <div className="font-mono-linear text-[16px] font-medium text-mist mt-0.5">
            {effectivePortfolio.win_rate.toFixed(1)}%
            <span className="text-[11px] text-ash font-normal ml-1">
              ({effectivePortfolio.winning_trades}W / {effectivePortfolio.losing_trades}L)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
