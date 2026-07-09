import { describe, expect, it } from "vitest";
import {
  evaluationDetailEntries,
  getEvaluationDetailEntry,
} from "./evaluationDetailsLoader";

describe("evaluationDetailsLoader", () => {
  it("loads LTCO details from batch raw-run files", () => {
    expect(evaluationDetailEntries.length).toBeGreaterThan(0);

    const entry = getEvaluationDetailEntry("DeepSeek-V4-Pro · OpenCode", "LTCO");
    expect(entry).toBeDefined();
    expect(entry?.category).toBe("LTCO");
    expect(entry?.cases.some((item) => item.case === "ltco-a100-ag-16-128m")).toBe(
      true
    );
  });

  it("shows the best evaluated result by default and keeps historical attempts", () => {
    const entry = getEvaluationDetailEntry("DeepSeek-V4-Pro · OpenCode", "LTCO");
    const caseResult = entry?.cases.find(
      (item) => item.case === "ltco-a100-ag-16-128m"
    );
    const history = caseResult?.history ?? [];

    expect(caseResult?.score).toBe(0.95);
    expect(caseResult?.evaluatedAt).toBe("2026-06-15T09:20:00Z");
    expect(caseResult?.isBest).toBe(true);
    expect(caseResult?.isLatest).toBe(false);
    expect(history).toHaveLength(2);
    expect(history.find((attempt) => attempt.isLatest)?.evaluatedAt).toBe(
      "2026-06-16T10:30:00Z"
    );
    expect(history.find((attempt) => attempt.isBest)?.score).toBe(0.95);
  });

  it("returns undefined when model or category has no detail file", () => {
    expect(getEvaluationDetailEntry("GLM-5.1", "LTCO")).toBeUndefined();
    expect(getEvaluationDetailEntry("DeepSeek-V4-Pro · OpenCode", "missing")).toBeUndefined();
  });

  it("preserves LTCC and LTLB multiphase detail payloads", () => {
    const ltcc = getEvaluationDetailEntry("DeepSeek-V4-Pro · OpenCode", "LTCC");
    const ltlb = getEvaluationDetailEntry("DeepSeek-V4-Pro · OpenCode", "LTLB");

    const ltccPhase2 = ltcc?.cases
      .find((item) => item.case === "ltcc-highbdp-v4")
      ?.detail?.find((point) => point.phase === "phase2");
    const ltlbPhase2 = ltlb?.cases
      .find((item) => item.case === "ltlb-heavytail-ecmp-v4")
      ?.detail?.find((point) => point.phase === "phase2");

    expect(ltccPhase2?.scoreKind).toBe("public_suite");
    expect(ltccPhase2?.scenarios?.[0].metrics?.pfc_event_count).toBeTypeOf("number");
    expect(ltlbPhase2?.scoreKind).toBe("public_suite");
    expect(ltlbPhase2?.scenarios?.[0].metrics?.cnp_event_count).toBeTypeOf("number");
    expect(ltlbPhase2?.scenarios?.[0].metrics?.uplink_imbalance_cv).toBeTypeOf("number");
  });
});
