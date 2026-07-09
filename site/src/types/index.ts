export type MetricDirection = "lower_is_better" | "higher_is_better";
export type MetricBaseline = "first_round";

export interface EvaluationDetailMetric {
  name: string;
  label: string;
  unit: string;
  direction: MetricDirection;
  baseline: MetricBaseline;
}

export type EvaluationRoundPhase = "phase1" | "phase2" | "final" | string;
export type EvaluationRoundScoreKind =
  | "single_scenario"
  | "public_suite"
  | "final_suite"
  | string;

export type EvaluationMetricValue =
  | string
  | number
  | boolean
  | null
  | EvaluationMetricValue[]
  | { [key: string]: EvaluationMetricValue };

export interface EvaluationSloCheck {
  actual?: number | string | boolean | null;
  threshold?: number | string | boolean | null;
  pass?: boolean;
  [key: string]: EvaluationMetricValue | undefined;
}

export interface EvaluationCaseScenario {
  scenario: string;
  suite?: string;
  score: number;
  rawScoreBeforeSloGate?: number;
  sloPass?: boolean;
  metrics?: Record<string, EvaluationMetricValue>;
  sloChecks?: Record<string, EvaluationSloCheck>;
  components?: Record<string, EvaluationMetricValue>;
  sourceArtifact?: string;
}

export interface EvaluationCaseDetailPoint {
  round: string;
  score: number;
  phase?: EvaluationRoundPhase;
  roundIndex?: number;
  scoreKind?: EvaluationRoundScoreKind;
  selectedFromPhase1Round?: string;
  metrics?: Record<string, EvaluationMetricValue>;
  sloChecks?: Record<string, EvaluationSloCheck>;
  scenarios?: EvaluationCaseScenario[];
}

export interface EvaluationCaseResult {
  case: string;
  rounds: number;
  best: string;
  score: number;
  durationMinutes: number;
  runId?: string;
  evaluatedAt?: string;
  submittedAt?: string;
  sourceCaseRunPath?: string;
  isBest?: boolean;
  isLatest?: boolean;
  phaseRoundCounts?: PhaseRoundCounts;
  history?: EvaluationCaseAttempt[];
  detail?: EvaluationCaseDetailPoint[];
}

export interface EvaluationCaseAttempt {
  runId?: string;
  evaluatedAt?: string;
  submittedAt?: string;
  sourceCaseRunPath?: string;
  rounds: number;
  best: string;
  score: number;
  durationMinutes: number;
  isBest: boolean;
  isLatest: boolean;
  phaseRoundCounts?: PhaseRoundCounts;
  detail?: EvaluationCaseDetailPoint[];
}

export interface PhaseRoundCounts {
  phase1?: number;
  phase2?: number;
}

export interface CaseDetailChartModelResult {
  model: string;
  detail: EvaluationCaseDetailPoint[];
  finalScore?: number;
  bestRound?: string;
  durationMinutes?: number;
  roundCount?: number;
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
