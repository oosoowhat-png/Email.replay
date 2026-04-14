import { pipeline } from '@xenova/transformers';
import { createServiceRoleClient } from "@/lib/supabase/server";

let extractor: any;

async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return extractor;
}

interface CourseMatch {
  readonly id: string;
  readonly course_name: string;
  readonly course_link: string;
  readonly content: string;
  readonly metadata: Record<string, unknown>;
  readonly similarity: number;
}

export async function retrieveRelevantCourses(
  query: string,
  matchCount: number = 5,
  matchThreshold: number = 0.3
): Promise<ReadonlyArray<CourseMatch>> {
  // Generate embedding for the query
  const extractor = await getExtractor();
  const output = await extractor(query, { pooling: 'mean', normalize: true });
  const queryEmbedding = Array.from(output.data);

  // Query Supabase for similar courses
  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase.rpc("match_courses", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    console.error("Error querying course embeddings:", error);
    return [];
  }

  return data as ReadonlyArray<CourseMatch>;
}

export function formatCoursesForPrompt(
  courses: ReadonlyArray<CourseMatch>
): string {
  if (courses.length === 0) {
    return "No relevant courses found in the knowledge base.";
  }

  return courses
    .map(
      (course, i) =>
        `[Course ${i + 1}]\n${course.content}\nRelevance: ${(course.similarity * 100).toFixed(1)}%`
    )
    .join("\n\n");
}
