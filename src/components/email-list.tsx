"use client";

import type { GmailEmail } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "@/lib/date-utils";

interface EmailListProps {
  readonly emails: ReadonlyArray<GmailEmail>;
  readonly selectedId: string | null;
  readonly onSelect: (email: GmailEmail) => void;
}

export function EmailList({ emails, selectedId, onSelect }: EmailListProps) {
  if (emails.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No emails found in your primary inbox.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {emails.map((email) => {
        const isSelected = email.gmail_message_id === selectedId;
        return (
          <Card
            key={email.gmail_message_id}
            className={`cursor-pointer border-l-4 p-4 transition-colors hover:bg-gray-50 ${
              isSelected
                ? "border-l-blue-600 bg-blue-50"
                : "border-l-transparent"
            }`}
            onClick={() => onSelect(email)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-gray-900">
                    {email.from_name || email.from_email}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-medium text-gray-800">
                  {email.subject || "(no subject)"}
                </p>
                <p className="mt-1 truncate text-sm text-gray-500">
                  {email.snippet}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0 text-xs">
                {formatDistanceToNow(email.received_at)}
              </Badge>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
