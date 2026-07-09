import { describe, expect, it } from "vitest";
import {
  bestRoundForDisplay,
  buildMultiphaseDetailView,
  formatPhaseRoundCount,
  metricPresetsForCategory,
  metricValueForRound,
} from "./multiphaseDetail";
import type { CaseDetailChartPayload } from "../types";

const ltlbPayload: CaseDetailChartPayload = {
  case: "ltlb-heavytail-ecmp-v4",
  category: "LTLB",
  categoryTitle: "Load Balancing and RDMA Traffic Steering - LTLB",
  metric: {
    name: "score",
    label: "Score",
    unit: "",
    direction: "higher_is_better",
    baseline: "first_round",
  },
  results: [
    {
      model: "DeepSeek-V4-Pro · OpenCode",
      finalScore: 0.61,
      bestRound: "phase2/round2",
      roundCount: 3,
      durationMinutes: 12,
      detail: [
        {
          round: "phase1/round1",
          phase: "phase1",
          roundIndex: 1,
          score: 0.3,
          scoreKind: "single_scenario",
          metrics: {
            baseline_score: 0.2,
          },
        },
        {
          round: "phase2/round1",
          phase: "phase2",
          roundIndex: 1,
          score: 0.42,
          scoreKind: "public_suite",
          scenarios: [
            {
              scenario: "public_load50_x12_base",
              suite: "public",
              score: 0.5,
              sloPass: true,
              metrics: {
                cnp_event_count: 1200,
                uplink_imbalance_cv: 0.8,
                p99_fct_us: 620,
              },
            },
            {
              scenario: "public_load70_x12_pressure",
              suite: "public",
              score: 0,
              rawScoreBeforeSloGate: 0.35,
              sloPass: false,
              metrics: {
                cnp_event_count: 4800,
                uplink_imbalance_cv: 1.4,
                p99_fct_us: 800,
              },
            },
          ],
        },
        {
          round: "phase2/round2",
          phase: "phase2",
          roundIndex: 2,
          score: 0.61,
          scoreKind: "public_suite",
          scenarios: [
            {
              scenario: "public_load50_x12_base",
              suite: "public",
              score: 0.62,
              sloPass: true,
              metrics: {
                cnp_event_count: 900,
                uplink_imbalance_cv: 0.6,
                p99_fct_us: 590,
              },
            },
            {
              scenario: "public_load70_x12_pressure",
              suite: "public",
              score: 0.51,
              sloPass: true,
              metrics: {
                cnp_event_count: 2200,
                uplink_imbalance_cv: 1.0,
                p99_fct_us: 710,
              },
            },
          ],
        },
      ],
    },
  ],
};

describe("multiphaseDetail", () => {
  it("uses LTLB-specific metric presets", () => {
    const keys = metricPresetsForCategory("LTLB").map((preset) => preset.key);

    expect(keys).toContain("cnp_event_count");
    expect(keys).toContain("uplink_imbalance_cv");
    expect(keys).toContain("pfc_event_count");
  });

  it("builds summary cards and scenario matrix from phase2 data", () => {
    const view = buildMultiphaseDetailView(ltlbPayload);

    expect(view?.models[0].summary.phase1Count).toBe(1);
    expect(view?.models[0].summary.phase2Count).toBe(2);
    expect(view?.models[0].summary.phase1Gain).toBeCloseTo(0.1);
    expect(view?.models[0].summary.bestPhase2Round?.round).toBe("phase2/round2");
    expect(view?.models[0].summary.phase2SloPassRate).toBe(0.75);
    expect(view?.models[0].summary.worstPublicScenarioScore).toBe(0);
    expect(view?.models[0].summary.generalizationStory).toContain("anchor gain +10.0pp");
    expect(view?.models[0].scenarioMatrix.scenarios).toEqual([
      "public_load50_x12_base",
      "public_load70_x12_pressure",
    ]);
  });

  it("formats phase round counts and prefers the best phase2 round", () => {
    const detail = ltlbPayload.results[0].detail;

    expect(formatPhaseRoundCount(detail, 3)).toBe("P1 1 / P2 2");
    expect(formatPhaseRoundCount(undefined, 9, { phase1: 4, phase2: 5 })).toBe(
      "P1 4 / P2 5"
    );
    expect(bestRoundForDisplay(detail, "phase1/round1")).toBe("phase2/round2");
  });

  it("aggregates scenario metrics for selected LTLB fields", () => {
    const phase2 = ltlbPayload.results[0].detail[1];
    const cnpPreset = metricPresetsForCategory("LTLB").find(
      (preset) => preset.key === "cnp_event_count"
    );

    expect(cnpPreset).toBeDefined();
    expect(metricValueForRound(phase2, cnpPreset!)).toBe(4800);
  });
});
