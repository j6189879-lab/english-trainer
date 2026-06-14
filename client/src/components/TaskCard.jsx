import React from 'react';
import MasteryBadge from './MasteryBadge';

const MODE_LABELS = {
  A: { label: 'Recognition', desc: 'Understand the meaning' },
  B: { label: 'Recall', desc: 'Chinese → English' },
  C: { label: 'Controlled Production', desc: 'Translate the sentence' },
  D: { label: 'Guided Production', desc: 'Express with your experience' },
  E: { label: 'Free Production', desc: 'Express freely' },
  F: { label: 'Transfer Production', desc: 'Use multiple expressions together' },
};

const PATTERN_MODE_LABELS = {
  A: { label: 'Recognition', desc: 'Understand the pattern function' },
  B: { label: 'Reconstruction', desc: 'Reconstruct the pattern from memory' },
  C: { label: 'Imitation', desc: 'Imitate the pattern in a new context' },
  D: { label: 'Structure Rewriting', desc: 'Rewrite a sentence using this pattern' },
  E: { label: 'Context Transfer', desc: 'Use the pattern naturally in a new scenario' },
  F: { label: 'Transfer Production', desc: 'Use multiple patterns together' },
};

export default function TaskCard({ task, feedback }) {
  if (!task) return null;

  const isPattern = task.type === 'pattern';
  const labels = isPattern ? PATTERN_MODE_LABELS : MODE_LABELS;
  const modeInfo = labels[task.mode] || labels.A;

  return (
    <div className={`card ${feedback ? 'border-green-200' : ''}`}>
      {/* Task Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="badge bg-brand-50 text-brand-700">
          {modeInfo.label}
        </span>
        <MasteryBadge level={task.masteryLevel} />
      </div>

      {/* Task Description */}
      <p className="text-sm text-gray-400 mb-4">{modeInfo.desc}</p>

      {/* Task Content */}
      <div className="mb-4">
        {/* Prompt */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap">
            {task.prompt}
          </p>
        </div>

        {/* Hint / Context */}
        {task.hint && (
          <p className="text-xs text-gray-400 mt-2 italic">
            💡 {task.hint}
          </p>
        )}

        {/* Required expressions for Mode F */}
        {task.required && task.required.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {task.required.map((expr, i) => (
              <span
                key={i}
                className="badge bg-yellow-50 text-yellow-700 border border-yellow-200"
              >
                Must use: {expr}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
