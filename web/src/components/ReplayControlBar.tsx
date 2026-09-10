'use client';

import React from 'react';
import { Play, Pause, StepForward, FastForward, CheckCircle2 } from 'lucide-react';

interface ReplayControlBarProps {
  currentBar: number;
  totalBars: number;
  isPlaying: boolean;
  isFinished: boolean;
  onStep: () => void;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

export const ReplayControlBar: React.FC<ReplayControlBarProps> = ({
  currentBar,
  totalBars,
  isPlaying,
  isFinished,
  onStep,
  onTogglePlay,
  speed,
  onSpeedChange,
}) => {
  const progressPct = totalBars > 0 ? (currentBar / totalBars) * 100 : 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-carbon rounded-[12px] border border-graphite shadow-subtle">
      {/* Playback action buttons */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <button
          onClick={onStep}
          disabled={isFinished || isPlaying}
          className="btn-ghost-outline py-1.5 px-3 flex items-center gap-1.5 text-xs font-normal flex-1 sm:flex-initial justify-center"
        >
          <StepForward className="w-3.5 h-3.5" />
          <span>Step 1 Bar</span>
        </button>

        <button
          onClick={onTogglePlay}
          disabled={isFinished}
          className={`py-1.5 px-3 rounded-[6px] text-xs font-medium flex items-center gap-1.5 transition-all flex-1 sm:flex-initial justify-center border ${
            isPlaying
              ? 'bg-coral-red/10 text-coral-red border-coral-red/30 hover:bg-coral-red/20'
              : 'bg-white/[0.04] text-paper border-graphite hover:border-smoke hover:bg-white/[0.08]'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Auto Play</span>
            </>
          )}
        </button>

        {/* Speed toggle */}
        <div className="hidden sm:flex items-center rounded-[6px] border border-graphite bg-void p-0.5 text-[11px] font-mono-linear text-fog">
          {[1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-2 py-0.5 rounded-[4px] transition-colors ${
                speed === s ? 'bg-carbon text-paper font-medium' : 'hover:text-mist'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Timeline progress & counter */}
      <div className="flex items-center gap-3 w-full sm:w-auto sm:min-w-[280px]">
        <div className="flex-1">
          <div className="flex items-center justify-between text-[11px] font-mono-linear text-ash mb-1">
            <span>Progress</span>
            <span className="text-mist">
              {currentBar} / {totalBars} bars
            </span>
          </div>
          <div className="w-full h-1.5 bg-void rounded-full overflow-hidden border border-graphite">
            <div
              className={`h-full transition-all duration-300 ${
                isFinished ? 'bg-pulse-green' : 'bg-mist'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
        </div>

        {isFinished && (
          <span className="flex items-center gap-1 text-[11px] font-mono-linear text-pulse-green flex-shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>End</span>
          </span>
        )}
      </div>
    </div>
  );
};
