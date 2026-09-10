'use client';

import React from 'react';

export const CustomerStrip: React.FC = () => {
  const stack = [
    { name: 'Anthropic Claude 3.5', role: 'Analytical Reasoning' },
    { name: 'Next.js 16', role: 'Precision Interface' },
    { name: 'FastAPI Core', role: 'Asynchronous Engine' },
    { name: 'SQLite Vector', role: 'Episodic Memory' },
    { name: 'Binance Microstructure', role: 'L2/L3 Order Book' },
    { name: 'Deterministic Risk', role: 'Mathematical Guardrails' },
  ];

  return (
    <div className="w-full border-t border-graphite/60 py-10 bg-void">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="text-center font-mono-linear text-[11px] text-ash uppercase tracking-wider mb-6">
          Architectural Substrate & Quantitative Stack
        </div>

        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14">
          {stack.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <span className="font-sans font-medium text-[14px] text-fog tracking-tight hover:text-paper transition-colors">
                {item.name}
              </span>
              <span className="font-mono-linear text-[11px] text-ash">
                {item.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
