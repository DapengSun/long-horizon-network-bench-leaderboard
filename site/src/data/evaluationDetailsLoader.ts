import { DEFAULT_DETAIL_METRIC } from "./evaluationDetailMetric";
import type { EvaluationDetailEntry, EvaluationDetailFile } from "../types";

const detailModules = import.meta.glob<EvaluationDetailFile>(
  "./evaluation-details/*/*.json",
  { eager: true, import: "default" }
);

function modelFromPath(path: string): string {
  const fileName = path.split("/").pop();
  if (!fileName) {
    throw new Error(`Unexpected evaluation detail path: ${path}`);
  }
  return decodeURIComponent(fileName.replace(/\.json$/, ""));
}

function categoryFromPath(path: string): string {
  const match = path.match(/evaluation-details\/([^/]+)\//);
  if (!match) {
    throw new Error(`Unexpected evaluation detail path: ${path}`);
  }
  return match[1];
}

function toEntry(path: string, file: EvaluationDetailFile): EvaluationDetailEntry {
  const category = categoryFromPath(path);
  const model = modelFromPath(path);

  return {
    model,
    category,
    submittedAt: file.submittedAt,
    metric: file.metric ?? DEFAULT_DETAIL_METRIC,
    cases: file.cases,
  };
}

export const evaluationDetailEntries: EvaluationDetailEntry[] = Object.entries(
  detailModules
).map(([path, file]) => toEntry(path, file));

export function getEvaluationDetailEntry(
  model: string,
  category: string
): EvaluationDetailEntry | undefined {
  return evaluationDetailEntries.find(
    (entry) => entry.model === model && entry.category === category
  );
}
