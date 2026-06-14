import React from 'react';

const LEVEL_CONFIG = {
  0: { label: 'New', color: 'bg-gray-100 text-gray-600' },
  1: { label: 'L1 Know', color: 'bg-gray-100 text-gray-700' },
  2: { label: 'L2 Understand', color: 'bg-blue-100 text-blue-700' },
  3: { label: 'L3 Recall', color: 'bg-indigo-100 text-indigo-700' },
  4: { label: 'L4 Controlled', color: 'bg-purple-100 text-purple-700' },
  5: { label: 'L5 Guided', color: 'bg-orange-100 text-orange-700' },
  6: { label: '★ Mastered', color: 'bg-green-100 text-green-700' },
};

export default function MasteryBadge({ level }) {
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG[0];

  return (
    <span className={`badge ${config.color}`} title={`Mastery Level ${level}`}>
      {config.label}
    </span>
  );
}
