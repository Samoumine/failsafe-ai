import React from 'react';
import type { Suggestion } from '../agents/suggestionGenerator';

interface SuggestionPanelProps {
  suggestion: Suggestion | null;
}

export function SuggestionPanel({ suggestion }: SuggestionPanelProps) {
  if (!suggestion) {
    return (
      <div className="suggestion-panel">
        <h3>AI Suggestion</h3>
        <p>No suggestion available</p>
      </div>
    );
  }

  return (
    <div className="suggestion-panel">
      <h3>AI Suggestion</h3>
      <div className="suggestion-action">{suggestion.action}</div>
      <p className="suggestion-reason">{suggestion.reason}</p>
      <div className="suggestion-confidence">Confidence: {Math.round(suggestion.confidence * 100)}%</div>
    </div>
  );
}
