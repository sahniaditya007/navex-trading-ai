'use client';

import React from 'react';
import { PostTradeReview } from '@/types/trading';
import { Lightbulb } from 'lucide-react';

interface PostTradeReviewPanelProps {
  reviews: PostTradeReview[];
}

export const PostTradeReviewPanel: React.FC<PostTradeReviewPanelProps> = ({ reviews }) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const selectedReview = reviews && reviews.length > 0 ? reviews[Math.min(selectedIndex, reviews.length - 1)] : null;

  return (
    <section id="post-trade-review-section" className="card-frame flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-sans font-medium text-[16px] text-paper tracking-[-0.011em]">
              Post-Trade AI Review
            </h2>
            <span className="px-2 py-0.5 rounded-[4px] bg-white/[0.04] border border-graphite text-[10px] font-mono-linear text-fog">
              🔵 LLM / ⚪ Deterministic Evaluator
            </span>
          </div>
          <p className="font-sans text-[13px] text-ash font-normal">
            Automated thesis post-mortem comparing original thesis against trade execution outcome
          </p>
        </div>

        {reviews && reviews.length > 1 && (
          <div className="flex items-center gap-1.5 bg-void p-1 rounded-[6px] border border-graphite text-xs font-mono-linear">
            {reviews.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`px-2 py-0.5 rounded-[4px] transition-colors ${
                  selectedIndex === idx
                    ? 'bg-carbon text-paper border border-smoke'
                    : 'text-ash hover:text-mist'
                }`}
              >
                #{idx + 1} {idx === 0 ? '(Latest)' : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedReview ? (
        <div className="space-y-3.5">
          {selectedReview.original_thesis && (
            <div className="rounded-[8px] border border-graphite bg-void/60 p-3">
              <span className="mb-1 block font-mono-linear text-[10px] uppercase text-[#02b8cc]">
                Original thesis
              </span>
              <p className="font-sans text-[13px] leading-relaxed text-mist">
                {selectedReview.original_thesis.thesis}
              </p>
            </div>
          )}
          {/* Outcome Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[8px] bg-void border border-graphite">
            <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono-linear text-xs">
              <span className="text-ash">OUTCOME:</span>
              <span className={`max-w-full whitespace-normal break-normal px-2 py-0.5 rounded-[4px] font-medium ${
                  selectedReview.thesis_correct
                    ? 'bg-pulse-green/10 text-pulse-green border border-pulse-green/30'
                    : 'bg-coral-red/10 text-coral-red border border-coral-red/30'
                }`}
              >
                {selectedReview.outcome}
              </span>
            </div>

            <div className="font-mono-linear text-xs text-fog sm:text-right">
              Execution:{' '}
              <span className="text-paper font-medium">
                {selectedReview.execution_quality}
              </span>
            </div>
          </div>

          {/* Review Details */}
          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-[6px] bg-white/[0.02] border border-graphite/60">
              <span className="font-mono-linear text-[10px] uppercase text-pulse-green block mb-1">
                What Worked
              </span>
              <p className="font-sans text-mist leading-relaxed">{selectedReview.what_worked}</p>
            </div>

            <div className="p-3 rounded-[6px] bg-white/[0.02] border border-graphite/60">
              <span className="font-mono-linear text-[10px] uppercase text-coral-red block mb-1">
                What Failed
              </span>
              <p className="font-sans text-mist leading-relaxed">{selectedReview.what_failed}</p>
            </div>

            <div className="p-3 rounded-[6px] bg-white/[0.02] border border-graphite/60">
              <span className="font-mono-linear text-[10px] uppercase text-[#02b8cc] block mb-1">
                Root Cause Analysis
              </span>
              <p className="font-sans text-mist leading-relaxed">{selectedReview.why}</p>
            </div>
          </div>

          {/* Persisted Lessons Learned */}
          {selectedReview.lessons_learned && selectedReview.lessons_learned.length > 0 && (
            <div className="border-t border-graphite pt-3">
              <div className="flex items-center gap-1.5 font-mono-linear text-[11px] text-ash uppercase mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-acid-lime" />
                <span>Lessons Persisted to Episodic Database</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedReview.lessons_learned.map((lesson, i) => (
                  <div
                    key={i}
                    className="px-2.5 py-1.5 rounded-[4px] bg-void border border-graphite text-[12px] text-mist font-sans"
                  >
                    • {lesson}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 rounded-[8px] border border-dashed border-graphite text-center">
          <p className="font-sans text-[13px] text-fog">
            Post-trade AI review will be automatically synthesized when Take Profit or Stop Loss is triggered.
          </p>
        </div>
      )}
    </section>
  );
};
