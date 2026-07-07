import type {
  CaseDetailChartModelResult,
  CaseDetailChartPayload,
  EvaluationCaseDetailPoint,
  EvaluationCaseScenario,
  EvaluationMetricValue,
} from "../types";
import { sortDetailPoints } from "./caseDetailChart";

export type MultiphaseCategory = "LTCC" | "LTLB";
export type MetricAggregation = "max" | "mean";

export interface MultiphaseMetricPreset {
  key: string;
  label: string;
  unit: string;
  aggregation: MetricAggregation;
}

export interface MultiphaseSummary {
  phase1Count: number;
  phase2Count: number;
  bestPhase1Round?: EvaluationCaseDetailPoint;
  bestPhase2Round?: EvaluationCaseDetailPoint;
  phase1Gain?: number;
  phase2SloPassRate?: number;
  worstPublicScenarioScore?: number;
  generalizationStory: string;
}

export interface MultiphaseScenarioCell {
  round: string;
  scenario: string;
  score?: number;
  sloPass?: boolean;
  metrics?: Record<string, EvaluationMetricValue>;
  sloChecks?: EvaluationCaseScenario["sloChecks"];
}

export interface MultiphaseScenarioMatrix {
  rounds: string[];
  scenarios: string[];
  cells: MultiphaseScenarioCell[];
}

export interface MultiphaseModelView {
  result: CaseDetailChartModelResult;
  rounds: EvaluationCaseDetailPoint[];
  phase1Rounds: EvaluationCaseDetailPoint[];
  phase2Rounds: EvaluationCaseDetailPoint[];
  summary: MultiphaseSummary;
  scenarioMatrix: MultiphaseScenarioMatrix;
}

export interface MultiphaseDetailView {
  category: MultiphaseCategory;
  metricPresets: MultiphaseMetricPreset[];
  models: MultiphaseModelView[];
}

const LTCC_METRICS: MultiphaseMetricPreset[] = [
  { key: "pfc_event_count", label: "PFC events", unit: "", aggregation: "max" },
  { key: "p99_fct_us", label: "p99 FCT", unit: "us", aggregation: "max" },
  { key: "throughput_mean_gbps", label: "Throughput", unit: "Gbps", aggregation: "mean" },
  { key: "qlen_peak_cells", label: "Queue peak", unit: "cells", aggregation: "max" },
  { key: "qlen_hotspot_max_kb", label: "Hotspot queue peak", unit: "KB", aggregation: "max" },
];

const LTLB_METRICS: MultiphaseMetricPreset[] = [
  { key: "pfc_event_count", label: "PFC events", unit: "", aggregation: "max" },
  { key: "cnp_event_count", label: "CNP events", unit: "", aggregation: "max" },
  { key: "p99_fct_us", label: "p99 FCT", unit: "us", aggregation: "max" },
  { key: "throughput_mean_gbps", label: "Throughput", unit: "Gbps", aggregation: "mean" },
  { key: "uplink_imbalance_cv", label: "Uplink imbalance CV", unit: "", aggregation: "max" },
  { key: "voq_occupancy_peak_bytes", label: "VOQ peak", unit: "bytes", aggregation: "max" },
];

export function isMultiphaseCategory(category: string): category is MultiphaseCategory {
  return category === "LTCC" || category === "LTLB";
}

export function metricPresetsForCategory(
  category: MultiphaseCategory
): MultiphaseMetricPreset[] {
  return category === "LTCC" ? LTCC_METRICS : LTLB_METRICS;
}

export function phaseLabel(phase?: string): string {
  if (phase === "phase1") {
    return "Phase 1";
  }
  if (phase === "phase2") {
    return "Phase 2";
  }
  if (phase === "final") {
    return "Final";
  }
  return "Round";
}

export function phaseRoundCounts(detail: EvaluationCaseDetailPoint[] | undefined): {
  phase1: number;
  phase2: number;
} {
  const points = detail ?? [];
  return {
    phase1: points.filter((point) => point.phase === "phase1").length,
    phase2: points.filter((point) => point.phase === "phase2").length,
  };
}

export function formatPhaseRoundCount(
  detail: EvaluationCaseDetailPoint[] | undefined,
  fallback: number
): string {
  const counts = phaseRoundCounts(detail);
  if (counts.phase1 === 0 && counts.phase2 === 0) {
    return String(fallback);
  }
  return `P1 ${counts.phase1} / P2 ${counts.phase2}`;
}

export function bestRoundForDisplay(
  detail: EvaluationCaseDetailPoint[] | undefined,
  fallback: string
): string {
  const phase2 = (detail ?? []).filter((point) => point.phase === "phase2");
  if (phase2.length === 0) {
    return fallback;
  }
  return phase2.reduce((best, point) => (point.score > best.score ? point : best)).round;
}

