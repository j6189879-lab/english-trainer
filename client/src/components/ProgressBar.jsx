import React from 'react';

const COLORS = {
  brand: 'bg-brand-600',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
};

export default function ProgressBar({ value = 0, color = 'brand', label }) {
  const safeValue = Math.min(100, Math.max(0, value));

  return (
    <div className="w-full">
      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${COLORS[color] || COLORS.brand}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
      {label && (
        <p className="text-xs text-gray-400 mt-1">{label}</p>
      )}
    </div>
  );
}
