"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, CheckCircle2 } from "lucide-react";

interface FeedbackFormProps {
  readonly replyId: string;
  readonly onSubmitted: () => void;
}

type FeedbackState = "input" | "submitting" | "done";

export function FeedbackForm({ replyId, onSubmitted }: FeedbackFormProps) {
  const [state, setState] = useState<FeedbackState>("input");
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [textFeedback, setTextFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Please select a star rating");
      return;
    }

    setState("submitting");
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyId,
          starRating: rating,
          textFeedback: textFeedback.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to submit feedback");
        setState("input");
        return;
      }
      setState("done");
      setTimeout(() => onSubmitted(), 1500);
    } catch {
      setError("Failed to submit feedback. Please try again.");
      setState("input");
    }
  };

  if (state === "done") {
    return (
      <Card className="border-green-200 bg-green-50/30">
        <CardContent className="flex flex-col items-center gap-2 py-6">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <p className="font-medium text-green-700">Thanks for your feedback!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          How was the AI draft quality?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Star Rating */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="rounded p-1 transition-transform hover:scale-110"
              disabled={state === "submitting"}
            >
              <Star
                className={`h-7 w-7 ${
                  star <= (hoveredRating || rating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-gray-300"
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm text-gray-500">
              {rating}/5
            </span>
          )}
        </div>

        {/* Text Feedback */}
        <Textarea
          placeholder="Optional: Any suggestions to improve the AI drafts?"
          value={textFeedback}
          onChange={(e) => setTextFeedback(e.target.value)}
          className="min-h-[80px] bg-white"
          disabled={state === "submitting"}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          onClick={handleSubmit}
          disabled={state === "submitting" || rating === 0}
          size="sm"
        >
          {state === "submitting" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Submit Feedback
        </Button>
      </CardContent>
    </Card>
  );
}
