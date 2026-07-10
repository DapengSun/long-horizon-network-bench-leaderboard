import { describe, expect, it } from "vitest";
import {
  buildCategorySummaries,
  buildOverview,
  selectBestCompletedResults,
} from "./generate-leaderboard-data.js";

describe("generate leaderboard data", () => {
  it("uses the best historical score for each task when computing overview averages", () => {
    const benchmarks = [
      {
        id: "LTCO",
        primary: "performance-tuning",
        title: "LTCO",
      },
    ];
    const models = [
      {
        id: "model-a",
        name: "Model A",
        provider: "Provider A",
      },
    ];
    const runs = [
      {
        runId: "older-better",
        agent: "opencode",
        model: "model-a",
        provider: "Provider A",
        submittedAt: "2026-06-15T09:00:00Z",
        results: {
          "case-1": {
            benchmark: "LTCO",
            status: "completed",
            score: 0.95,
            bestRound: "round5",
            evaluatedAt: "2026-06-15T10:00:00Z",
          },
        },
      },
      {
        runId: "newer-worse",
        agent: "opencode",
        model: "model-a",
        provider: "Provider A",
        submittedAt: "2026-06-16T09:00:00Z",
        results: {
          "case-1": {
            benchmark: "LTCO",
            status: "completed",
            score: 0.88,
            bestRound: "round4",
            evaluatedAt: "2026-06-16T10:00:00Z",
          },
        },
      },
      {
        runId: "case-2",
        agent: "opencode",
        model: "model-a",
        provider: "Provider A",
        submittedAt: "2026-06-16T09:30:00Z",
        results: {
          "case-2": {
            benchmark: "LTCO",
            status: "completed",
            score: 0.75,
            bestRound: "round3",
            evaluatedAt: "2026-06-16T10:30:00Z",
          },
        },
      },
    ];

    const bestResults = selectBestCompletedResults(runs, benchmarks);
    const overview = buildOverview({
      benchmarks,
      models,
      latestResults: bestResults,
      generatedAt: "2026-07-08T00:00:00Z",
    });

    expect(bestResults.find((result) => result.taskId === "case-1")?.runId).toBe(
      "older-better"
    );
    expect(overview.rows[0].benchmarks.LTCO).toBe(0.85);
  });

  it("normalizes model and agent aliases before grouping results", () => {
    const benchmarks = [
      {
        id: "LTCO",
        primary: "performance-tuning",
        title: "LTCO",
      },
    ];
    const models = [
      {
        id: "DeepSeek-V4-Pro",
        name: "DeepSeek-V4-Pro",
        provider: "DeepSeek",
        aliases: ["deepseek-v4-pro", "deepseek-pro-v4"],
      },
    ];
    const agents = [
      {
        id: "claudecode",
        name: "ClaudeCode",
        aliases: ["claude-code"],
      },
    ];
    const runs = [
      {
        runId: "alias-run",
        agent: "claude-code",
        model: "deepseek-v4-pro",
        provider: "deepseek",
        submittedAt: "2026-06-15T09:00:00Z",
        results: {
          "case-1": {
            benchmark: "LTCO",
            status: "completed",
            score: 0.88,
          },
        },
      },
      {
        runId: "canonical-run",
        agent: "claudecode",
        model: "DeepSeek-V4-Pro",
        provider: "DeepSeek",
        submittedAt: "2026-06-16T09:00:00Z",
        results: {
          "case-1": {
            benchmark: "LTCO",
            status: "completed",
            score: 0.95,
          },
        },
      },
    ];

    const bestResults = selectBestCompletedResults(runs, benchmarks, {
      models,
      agents,
    });
    const overview = buildOverview({
      benchmarks,
      models,
      latestResults: bestResults,
      generatedAt: "2026-07-08T00:00:00Z",
    });

    expect(bestResults).toHaveLength(1);
    expect(bestResults[0]).toMatchObject({
      runId: "canonical-run",
      model: "DeepSeek-V4-Pro",
      agent: "claudecode",
      provider: "DeepSeek",
    });
    expect(overview.rows).toHaveLength(1);
    expect(overview.rows[0]).toMatchObject({
      model: "DeepSeek-V4-Pro",
      agent: "claudecode",
      provider: "DeepSeek",
    });
  });

  it("carries lightweight round counts into category summaries", () => {
    const summaries = buildCategorySummaries({
      benchmarks: [{ id: "LTCO", primary: "performance-tuning", title: "LTCO" }],
      latestResults: [
        {
          taskId: "case-1",
          benchmark: "LTCO",
          runId: "run-1",
          model: "model-a",
          agent: "opencode",
          score: 0.95,
          nativeScore: 0.95,
          roundCount: 3,
          phaseRoundCounts: { phase1: 1, phase2: 2 },
          submittedAt: "2026-06-15T09:00:00Z",
        },
      ],
      generatedAt: "2026-07-08T00:00:00Z",
    });

    expect(summaries[0].data.tasks[0].rounds).toBe(3);
    expect(summaries[0].data.tasks[0].phaseRoundCounts).toEqual({
      phase1: 1,
      phase2: 2,
    });
  });
});
