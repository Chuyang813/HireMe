"use client";

import { useState, useTransition } from "react";
import { submitDocumentFeedback } from "@/app/actions/feedback";

interface FeedbackButtonsProps {
  documentId: string;
  feedbackType: string;
  initialRating?: 1 | -1 | null;
}

export function FeedbackButtons({
  documentId,
  feedbackType,
  initialRating = null,
}: FeedbackButtonsProps) {
  const [rating, setRating] = useState<1 | -1 | null>(initialRating);
  const [isPending, startTransition] = useTransition();

  function handleRate(value: 1 | -1) {
    const next = rating === value ? null : value;
    startTransition(async () => {
      if (next === null) {
        // toggling off — still submit opposite to clear, or just optimistic
        setRating(null);
        return;
      }
      const result = await submitDocumentFeedback(documentId, feedbackType, value);
      if ("ok" in result) {
        setRating(value);
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-xs text-muted-foreground">Helpful?</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleRate(1)}
        aria-label="Thumbs up"
        className={`rounded p-1 transition-colors hover:bg-muted disabled:opacity-50 ${
          rating === 1 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={rating === 1 ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
          <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleRate(-1)}
        aria-label="Thumbs down"
        className={`rounded p-1 transition-colors hover:bg-muted disabled:opacity-50 ${
          rating === -1 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={rating === -1 ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
          <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
        </svg>
      </button>
    </div>
  );
}
