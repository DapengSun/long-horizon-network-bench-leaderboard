import { evaluationDetailEntries } from "../data/evaluationDetailsLoader";
import { DEFAULT_DETAIL_METRIC } from "../data/evaluationDetailMetric";
import type {
  CaseDetailChartPayload,
  EvaluationCaseDetailPoint,
  MetricDirection,
} from "../types";

export { DEFAULT_DETAIL_METRIC } from "../data/evaluationDetailMetric";

export function parseRoundIndex(round: string): number {
  const match = round.match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export function phaseOrder(phase?: string): number {
  if (phase === "phase1") {
    return 1;
  }
  if (phase === "phase2") {
    return 2;
  }
  if (phase === "final") {
    return 3;
  }
  return 0;
}

export function detailPointSortValue(point: EvaluationCaseDetailPoint): number {
  const roundIndex =
    typeof point.roundIndex === "number" ? point.roundIndex : parseRoundIndex(point.round);
  return phaseOrder(point.phase) * 1_000_000 + roundIndex;
}

export function sortDetailPoints(
  detail: EvaluationCaseDetailPoint[]
): EvaluationCaseDetailPoint[] {
  return [...detail].sort((a, b) => {
    const byPhaseRound = detailPointSortValue(a) - detailPointSortValue(b);
    return byPhaseRound || a.round.localeCompare(b.round);
  });
}

export function improvementVsBaselinePct(
  baseline: number,
  current: number,
  direction: MetricDirection = "lower_is_better"
): number {
  if (baseline === 0) {
    return 0;
  }

  if (direction === "higher_is_better") {
    return ((current - baseline) / baseline) * 100;
  }

  return ((baseline - current) / baseline) * 100;
}

export function chartValueForDetailPoint({
  currentScore,
}: {
  category?: string;
  baselineScore?: number;
  currentScore: number;
  direction?: MetricDirection;
}): number {
  return currentScore;
}

export function formatNormalizedScore(value: number): string {
  return value.toFixed(4);
}

/** @deprecated use improvementVsBaselinePct for chart semantics */
export function latencyDeltaPercent(
  baseline: number,
  current: number
): number {
  if (baseline === 0) {
    return 0;
  }
  return ((current - baseline) / baseline) * 100;
}

export function findBestDetailPoint(
  detail: EvaluationCaseDetailPoint[],
  direction: MetricDirection = "lower_is_better"
): EvaluationCaseDetailPoint | undefined {
  if (detail.length === 0) {
    return undefined;
  }

  return detail.reduce((best, point) => {
    if (direction === "higher_is_better") {
      return point.score > best.score ? point : best;
    }
    return point.score < best.score ? point : best;
  });
}

export function formatLatency(value: number): string {
  if (value >= 1000) {
    return value.toFixed(1);
  }
  if (value >= 10) {
    return value.toFixed(2);
  }
  if (value >= 1) {
    return value.toFixed(3);
  }
  return value.toFixed(4);
}

export function formatImprovementPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatScoreWithUnit(score: number, unit: string): string {
  const formatted = formatLatency(score);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function buildCaseDetailChartPayload(
  category: string,
  caseName: string,
  categoryTitle: string,
  model?: string
): CaseDetailChartPayload | undefined {
  const matchingEntries = evaluationDetailEntries.filter(
    (entry) => entry.category === category && (!model || entry.model === model)
  );
  const results = matchingEntries
    .map((entry) => {
      const caseItem = entry.cases.find((item) => item.case === caseName);
      if (!caseItem?.detail?.length) {
        return null;
      }

      return {
        model: entry.model,
        detail: sortDetailPoints(caseItem.detail),
        finalScore: caseItem.score,
        bestRound: caseItem.best,
        durationMinutes: caseItem.durationMinutes,
        roundCount: caseItem.rounds,
      };
    })
    .filter(
      (
        result
      ): result is {
        model: string;
        detail: EvaluationCaseDetailPoint[];
        finalScore: number;
        bestRound: string;
        durationMinutes: number;
        roundCount: number;
      } =>
        result !== null
    );

  if (results.length === 0) {
    return undefined;
  }

  const metric =
    matchingEntries.find((entry) =>
      entry.cases.some((item) => item.case === caseName && item.detail?.length)
    )?.metric ?? DEFAULT_DETAIL_METRIC;

  return {
    case: caseName,
    category,
    categoryTitle,
    metric,
    results,
  };
}
