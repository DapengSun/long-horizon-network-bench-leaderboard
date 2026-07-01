import { describe, expect, it } from "vitest";
import {
  buildCaseDetailChartPayload,
  chartValueForDetailPoint,
  findBestDetailPoint,
  formatImprovementPct,
  improvementVsBaselinePct,
  parseRoundIndex,
  sortDetailPoints,
} from "./caseDetailChart";

describe("caseDetailChart", () => {
  it("sorts detail points by round index", () => {
    const sorted = sortDetailPoints([
      { round: "round3", score: 3 },
      { round: "round1", score: 1 },
      { round: "round2", score: 2 },
    ]);

    expect(sorted.map((point) => point.round)).toEqual([
      "round1",
      "round2",
      "round3",
    ]);
  });

  it("sorts multiphase points by stage before round index", () => {
    const sorted = sortDetailPoints([
      { round: "phase2/round1", phase: "phase2", roundIndex: 1, score: 2 },
      { round: "phase1/round2", phase: "phase1", roundIndex: 2, score: 1.2 },
      { round: "phase1/round1", phase: "phase1", roundIndex: 1, score: 1.1 },
      { round: "phase2/round2", phase: "phase2", roundIndex: 2, score: 2.2 },
    ]);

    expect(sorted.map((point) => point.round)).toEqual([
      "phase1/round1",
      "phase1/round2",
      "phase2/round1",
      "phase2/round2",
    ]);
  });

  it("finds the lowest latency point as best", () => {
    const best = findBestDetailPoint([
      { round: "round1", score: 100 },
      { round: "round2", score: 80 },
      { round: "round3", score: 90 },
    ]);

    expect(best?.round).toBe("round2");
  });

  it("computes improvement vs baseline for lower-is-better metrics", () => {
    expect(improvementVsBaselinePct(100, 80)).toBe(20);
    expect(improvementVsBaselinePct(100, 100)).toBe(0);
    expect(formatImprovementPct(12.5)).toBe("+12.50%");
  });

  it("uses LTCO normalized score as latency improvement percent", () => {
    expect(
      chartValueForDetailPoint({
        category: "LTCO",
        baselineScore: 0,
        currentScore: 0.19769620566061058,
        direction: "higher_is_better",
      })
    ).toBeCloseTo(19.7696205661);
  });

  it("keeps non-LTCO chart values relative to the first round baseline", () => {
    expect(
      chartValueForDetailPoint({
        category: "LTCC",
        baselineScore: 0.5,
        currentScore: 0.75,
        direction: "higher_is_better",
      })
    ).toBe(50);
  });

  it("builds chart payload with metric metadata", () => {
    const payload = buildCaseDetailChartPayload(
      "LTCO",
      "ltco-a100-ag-16-128m",
      "Collective Communication CCL Algorithm Optimization - LTCO"
    );

    expect(payload).toBeDefined();
    expect(payload?.metric.unit).toBe("");
    expect(payload?.metric.direction).toBe("higher_is_better");
    expect(payload?.results).toHaveLength(4);
    expect(payload?.results.map((result) => result.model)).toContain(
      "DeepSeek-V4-Pro · OpenCode"
    );
    expect(
      payload?.results.find((result) => result.model === "DeepSeek-V4-Pro · OpenCode")
        ?.detail.length
    ).toBeGreaterThan(0);
  });

  it("filters chart payload to the selected model and agent", () => {
    const payload = buildCaseDetailChartPayload(
      "LTCO",
      "ltco-a100-ag-16-128m",
      "Collective Communication CCL Algorithm Optimization - LTCO",
      "GLM-5.1 · ClaudeCode"
    );

    expect(payload).toBeDefined();
    expect(payload?.results.map((result) => result.model)).toEqual([
      "GLM-5.1 · ClaudeCode",
    ]);
  });

  it("preserves LTCC phase metrics and scenario details in chart payloads", () => {
    const payload = buildCaseDetailChartPayload(
      "LTCC",
      "ltcc-highbdp-v4",
      "Switch/Endpoint Joint Tuning - LTCC"
    );

    expect(payload).toBeDefined();
    const phase2 = payload?.results[0].detail.find(
      (point) => point.round === "phase2/round1"
    );
    expect(phase2?.phase).toBe("phase2");
    expect(phase2?.scoreKind).toBe("public_suite");
    expect(phase2?.metrics?.phase2_public_score).toBeTypeOf("number");
    expect(phase2?.scenarios?.length).toBeGreaterThan(0);
    expect(phase2?.scenarios?.[0].metrics?.p99_fct_us).toBeTypeOf("number");
  });

  it("parses round index", () => {
    expect(parseRoundIndex("round10")).toBe(10);
    expect(parseRoundIndex("round0")).toBe(0);
  });
});
