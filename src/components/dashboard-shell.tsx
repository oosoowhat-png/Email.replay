"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogOut, Mail, Inbox, RefreshCw, Loader2 } from "lucide-react";
import { EmailList } from "@/components/email-list";
import { EmailDetail } from "@/components/email-detail";
import { ReplyComposer } from "@/components/reply-composer";
import type { User } from "@supabase/supabase-js";
import type { GmailEmail } from "@/lib/types";

interface DashboardShellProps {
  readonly user: User;
}

export function DashboardShell({ user }: DashboardShellProps) {
  const router = useRouter();
  const [emails, setEmails] = useState<ReadonlyArray<GmailEmail>>([]);
  const [selectedEmail, setSelectedEmail] = useState<GmailEmail | null>(null);
  const [replyingTo, setReplyingTo] = useState<GmailEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/emails");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to fetch emails");
        return;
      }
      setEmails(data.emails);
    } catch {
      setError("Failed to fetch emails. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleReply = (email: GmailEmail) => {
    setReplyingTo(email);
  };

  const handleReplySent = () => {
    setReplyingTo(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold">Vizuara Email Agent</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Inbox className="h-5 w-5" />
            Primary Inbox
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEmails}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        {error && (
          <Card className="mb-4 border-red-200 bg-red-50">
            <CardContent className="py-3 text-sm text-red-700">
              {error}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
          {/* Email List */}
          <div className={`md:col-span-2 ${selectedEmail ? "hidden md:block" : ""}`}>
            {loading ? (
              <Card>
                <CardContent className="flex h-64 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </CardContent>
              </Card>
            ) : (
              <EmailList
                emails={emails}
                selectedId={selectedEmail?.gmail_message_id ?? null}
                onSelect={(email) => {
                  setSelectedEmail(email);
                  setReplyingTo(null);
                }}
              />
            )}
          </div>

          {/* Email Detail + Reply Composer */}
          <div className={`space-y-4 md:col-span-3 ${!selectedEmail ? "hidden md:block" : ""}`}>
            {selectedEmail ? (
              <>
                <EmailDetail
                  email={selectedEmail}
                  onBack={() => {
                    setSelectedEmail(null);
                    setReplyingTo(null);
                  }}
                  onReply={handleReply}
                />
                {replyingTo && (
                  <ReplyComposer
                    email={replyingTo}
                    onClose={() => setReplyingTo(null)}
                    onSent={handleReplySent}
                  />
                )}
              </>
            ) : (
              <Card className="hidden md:block">
                <CardContent className="flex h-64 items-center justify-center text-gray-400">
                  Select an email to view
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
