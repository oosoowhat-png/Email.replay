"use client";

import { useState } from "react";
import type { GmailEmail } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Send,
  Sparkles,
  X,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { FeedbackForm } from "@/components/feedback-form";

interface ReplyComposerProps {
  readonly email: GmailEmail;
  readonly onClose: () => void;
  readonly onSent: () => void;
}

type ComposerState = "idle" | "generating" | "editing" | "sending" | "sent" | "feedback";

export function ReplyComposer({ email, onClose, onSent }: ReplyComposerProps) {
  const [state, setState] = useState<ComposerState>("idle");
  const [aiDraft, setAiDraft] = useState("");
  const [editedDraft, setEditedDraft] = useState("");
  const [coursesUsed, setCoursesUsed] = useState(0);
  const [fullContext, setFullContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setState("generating");
    setError(null);
    try {
      const res = await fetch("/api/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailBody: email.body,
          emailSubject: email.subject,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate reply");
        setState("idle");
        return;
      }
      setAiDraft(data.draft);
      setEditedDraft(data.draft);
      setCoursesUsed(data.coursesUsed);
      setFullContext(data.fullContext ?? "");
      setState("editing");
    } catch {
      setError("Failed to generate reply. Please try again.");
      setState("idle");
    }
  };

  const handleSend = async () => {
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/send-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gmailMessageId: email.gmail_message_id,
          threadId: email.thread_id,
          fromEmail: email.from_email,
          fromName: email.from_name,
          subject: email.subject,
          emailBody: email.body,
          aiDraft,
          sentBody: editedDraft,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send reply");
        setState("editing");
        return;
      }
      setState("sent");
      if (data.replyId) {
        setReplyId(data.replyId);
        setTimeout(() => setState("feedback"), 1500);
      } else {
        setTimeout(() => onSent(), 2000);
      }
    } catch {
      setError("Failed to send reply. Please try again.");
      setState("editing");
    }
  };

  const handleRegenerate = () => {
    setAiDraft("");
    setEditedDraft("");
    setState("idle");
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-blue-600" />
            AI Reply
            <Badge variant="secondary" className="text-xs">
              to {email.from_name || email.from_email}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Generate Button */}
        {state === "idle" && (
          <Button onClick={handleGenerate} className="w-full">
            <Sparkles className="mr-2 h-4 w-4" />
            Generate AI Draft
          </Button>
        )}

        {/* Loading State */}
        {state === "generating" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">
              Generating reply with Gemini...
            </p>
            <p className="text-xs text-gray-400">
              Searching knowledge base for relevant courses...
            </p>
          </div>
        )}

        {/* Editing State */}
        {(state === "editing" || state === "sending") && (
          <>
            {coursesUsed > 0 && (
              <Badge variant="secondary" className="text-xs">
                {coursesUsed} relevant course{coursesUsed > 1 ? "s" : ""} found
                in knowledge base
              </Badge>
            )}
            {fullContext && (
              <div className="rounded-md border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => setShowContext(!showContext)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    Full LLM Context
                  </span>
                  {showContext ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                {showContext && (
                  <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap border-t border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                    {fullContext}
                  </pre>
                )}
              </div>
            )}
            <Textarea
              value={editedDraft}
              onChange={(e) => setEditedDraft(e.target.value)}
              className="min-h-[200px] bg-white"
              disabled={state === "sending"}
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={state === "sending"}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Regenerate
                </Button>
                {editedDraft !== aiDraft && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditedDraft(aiDraft)}
                    disabled={state === "sending"}
                  >
                    Reset to original
                  </Button>
                )}
              </div>
              <Button
                onClick={handleSend}
                disabled={state === "sending" || !editedDraft.trim()}
              >
                {state === "sending" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Approve & Send
              </Button>
            </div>
          </>
        )}

        {/* Sent State */}
        {state === "sent" && (
          <div className="flex flex-col items-center gap-2 py-6">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <p className="font-medium text-green-700">Reply sent!</p>
          </div>
        )}

        {/* Feedback */}
        {state === "feedback" && replyId && (
          <FeedbackForm replyId={replyId} onSubmitted={onSent} />
        )}

        {/* Error */}
        {error && (
          <>
            <Separator />
            <p className="text-sm text-red-600">{error}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
