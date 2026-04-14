// Gmail email fetched live (not stored in DB)
export interface GmailEmail {
  readonly gmail_message_id: string;
  readonly thread_id: string;
  readonly from_email: string;
  readonly from_name: string;
  readonly subject: string;
  readonly body: string;
  readonly snippet: string;
  readonly received_at: string;
}

// Stored in Supabase only when a reply is created
export interface StoredEmail {
  readonly id: string;
  readonly user_id: string;
  readonly gmail_message_id: string;
  readonly thread_id: string;
  readonly from_email: string;
  readonly from_name: string;
  readonly subject: string;
  readonly body: string;
  readonly received_at: string;
  readonly created_at: string;
}

export interface Reply {
  readonly id: string;
  readonly email_id: string;
  readonly user_id: string;
  readonly ai_draft: string;
  readonly sent_body: string | null;
  readonly status: "draft" | "sent";
  readonly sent_at: string | null;
  readonly created_at: string;
}

export interface Feedback {
  readonly id: string;
  readonly reply_id: string;
  readonly user_id: string;
  readonly star_rating: number;
  readonly text_feedback: string | null;
  readonly created_at: string;
}

export interface CourseEmbedding {
  readonly id: string;
  readonly course_name: string;
  readonly course_link: string;
  readonly content: string;
  readonly metadata: CourseMetadata;
  readonly created_at: string;
}

export interface CourseMetadata {
  readonly price: string;
  readonly starting_date: string;
  readonly format: string;
  readonly num_lessons: number;
  readonly duration_hours: number;
  readonly target_audience: string;
}

export type AIProvider = "gemini";
