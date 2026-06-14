import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { progressAPI } from '../api';
import ProgressBar from '../components/ProgressBar';

export default function Home() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadOverview();
  }, []);

  // Reload when page becomes visible (e.g. returning from training)
  useEffect(() => {
    const onFocus = () => loadOverview();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  async function loadOverview() {
    try {
      setLoading(true);
      setError(null);
      const data = await progressAPI.overview();
      setOverview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400 mb-4">Unable to load data</p>
        <button onClick={loadOverview} className="btn-secondary">
          Retry
        </button>
        <p className="text-xs text-gray-400 mt-3">{error}</p>
      </div>
    );
  }

  const trainingDaysPercent = overview
    ? Math.round((overview.trainingDaysLast7 / 7) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Today's Progress */}
      <div className="card border-brand-200 bg-gradient-to-r from-brand-50 to-amber-50">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          📅 Today
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-600">
              {overview?.todayCompleted || 0}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Questions Done
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${
              (overview?.todayAccuracy || 0) >= 80 ? 'text-green-600' :
              (overview?.todayAccuracy || 0) >= 50 ? 'text-yellow-600' : 'text-gray-400'
            }`}>
              {overview?.todayCompleted > 0 ? `${overview?.todayAccuracy}%` : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Accuracy
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">
              🔥 {overview?.streak || 0}d
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Streak
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-brand-600">
            {overview?.masteredCount || 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">Mastered</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-green-600">
            +{overview?.newThisWeek || 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">This Week</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-blue-600">
            {overview?.trainingDaysLast7 || 0}/7
          </div>
          <div className="text-xs text-gray-500 mt-1">Training Days</div>
        </div>
      </div>

      {/* Training Streak Bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Last 7 Days
          </span>
          <span className="text-xs text-gray-400">
            {overview?.trainingDaysLast7 || 0} training days
          </span>
        </div>
        <ProgressBar
          value={trainingDaysPercent}
          color="blue"
          label={`${trainingDaysPercent}%`}
        />
      </div>

      {/* Start Training Card */}
      <div className="card border-brand-200 bg-gradient-to-br from-brand-50 to-white">
        <div className="text-center py-4">
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Today's Training
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {overview?.todayCompleted > 0
              ? `You've done ${overview.todayCompleted} questions today. Keep going!`
              : 'Estimated 8–15 minutes'}
          </p>
          <button
            onClick={() => navigate('/training')}
            className="btn-primary text-lg px-10 py-4 rounded-xl shadow-lg shadow-brand-200"
          >
            {overview?.todayCompleted > 0 ? 'Continue Training' : 'Start Training'}
          </button>
        </div>
      </div>

      {/* Total Items */}
      <p className="text-center text-xs text-gray-400">
        {overview?.totalItems || 0} expressions in your corpus
      </p>
    </div>
  );
}
