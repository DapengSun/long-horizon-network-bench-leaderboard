import { describe, expect, it } from "vitest";
import {
  evaluationDetailEntries,
  getEvaluationDetailEntry,
} from "./evaluationDetailsLoader";

describe("evaluationDetailsLoader", () => {
  it("loads LTCO detail files from category directories", () => {
    expect(evaluationDetailEntries.length).toBeGreaterThan(0);

    const entry = getEvaluationDetailEntry("DeepSeek-V4-Pro", "LTCO");
    expect(entry).toBeDefined();
    expect(entry?.category).toBe("LTCO");
    expect(entry?.cases.some((item) => item.case === "ltco-a100-ag-16-128m")).toBe(
      true
    );
  });

  it("returns undefined when model or category has no detail file", () => {
    expect(getEvaluationDetailEntry("GLM-5.1", "LTCO")).toBeUndefined();
    expect(getEvaluationDetailEntry("DeepSeek-V4-Pro", "LTCC")).toBeUndefined();
    expect(getEvaluationDetailEntry("DeepSeek-V4-Pro", "LTLB")).toBeUndefined();
  });
});
