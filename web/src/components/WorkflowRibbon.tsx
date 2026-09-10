'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';

export type WorkflowStepId =
  | 'context'
  | 'analysis'
  | 'execution'
  | 'review'
  | 'memory';

interface WorkflowRibbonProps {
  currentStep: WorkflowStepId;
  onStepClick?: (step: WorkflowStepId) => void;
}

const STEPS: Array<{ id: WorkflowStepId; index: number; label: string }> = [
  { id: 'context', index: 1, label: 'Understand' },
  { id: 'analysis', index: 2, label: 'Decide' },
  { id: 'execution', index: 3, label: 'Execute' },
  { id: 'review', index: 4, label: 'Review' },
  { id: 'memory', index: 5, label: 'Improve' },
];

export const WorkflowRibbon: React.FC<WorkflowRibbonProps> = ({ currentStep, onStepClick }) => {
  const activeIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="w-full border-b border-graphite bg-carbon/50 backdrop-blur-sm overflow-x-auto py-2.5 px-4 scrollbar-none">
      <div className="max-w-[1200px] mx-auto flex items-center justify-start sm:justify-between min-w-[620px] gap-1.5">
        {STEPS.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isPassed = idx < activeIndex;

          return (
            <React.Fragment key={step.id}>
              <div
                onClick={() => onStepClick && onStepClick(step.id)}
                className={`flex items-center gap-2 cursor-pointer transition-all duration-150 select-none py-1 px-2.5 rounded-[4px] ${
                  isActive
                    ? 'bg-white/[0.06] text-paper border border-smoke shadow-sm'
                    : isPassed
                    ? 'text-mist hover:text-paper hover:bg-white/[0.02]'
                    : 'text-ash hover:text-fog'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono-linear font-medium transition-colors ${
                    isActive
                      ? 'bg-paper text-void'
                      : isPassed
                      ? 'bg-pulse-green/20 text-pulse-green border border-pulse-green/40'
                      : 'bg-white/[0.05] text-ash'
                  }`}
                >
                  {isPassed ? '✓' : step.index}
                </span>
                <span className="font-sans text-[12px] font-normal tracking-[-0.010em] uppercase whitespace-nowrap">
                  {step.label}
                </span>
              </div>

              {idx < STEPS.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-graphite flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