function numericMetric(value: EvaluationMetricValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function aggregateMetric(values: number[], aggregation: MetricAggregation): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  if (aggregation === "max") {
    return Math.max(...values);
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function metricValueForRound(
  point: EvaluationCaseDetailPoint,
  preset: MultiphaseMetricPreset
): number | undefined {
  const direct = numericMetric(point.metrics?.[preset.key]);
  if (direct !== undefined) {
    return direct;
  }
  const scenarioValues =
    point.scenarios
      ?.map((scenario) => numericMetric(scenario.metrics?.[preset.key]))
      .filter((value): value is number => value !== undefined) ?? [];
  return aggregateMetric(scenarioValues, preset.aggregation);
}

function bestRound(rounds: EvaluationCaseDetailPoint[]): EvaluationCaseDetailPoint | undefined {
  return rounds.length > 0
    ? rounds.reduce((best, point) => (point.score > best.score ? point : best))
    : undefined;
}

function phase1Gain(
  phase1Rounds: EvaluationCaseDetailPoint[],
  bestPhase1Round: EvaluationCaseDetailPoint | undefined
): number | undefined {
  if (!bestPhase1Round) {
    return undefined;
  }
  const explicitDelta = numericMetric(bestPhase1Round.metrics?.delta_vs_baseline);
  if (explicitDelta !== undefined) {
    return explicitDelta;
  }
  const baseline = numericMetric(bestPhase1Round.metrics?.baseline_score);
  if (baseline !== undefined) {
    return bestPhase1Round.score - baseline;
  }
  const firstScore = phase1Rounds[0]?.score;
  if (firstScore !== undefined) {
    return bestPhase1Round.score - firstScore;
  }
  return undefined;
}

function buildGeneralizationStory(
  phase1GainValue: number | undefined,
  bestPhase2Round: EvaluationCaseDetailPoint | undefined,
  phase2SloPassRate: number | undefined,
  worstPublicScenarioScore: number | undefined
): string {
  const parts: string[] = [];
  if (phase1GainValue !== undefined) {
    const sign = phase1GainValue >= 0 ? "+" : "";
    parts.push(`anchor gain ${sign}${(phase1GainValue * 100).toFixed(1)}pp`);
  }
  if (bestPhase2Round) {
    parts.push(`best public suite ${bestPhase2Round.score.toFixed(4)}`);
  }
  if (phase2SloPassRate !== undefined) {
    parts.push(`SLO pass ${(phase2SloPassRate * 100).toFixed(0)}%`);
  }
  if (worstPublicScenarioScore !== undefined) {
    parts.push(`worst scenario ${worstPublicScenarioScore.toFixed(4)}`);
  }
  return parts.length > 0
    ? `This run shows ${parts.join(", ")}.`
    : "This run has insufficient phase detail for a generalization summary.";
}

function buildSummary(
  phase1Rounds: EvaluationCaseDetailPoint[],
  phase2Rounds: EvaluationCaseDetailPoint[]
): MultiphaseSummary {
  const bestPhase1Round = bestRound(phase1Rounds);
  const bestPhase2Round =
    bestRound(phase2Rounds);
  const scenarioStatuses = phase2Rounds.flatMap((point) =>
    (point.scenarios ?? [])
      .filter((scenario) => scenario.sloPass !== undefined)
      .map((scenario) => scenario.sloPass === true)
  );
  const publicScores = phase2Rounds.flatMap((point) =>
    (point.scenarios ?? [])
      .filter((scenario) => scenario.suite === undefined || scenario.suite === "public")
      .map((scenario) => scenario.score)
      .filter((score) => Number.isFinite(score))
  );

  const phase1GainValue = phase1Gain(phase1Rounds, bestPhase1Round);
  const phase2SloPassRate =
    scenarioStatuses.length > 0
      ? scenarioStatuses.filter(Boolean).length / scenarioStatuses.length
      : undefined;
  const worstPublicScenarioScore =
    publicScores.length > 0 ? Math.min(...publicScores) : undefined;

  return {
    phase1Count: phase1Rounds.length,
    phase2Count: phase2Rounds.length,
    bestPhase1Round,
    bestPhase2Round,
    phase1Gain: phase1GainValue,
    phase2SloPassRate,
    worstPublicScenarioScore,
    generalizationStory: buildGeneralizationStory(
      phase1GainValue,
      bestPhase2Round,
      phase2SloPassRate,
      worstPublicScenarioScore
    ),
  };
}

function buildScenarioMatrix(
  phase2Rounds: EvaluationCaseDetailPoint[]
): MultiphaseScenarioMatrix {
  const rounds = phase2Rounds.map((point) => point.round);
  const scenarios = Array.from(
    new Set(
      phase2Rounds.flatMap((point) =>
        (point.scenarios ?? []).map((scenario) => scenario.scenario)
      )
    )
  );
  const cells = phase2Rounds.flatMap((point) =>
    (point.scenarios ?? []).map((scenario) => ({
      round: point.round,
      scenario: scenario.scenario,
      score: scenario.score,
      sloPass: scenario.sloPass,
      metrics: scenario.metrics,
      sloChecks: scenario.sloChecks,
    }))
  );
  return { rounds, scenarios, cells };
}

export function buildMultiphaseDetailView(
  payload: CaseDetailChartPayload
): MultiphaseDetailView | undefined {
  if (!isMultiphaseCategory(payload.category)) {
    return undefined;
  }

  return {
    category: payload.category,
    metricPresets: metricPresetsForCategory(payload.category),
    models: payload.results.map((result) => {
      const rounds = sortDetailPoints(result.detail);
      const phase1Rounds = rounds.filter((point) => point.phase === "phase1");
      const phase2Rounds = rounds.filter((point) => point.phase === "phase2");
      return {
        result,
        rounds,
        phase1Rounds,
        phase2Rounds,
        summary: buildSummary(phase1Rounds, phase2Rounds),
        scenarioMatrix: buildScenarioMatrix(phase2Rounds),
      };
    }),
  };
}

export function formatMetricValue(value: number | undefined, unit = ""): string {
  if (value === undefined) {
    return "-";
  }
  const abs = Math.abs(value);
  const formatted =
    abs >= 100 ? value.toFixed(0) : abs >= 10 ? value.toFixed(1) : value.toFixed(3);
  return unit ? `${formatted} ${unit}` : formatted;
}
