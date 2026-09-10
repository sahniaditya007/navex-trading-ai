'use client';

import React from 'react';
import { Database, Bookmark, BrainCircuit } from 'lucide-react';

interface EpisodicMemoryPanelProps {
  learnings: string[];
}

export const EpisodicMemoryPanel: React.FC<EpisodicMemoryPanelProps> = ({ learnings }) => {
  return (
    <section id="episodic-memory-section" className="card-frame flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-sans font-medium text-[16px] text-paper tracking-[-0.011em]">
              Episodic Decision Memory
            </h2>
            <span className="px-2 py-0.5 rounded-[4px] bg-white/[0.04] border border-graphite text-[10px] font-mono-linear text-fog">
              🟢 Built by me · SQLite Store
            </span>
          </div>
          <p className="font-sans text-[13px] text-ash font-normal">
            Actionable trade lessons stored in database and injected into subsequent AI prompts (Stage 5 Feedback Loop)
          </p>
        </div>

        <Database className="w-4 h-4 text-ash" />
      </div>

      {learnings && learnings.length > 0 ? (
        <div className="space-y-2">
          {learnings.map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-[6px] bg-void/70 border border-graphite hover:border-smoke transition-colors flex items-start gap-2.5"
            >
              <BrainCircuit className="w-4 h-4 text-[#8b5cf6] flex-shrink-0 mt-0.5" />
              <p className="font-sans text-[13px] text-mist leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 rounded-[8px] border border-dashed border-graphite text-center">
          <p className="font-sans text-[13px] text-fog">
            No prior memory found. Complete simulation cycles to accumulate learned trading principles.
          </p>
        </div>
      )}
    </section>
  );
};
