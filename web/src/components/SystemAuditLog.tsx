'use client';

import React, { useRef, useEffect } from 'react';
import { Terminal, Copy, Trash2 } from 'lucide-react';

interface SystemAuditLogProps {
  logs: string[];
  onClear: () => void;
}

export const SystemAuditLog: React.FC<SystemAuditLogProps> = ({ logs, onClear }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
  };

  return (
    <section className="card-frame flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-fog" />
          <h2 className="font-sans font-medium text-[16px] text-paper tracking-[-0.011em]">
            System Execution & Audit Stream
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1 rounded text-ash hover:text-paper hover:bg-white/[0.04] transition-colors"
            title="Copy audit logs"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClear}
            className="p-1 rounded text-ash hover:text-coral-red hover:bg-white/[0.04] transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={logContainerRef}
        className="h-44 p-3 bg-void rounded-[8px] border border-graphite overflow-y-auto font-mono-linear text-[12px] leading-relaxed select-text space-y-1"
      >
        {logs.length > 0 ? (
          logs.map((log, index) => {
            const isError = log.includes('ERROR') || log.includes('REJECTED');
            const isSuccess = log.includes('APPROVED') || log.includes('FILLED') || log.includes('TRADE CLOSED');
            const isInfo = log.includes('THESIS') || log.includes('ANALYSIS') || log.includes('SCENARIO');

            return (
              <div
                key={index}
                className={`break-all ${
                  isError
                    ? 'text-coral-red'
                    : isSuccess
                    ? 'text-pulse-green'
                    : isInfo
                    ? 'text-[#02b8cc]'
                    : 'text-fog'
                }`}
              >
                {log}
              </div>
            );
          })
        ) : (
          <div className="text-ash italic">Audit stream idle. Awaiting operational telemetry...</div>
        )}
      </div>
    </section>
  );
};
