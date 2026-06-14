import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { trainingAPI } from '../api';
import TaskCard from '../components/TaskCard';
import FeedbackPanel from '../components/FeedbackPanel';
import ProgressBar from '../components/ProgressBar';

export default function Training() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    loadTraining();
  }, []);

  async function loadTraining() {
    try {
      setLoading(true);
      setError(null);
      const data = await trainingAPI.getToday();
      setSession(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    if (!answer.trim() || submitting) return;

    const task = session.tasks[currentIndex];
    submitAnswer(task, answer.trim());
  }

  async function submitAnswer(task, userAnswer) {
    try {
      setSubmitting(true);
      const result = await trainingAPI.submit({
        sessionId: session.sessionId,
        taskId: task.id,
        answer: userAnswer,
        expectedAnswer: task.expectedAnswer || null,
        mode: task.mode,
      });
      setFeedback(result);
      setResults((prev) => [...prev, { task: task.content, answer: userAnswer, ...result }]);
    } catch (err) {
      setFeedback({ error: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (currentIndex < session.tasks.length - 1) {
      setCurrentIndex((i) => i + 1);
      setAnswer('');
      setFeedback(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setCompleted(true);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (feedback) {
        handleNext();
      } else {
        handleSubmit();
      }
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <p className="text-xs text-gray-400 mb-4">
          Make sure your Obsidian folder is configured and scanned in Settings.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={loadTraining} className="btn-secondary">
            Retry
          </button>
          <button onClick={() => navigate('/settings')} className="btn-primary">
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  // Empty corpus
  if (!session || !session.tasks || session.tasks.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400 mb-4">No training items available yet.</p>
        <p className="text-xs text-gray-400 mb-4">
          Go to Settings to configure your Obsidian folder and scan for English content.
        </p>
        <button onClick={() => navigate('/settings')} className="btn-primary">
          Go to Settings
        </button>
      </div>
    );
  }

  // Completed
  if (completed) {
    const totalScore = results.reduce((sum, r) => sum + (r.accuracy || 0), 0);
    const avgScore = results.length > 0 ? Math.round(totalScore / results.length) : 0;

    return (
      <div className="space-y-6">
        <div className="card text-center py-8">
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Training Complete!
          </h2>
          <p className="text-gray-500 mb-4">
            Average score: {avgScore}/10
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/')}
              className="btn-secondary"
            >
              Back to Home
            </button>
            <button
              onClick={() => {
                setCompleted(false);
                setCurrentIndex(0);
                setAnswer('');
                setFeedback(null);
                setResults([]);
                loadTraining();
              }}
              className="btn-primary"
            >
              Train Again
            </button>
          </div>
        </div>

        {/* Session Summary */}
        <div className="card">
          <h3 className="font-medium text-gray-700 mb-3">Session Summary</h3>
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {r.task}
                  </p>
                  <p className="text-xs text-gray-400">
                    You: {r.answer}
                  </p>
                </div>
                <span className={`badge ml-3 ${r.accuracy >= 8 ? 'bg-green-100 text-green-700' : r.accuracy >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                  {r.accuracy}/10
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const task = session.tasks[currentIndex];
  const progress = ((currentIndex + (feedback ? 1 : 0)) / session.tasks.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Question {currentIndex + 1} of {session.tasks.length}
        </span>
        <span className="text-gray-400">
          {Math.round(progress)}%
        </span>
      </div>
      <ProgressBar value={progress} />

      {/* Task Card */}
      <TaskCard task={task} feedback={feedback} />

      {/* Input Area */}
      {!feedback && (
        <div className="card">
          {task.mode === 'A' ? (
            /* Mode A: Multiple choice */
            <div className="space-y-2">
              {task.options?.map((opt, i) => (
                <button
                  key={i}
                  className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                  onClick={() => {
                    setAnswer(opt);
                    submitAnswer(task, opt);
                  }}
                >
                  <span className="text-base font-semibold text-gray-500 mr-2">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  <span className="text-gray-800 text-lg">{opt}</span>
                </button>
              ))}
            </div>
          ) : (
            /* Modes B-F: Text input */
            <div>
              <textarea
                ref={inputRef}
                className="input-field min-h-[160px] resize-y text-lg leading-relaxed"
                placeholder={
                  task.mode === 'B'
                    ? 'Type the English expression...'
                    : task.mode === 'C'
                    ? 'Translate the sentence into English...'
                    : 'Write your answer in English...'
                }
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-gray-400">
                  Mode {task.mode} · Level {task.masteryLevel}
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!answer.trim() || submitting}
                  className="btn-primary"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Evaluating...
                    </span>
                  ) : (
                    'Submit (Enter)'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feedback Panel */}
      {feedback && (
        <FeedbackPanel feedback={feedback} onNext={handleNext} />
      )}
    </div>
  );
}
