import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider } from "@/lib/types";
import { retrieveRelevantCourses, formatCoursesForPrompt } from "@/lib/rag";
import { fetchReplyHistory, formatHistoryForPrompt } from "@/lib/reply-history";

const SYSTEM_PROMPT = `You are a helpful email assistant for Vizuara, an online education platform.
You draft professional, friendly, and accurate email replies to course inquiries.

Guidelines:
- Be warm and professional in tone
- Reference specific course details (name, price, dates, duration, format, link) when relevant
- If the email isn't about courses, still reply helpfully and professionally
- Keep replies concise but thorough
- Always include relevant course links when recommending courses
- Do not make up information — only use the course data provided in the context
- Sign off as "Vizuara Team"
- If past reply history and feedback are provided, learn from them:
  - Mimic the tone and style of highly-rated replies
  - Avoid issues flagged in low-rated feedback
  - Follow the user's edit patterns (their edits show their preferred style)`;

function buildPrompt(
  emailBody: string,
  emailSubject: string,
  courseContext: string,
  historyContext: string
): string {
  let prompt = `The following email was received. Draft a professional reply.

INCOMING EMAIL:
Subject: ${emailSubject}
Body: ${emailBody}

RELEVANT COURSE INFORMATION FROM OUR KNOWLEDGE BASE:
${courseContext}`;

  if (historyContext) {
    prompt += `\n\n${historyContext}`;
  }

  prompt += `\n\nDraft a reply to this email. If the email is asking about courses or programs, reference the relevant course information above. Be specific with details like pricing, dates, and links.`;

  return prompt;
}

async function generateWithGemini(
  systemPrompt: string,
  prompt: string
): Promise<string> {

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  const models = [
    "gemini-2.5-flash",
    "gemini-1.5-flash"
  ];

  const maxRetries = 3;

  for (const modelName of models) {
    const model = genAI.getGenerativeModel({ model: modelName });

    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await model.generateContent(
          `${systemPrompt}\n\n${prompt}`
        );

        return result.response.text();

      } catch (error) {
        console.log(`Retry ${i + 1} with ${modelName}`);
        await new Promise(res => setTimeout(res, 4000));
      }
    }
  }

  throw new Error("All Gemini models failed");
}

export async function generateReply(
  emailBody: string,
  emailSubject: string,
  userId: string
): Promise<{
  readonly draft: string;
  readonly coursesUsed: number;
  readonly fullContext: string;
}> {
  // RAG: retrieve relevant courses based on the email content
  const query = `${emailSubject} ${emailBody}`;
  const courses = await retrieveRelevantCourses(query, 5, 0.3);
  const courseContext = formatCoursesForPrompt(courses);

  // Fetch past reply history + feedback
  const history = await fetchReplyHistory(userId, 10);
  const historyContext = formatHistoryForPrompt(history);

  const prompt = buildPrompt(emailBody, emailSubject, courseContext, historyContext);

  const fullContext = `=== SYSTEM PROMPT ===\n${SYSTEM_PROMPT}\n\n=== USER PROMPT ===\n${prompt}`;

  const draft = await generateWithGemini(SYSTEM_PROMPT, prompt);

  return { draft, coursesUsed: courses.length, fullContext };
}
