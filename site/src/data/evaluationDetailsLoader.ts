import { getEvaluationDetailEntries } from "./leaderboardDataSource";
import type { EvaluationDetailEntry } from "../types";

export const evaluationDetailEntries: EvaluationDetailEntry[] =
  getEvaluationDetailEntries();

export function getEvaluationDetailEntry(
  model: string,
  category: string
): EvaluationDetailEntry | undefined {
  return evaluationDetailEntries.find(
    (entry) => entry.model === model && entry.category === category
  );
}
