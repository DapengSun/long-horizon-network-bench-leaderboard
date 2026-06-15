export type MetricDirection = "lower_is_better" | "higher_is_better";
export type MetricBaseline = "first_round";

export interface EvaluationDetailMetric {
  name: string;
  label: string;
  unit: string;
  direction: MetricDirection;
  baseline: MetricBaseline;
}

export interface EvaluationCaseDetailPoint {
  round: string;
  score: number;
}

export interface EvaluationCaseResult {
  case: string;
  rounds: number;
  best: string;
  optPercent: number;
  durationMinutes: number;
  detail?: EvaluationCaseDetailPoint[];
}

export interface CaseDetailChartModelResult {
  model: string;
  detail: EvaluationCaseDetailPoint[];
}

export interface CaseDetailChartPayload {
  case: string;
  category: string;
  categoryTitle: string;
  metric: EvaluationDetailMetric;
  results: CaseDetailChartModelResult[];
}

export interface EvaluationDetailFile {
  model?: string;
  category?: string;
  submittedAt: string;
  metric?: EvaluationDetailMetric;
  cases: EvaluationCaseResult[];
}

export interface EvaluationDetailEntry {
  model: string;
  category: string;
  submittedAt: string;
  metric: EvaluationDetailMetric;
  cases: EvaluationCaseResult[];
}

export interface EvaluationDetailData {
  entries: EvaluationDetailEntry[];
}

export interface EvaluationDetailSelection {
  model: string;
  category: string;
}
