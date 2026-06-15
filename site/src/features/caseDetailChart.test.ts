import { describe, expect, it } from "vitest";
import {
  buildCaseDetailChartPayload,
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

  it("builds chart payload with metric metadata", () => {
    const payload = buildCaseDetailChartPayload(
      "LTCO",
      "ltco-a100-ag-16-128m",
      "Collective Communication CCL Algorithm Optimization - LTCO"
    );

    expect(payload).toBeDefined();
    expect(payload?.metric.unit).toBe("us");
    expect(payload?.metric.direction).toBe("lower_is_better");
    expect(payload?.results).toHaveLength(1);
    expect(payload?.results[0].model).toBe("DeepSeek-V4-Pro");
    expect(payload?.results[0].detail.length).toBeGreaterThan(0);
  });

  it("parses round index", () => {
    expect(parseRoundIndex("round10")).toBe(10);
    expect(parseRoundIndex("round0")).toBe(0);
  });
});
