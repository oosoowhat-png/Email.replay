import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from "@supabase/supabase-js";
import { pipeline } from '@xenova/transformers';
import { readFileSync } from "fs";
import { resolve } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
let extractor: any;

interface CourseRow {
  readonly name: string;
  readonly link: string;
  readonly description: string;
  readonly price: string;
  readonly startingDate: string;
  readonly format: string;
  readonly numLessons: string;
  readonly durationHours: string;
  readonly targetAudience: string;
}

function parseCSV(filePath: string): ReadonlyArray<CourseRow> {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  // Skip header
  const dataLines = lines.slice(1);

  return dataLines.map((line) => {
    const fields = parseCSVLine(line);
    return {
      name: fields[0] ?? "",
      link: fields[1] ?? "",
      description: fields[2] ?? "",
      price: fields[3] ?? "",
      startingDate: fields[4] ?? "",
      format: fields[5] ?? "",
      numLessons: fields[6] ?? "",
      durationHours: fields[7] ?? "",
      targetAudience: fields[8] ?? "",
    };
  });
}

function parseCSVLine(line: string): ReadonlyArray<string> {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function buildCourseText(course: CourseRow): string {
  return [
    `Course: ${course.name}`,
    `Description: ${course.description}`,
    `Price: ${course.price}`,
    `Starting Date: ${course.startingDate}`,
    `Format: ${course.format}`,
    `Number of Lessons: ${course.numLessons}`,
    `Duration: ${course.durationHours} hours`,
    `Target Audience: ${course.targetAudience}`,
    `Link: ${course.link}`,
  ].join("\n");
}

async function generateEmbedding(text: string): Promise<ReadonlyArray<number>> {
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function main() {
  console.log("Reading CSV...");
  const csvPath = resolve(__dirname, "../../vizuara_courses_dummy_dataset_150.csv");
  const courses = parseCSV(csvPath);
  console.log(`Found ${courses.length} courses`);

  extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('Embedding model loaded.');

  // Clear existing embeddings
  console.log("Clearing existing course embeddings...");
  const { error: deleteError } = await supabase
    .from("course_embeddings")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    console.error("Error clearing embeddings:", deleteError);
    return;
  }

  // Process in batches of 10
  const BATCH_SIZE = 10;
  let processed = 0;

  for (let i = 0; i < courses.length; i += BATCH_SIZE) {
    const batch = courses.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildCourseText);

    // Generate embeddings for the batch
    const embeddings = await Promise.all(texts.map(generateEmbedding));

    const rows = batch.map((course, idx) => ({
      course_name: course.name,
      course_link: course.link,
      content: texts[idx],
      embedding: JSON.stringify(embeddings[idx]),
      metadata: {
        price: course.price,
        starting_date: course.startingDate,
        format: course.format,
        num_lessons: parseInt(course.numLessons) || 0,
        duration_hours: parseInt(course.durationHours) || 0,
        target_audience: course.targetAudience,
      },
    }));

    const { error } = await supabase.from("course_embeddings").insert(rows);
    if (error) {
      console.error(`Error inserting batch at index ${i}:`, error);
      return;
    }

    processed += batch.length;
    console.log(`Processed ${processed}/${courses.length} courses`);
  }

  console.log("Done! All course embeddings stored in Supabase.");
}

main().catch(console.error);
