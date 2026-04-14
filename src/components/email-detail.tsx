"use client";

import type { GmailEmail } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Reply, ArrowLeft } from "lucide-react";

interface EmailDetailProps {
  readonly email: GmailEmail;
  readonly onBack: () => void;
  readonly onReply: (email: GmailEmail) => void;
}

export function EmailDetail({ email, onBack, onReply }: EmailDetailProps) {
  const receivedDate = new Date(email.received_at).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Card className="h-full">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="md:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">
              {email.subject || "(no subject)"}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <span className="font-medium text-gray-700">
                {email.from_name || email.from_email}
              </span>
              {email.from_name && (
                <span className="text-gray-400">&lt;{email.from_email}&gt;</span>
              )}
            </div>
            <Badge variant="secondary" className="mt-1 text-xs">
              {receivedDate}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onReply(email)}>
            <Reply className="mr-2 h-4 w-4" />
            Draft AI Reply
          </Button>
        </div>
        <Separator />
      </CardHeader>
      <CardContent>
        <div
          className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.body) }}
        />
      </CardContent>
    </Card>
  );
}

function sanitizeHtml(html: string): string {
  // Strip script tags and event handlers for safety
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}
