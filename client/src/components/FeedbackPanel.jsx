import React from 'react';

export default function FeedbackPanel({ feedback, onNext }) {
  if (!feedback) return null;

  if (feedback.error) {
    return (
      <div className="card border-red-200 bg-red-50">
        <p className="text-red-600 text-base">{feedback.error}</p>
        <button onClick={onNext} className="btn-secondary mt-3">
          Skip →
        </button>
      </div>
    );
  }

  const { accuracy, naturalness, alternativeVersion, grammarSuggestions, usageEvaluation, explanation, correctAnswer, userAnswer, mode } = feedback;
  const isMultipleChoice = mode === 'A' && correctAnswer && userAnswer;

  const scoreColor =
    accuracy >= 8 ? 'text-green-600' : accuracy >= 5 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="card border-green-200 space-y-5">
      {/* Scores */}
      <div className={naturalness != null ? "grid grid-cols-2 gap-4" : ""}>
        <div className={`text-center p-4 bg-gray-50 rounded-lg ${naturalness != null ? '' : 'w-full'}`}>
          <div className={`text-3xl font-bold ${scoreColor}`}>
            {accuracy}/10
          </div>
          <div className="text-sm text-gray-400 mt-1">Accuracy</div>
        </div>
        {naturalness != null && (
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">
              {naturalness}/10
            </div>
            <div className="text-sm text-gray-400 mt-1">Naturalness</div>
          </div>
        )}
      </div>

      {/* Usage Evaluation */}
      {usageEvaluation && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
            Evaluation
          </h4>
          <p className="text-lg text-gray-700 leading-relaxed">{usageEvaluation}</p>
        </div>
      )}

      {/* Correct vs Selected Answer (for multiple choice) */}
      {isMultipleChoice && accuracy >= 8 && (
        <div className="rounded-lg p-4 bg-green-50 border border-green-200">
          <p className="text-base text-green-800">
            <span className="font-semibold">🎉 Correct!</span> {correctAnswer}
          </p>
        </div>
      )}

      {isMultipleChoice && accuracy < 8 && (
        <div className="rounded-lg p-4 bg-red-50 border border-red-100 space-y-2">
          <h4 className="text-sm font-semibold text-red-600 mb-1">❌ Incorrect</h4>
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-medium text-base mt-0.5">✅</span>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">Correct Answer</span>
              <p className="text-base text-green-800 font-medium">{correctAnswer}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-red-500 font-medium text-base mt-0.5">❌</span>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">Your Answer</span>
              <p className="text-base text-red-700">{userAnswer}</p>
            </div>
          </div>
        </div>
      )}

      {/* Expression Explanation (shown when accuracy is low) */}
      {explanation && (
        <div className="bg-amber-50 rounded-lg p-5 border border-amber-200">
          <h4 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1">
            📖 Review & Learn
          </h4>
          <p className="text-lg text-amber-900 leading-relaxed whitespace-pre-wrap">{explanation}</p>
        </div>
      )}

      {/* Alternative Version */}
      {alternativeVersion && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
            More Natural Alternative
          </h4>
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <p className="text-lg text-green-800 leading-relaxed">{alternativeVersion}</p>
          </div>
        </div>
      )}

      {/* Grammar Suggestions */}
      {grammarSuggestions && grammarSuggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
            Grammar Notes
          </h4>
          <ul className="space-y-1.5">
            {grammarSuggestions.map((s, i) => (
              <li key={i} className="text-lg text-gray-600 flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Button */}
      <button
        onClick={onNext}
        className="btn-primary w-full mt-2 text-lg py-4"
        autoFocus
      >
        Next (Enter)
      </button>
    </div>
  );
}
