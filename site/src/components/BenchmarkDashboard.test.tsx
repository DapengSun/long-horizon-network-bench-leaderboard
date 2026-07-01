import { describe, expect, it } from "vitest";
import { detailCategoryForRow } from "./BenchmarkDashboard";

describe("BenchmarkDashboard", () => {
  it("uses the visible benchmark list order for the default detail category", () => {
    const category = detailCategoryForRow(
      {
        provider: "Z.ai",
        model: "GLM-5.1 · ClaudeCode",
        average: 0.7,
        scores: {
          LTNP: 0.8,
          LTRP: 0.7,
          LTCC: 0.6,
        },
      },
      [{ id: "LTNP" }, { id: "LTRP" }, { id: "LTCC" }]
    );

    expect(category).toBe("LTNP");
  });
});
