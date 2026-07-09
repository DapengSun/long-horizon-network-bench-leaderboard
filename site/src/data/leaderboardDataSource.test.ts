import { describe, expect, it } from "vitest";
import {
  getDashboardData,
  modelDisplayFieldsFromMetadata,
} from "./leaderboardDataSource";
import { buildScoreTableRows } from "../features/dashboardData";
import { getEvaluationDetailEntry } from "./evaluationDetailsLoader";

describe("leaderboardDataSource", () => {
  it("matches model metadata by uppercase id and displays metadata fields", () => {
    const fields = modelDisplayFieldsFromMetadata(
      "deepseek-v4-pro",
      [
        {
          id: "DeepSeek-V4-Pro",
          name: "DeepSeek-V4-Pro",
          provider: "DeepSeek",
          url: "https://example.com/deepseek",
          tags: ["OSS"],
        },
      ],
      "deepseek"
    );

    expect(fields).toEqual({
      name: "DeepSeek-V4-Pro",
      provider: "DeepSeek",
      url: "https://example.com/deepseek",
      tags: ["OSS"],
    });
  });

  it("loads enriched fake model roster with GLM first", () => {
    const rows = buildScoreTableRows(
      getDashboardData(),
      new Set(["LTNP", "LTRP", "LTCG", "LTCC", "LTLB", "LTCO"])
    );

    expect(rows[0]).toMatchObject({
      model: "GLM-5.1 · ClaudeCode",
      provider: "Z.ai",
    });
    expect(rows.map((row) => row.model)).toEqual(
      expect.arrayContaining([
        "Qwen3.6-35B-A3B · OpenCode",
        "DeepSeek-V4-Pro · OpenCode",
        "MiniMax-M2.5 · ClaudeCode",
      ])
    );
  });

  it("computes dashboard benchmark averages from best case scores", () => {
    const dashboard = getDashboardData();
    const ltco = dashboard.benchmarks.find((benchmark) => benchmark.secondary === "LTCO");
    const row = ltco?.rows.find(
      (item) => item.model === "DeepSeek-V4-Pro · OpenCode"
    );
    const detailEntry = getEvaluationDetailEntry("DeepSeek-V4-Pro · OpenCode", "LTCO");
    const cases = detailEntry?.cases ?? [];
    const bestAverage =
      cases.length === 0
        ? 0
        : cases.reduce((sum, item) => sum + item.score, 0) / cases.length;

    expect(row?.average).toBe(Number(bestAverage.toFixed(4)));
  });
});
