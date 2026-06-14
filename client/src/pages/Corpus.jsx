import React, { useState, useEffect } from 'react';
import { corpusAPI } from '../api';
import MasteryBadge from '../components/MasteryBadge';

const TYPE_LABELS = {
  word: '🔤 Word',
  expression: '💬 Expression',
  pattern: '🔧 Pattern',
};

export default function Corpus() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', masteryLevel: '' });
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadItems();
  }, [filter, page]);

  async function loadItems() {
    try {
      setLoading(true);
      const params = { page, limit: 50 };
      if (filter.type) params.type = filter.type;
      if (filter.masteryLevel !== '' && filter.masteryLevel !== null) {
        params.masteryLevel = filter.masteryLevel;
      }
      const result = await corpusAPI.getItems(params);
      setData(result);
    } catch (err) {
      console.error('Failed to load corpus:', err);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(data.total / 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Corpus</h2>
        <span className="text-sm text-gray-400">{data.total} items</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          className="input-field w-auto text-sm"
          value={filter.type}
          onChange={(e) => {
            setFilter((f) => ({ ...f, type: e.target.value }));
            setPage(1);
          }}
        >
          <option value="">All Types</option>
          <option value="word">Words</option>
          <option value="expression">Expressions</option>
          <option value="pattern">Patterns</option>
        </select>
        <select
          className="input-field w-auto text-sm"
          value={filter.masteryLevel}
          onChange={(e) => {
            setFilter((f) => ({ ...f, masteryLevel: e.target.value }));
            setPage(1);
          }}
        >
          <option value="">All Levels</option>
          {[0, 1, 2, 3, 4, 5, 6].map((l) => (
            <option key={l} value={l}>
              Level {l}
            </option>
          ))}
        </select>
      </div>

      {/* Items List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : data.items.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p>No items found.</p>
          <p className="text-xs mt-2">
            Go to Settings → Scan Obsidian Folder to import your corpus.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.items.map((item) => (
            <div
              key={item.id}
              className="card flex items-center justify-between py-3 px-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">
                  {item.content}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {TYPE_LABELS[item.type] || item.type} · from {item.source_file}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <MasteryBadge level={item.mastery_level} />
                <span className="text-xs text-gray-400">
                  {item.review_count}×
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            className="btn-secondary text-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            className="btn-secondary text-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
