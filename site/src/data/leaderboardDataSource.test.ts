import { describe, expect, it } from "vitest";
import {
  getDashboardData,
  modelDisplayFieldsFromMetadata,
} from "./leaderboardDataSource";
import { buildScoreTableRows } from "../features/dashboardData";

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
});
