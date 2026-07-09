import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { LocaleProvider, useLocale } from "../i18n/LocaleContext";
import type { Locale } from "../i18n/messages";
import type { CaseDetailChartPayload } from "../types";
import { CaseLatencyChart } from "./CaseLatencyChart";
import { EvaluationDetailPage } from "./EvaluationDetailPage";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function LocaleSetter({ locale }: { locale: Locale }) {
  const { setLocale } = useLocale();
  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);
  return null;
}

function renderDetail(
  selection: { model: string; category: string },
  locale: Locale = "en"
) {
  return render(
    <LocaleProvider>
      <LocaleSetter locale={locale} />
      <EvaluationDetailPage
        selection={selection}
        onSelectionChange={vi.fn()}
        onBack={vi.fn()}
      />
    </LocaleProvider>
  );
}

function renderChart(payload: CaseDetailChartPayload) {
  return render(
    <LocaleProvider>
      <CaseLatencyChart payload={payload} />
    </LocaleProvider>
  );
}

describe("EvaluationDetailPage", () => {
  it("shows the LTCO case list with English UI chrome by default", () => {
    renderDetail({ model: "DeepSeek-V4-Pro · OpenCode", category: "LTCO" });

    expect(screen.getByText("Back to ranking")).toBeTruthy();
    expect(screen.getByText("Evaluation Details")).toBeTruthy();
    expect(screen.getByText("Model")).toBeTruthy();
    expect(screen.getByText("Benchmark Category")).toBeTruthy();
    expect(
      screen.getByText("Collective Communication CCL Algorithm Optimization - LTCO")
    ).toBeTruthy();
    expect(
      screen.getByText(
        "The main table shows the best-scoring historical attempt for each case. Expand a row to view all attempts, including the latest one."
      )
    ).toBeTruthy();
    expect(screen.getByText("Case Count")).toBeTruthy();
    expect(screen.getByText("Total Duration")).toBeTruthy();
    expect(screen.getByText("case")).toBeTruthy();
    expect(screen.getByText("rounds")).toBeTruthy();
    expect(screen.getByText("best")).toBeTruthy();
    expect(screen.getByText("Best score")).toBeTruthy();
    expect(screen.getByText("best evaluated at")).toBeTruthy();
    expect(screen.getByText("last evaluated at")).toBeTruthy();
    expect(screen.getByText("duration")).toBeTruthy();
    expect(screen.getByText("ltco-a100-ag-16-128m")).toBeTruthy();
  });

  it("expands historical attempts as evaluation rows without source paths", () => {
    const { container } = renderDetail({
      model: "DeepSeek-V4-Pro · OpenCode",
      category: "LTCO",
    });

    const expandButton = container.querySelector(
      ".ant-table-row-expand-icon"
    ) as HTMLButtonElement | null;
    expect(expandButton).toBeTruthy();
    const expandableRow = expandButton?.closest("tr");
    expect(expandableRow).toBeTruthy();
    fireEvent.click(expandableRow as Element);
    expect(expandButton?.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(expandableRow as Element);
    expect(expandButton?.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(expandableRow as Element);

    expect(screen.getByRole("columnheader", { name: "best evaluated at" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "last evaluated at" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "rounds" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "best" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Best score" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "duration" })).toBeTruthy();
    expect(container.querySelector(".detail-history-panel")).toBeTruthy();
    expect(screen.queryByText("latest")).toBeNull();
    expect(
      container.querySelectorAll(".detail-history-panel .detail-score-pill-star").length
    ).toBeGreaterThan(0);
    const mainTableBody = container.querySelector(".detail-result-table .ant-table-tbody");
    for (const row of mainTableBody?.querySelectorAll(":scope > tr:not(.ant-table-expanded-row)") ??
      []) {
      expect(row.querySelector(".detail-score-pill-star")).toBeNull();
    }
    expect(screen.getAllByLabelText("View latency trend chart").length).toBeGreaterThan(1);
    expect(screen.queryByText("fake-old-opencode-deepseek-v4-pro")).toBeNull();
    expect(screen.queryByText("fake-latest-opencode-deepseek-v4-pro")).toBeNull();
  });

  it("shows Chinese UI chrome when locale is Chinese", () => {
    renderDetail({ model: "DeepSeek-V4-Pro · OpenCode", category: "LTCO" }, "zh-CN");

    expect(screen.getByText("返回排名表")).toBeTruthy();
    expect(screen.getByText("评测详情")).toBeTruthy();
    expect(screen.getByText("模型")).toBeTruthy();
    expect(screen.getByText("基准分类")).toBeTruthy();
    expect(screen.getByText("集合通信 CCL 算法调优-LTCO")).toBeTruthy();
    expect(screen.getByText("case 数量")).toBeTruthy();
    expect(screen.getByText("总评测时长")).toBeTruthy();
    expect(
      screen.getByText(
        "主表展示每个 case 历史评测记录中最佳分数最高的那次结果；展开行可查看全部历史记录，包括最新一次。"
      )
    ).toBeTruthy();
    expect(screen.getByText("用例")).toBeTruthy();
    expect(screen.getByText("轮次")).toBeTruthy();
    expect(screen.getByText("最佳")).toBeTruthy();
    expect(screen.getByText("最佳分数")).toBeTruthy();
    expect(screen.getByText("最佳评测时间")).toBeTruthy();
    expect(screen.getByText("最近评测时间")).toBeTruthy();
    expect(screen.getByText("时长")).toBeTruthy();
    expect(screen.getByText("ltco-a100-ag-16-128m")).toBeTruthy();
  });

  it("shows no data for models without LTCO detail data", () => {
    renderDetail({ model: "GLM-5.1", category: "LTCO" });

    expect(screen.getAllByText("No data").length).toBeGreaterThan(0);
    expect(screen.queryByText("ltco-a100-ag-16-128m")).toBeNull();
  });

  it("opens the latency chart modal when clicking the case trend icon", () => {
    renderDetail({ model: "DeepSeek-V4-Pro · OpenCode", category: "LTCO" });

    const chartButtons = screen.getAllByLabelText("View latency trend chart");
    expect(chartButtons.length).toBeGreaterThan(0);

    fireEvent.click(chartButtons[0]);

    expect(screen.getByText("Optimization Trend")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getAllByText("DeepSeek-V4-Pro · OpenCode").length).toBeGreaterThan(0);
  });

  it("opens the LTCC multiphase modal for phase-aware cases", () => {
    renderDetail({ model: "DeepSeek-V4-Pro · OpenCode", category: "LTCC" });

    expect(screen.getByText("LTCC/LTLB multiphase evaluation")).toBeTruthy();
    expect(document.querySelector(".ant-table-row-expand-icon-cell")).toBeNull();
    expect(screen.getAllByText(/P1 \d+ \/ P2 \d+/).length).toBeGreaterThan(0);
    expect(screen.getByText("Best score")).toBeTruthy();
    expect(screen.getByText("0.6445")).toBeTruthy();
    expect(screen.queryByText("64.45%")).toBeNull();

    const chartButtons = screen.getAllByLabelText("View latency trend chart");
    fireEvent.click(chartButtons[0]);

    expect(screen.getAllByText("Learning Journey").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Phase 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Phase 2").length).toBeGreaterThan(0);
    expect(screen.getByText("Total score")).toBeTruthy();
    expect(screen.queryByText("Generalization story")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Phase 2/i }));

    expect(screen.getByText("Worst scenario")).toBeTruthy();
  });

  it("shows LTCO latency formula details without changing other chart semantics", () => {
    const { container } = renderChart({
      case: "ltco-a100-ag-16-512k",
      category: "LTCO",
      categoryTitle: "Collective Communication CCL Algorithm Optimization - LTCO",
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
          bestRound: "round2",
          detail: [
            {
              round: "round1",
              score: 0,
              metrics: {
                best_latency_us: 256.794,
                baseline_latency_us: 202.275,
                valid: true,
              },
            },
            {
              round: "round2",
              score: 0.19769620566061058,
              metrics: {
                best_latency_us: 162.286,
                baseline_latency_us: 202.275,
                valid: true,
                candidate_hash:
                  "a42f8c36a8e65c81f7e0c349e260bb8f7f2f464db7e1d1528791d6bc2231f635",
                sourceArtifact:
                  "agent/LTCO/ltco-a100-ag-16-512k/artifacts/rounds/round2/score.json",
              },
            },
          ],
        },
      ],
    });

    expect(
      screen.queryByText(
        "Latency formula: score = max(0, 1 - best latency / baseline latency)"
      )
    ).toBeNull();
    expect(screen.getByText("Formula")).toBeTruthy();
    expect(screen.getByText("max(0, 1 - 162.286 / 202.275)")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Best latency (us)" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Baseline latency (us)" })).toBeTruthy();
    expect(screen.getByText("162.286")).toBeTruthy();
    expect(screen.getAllByText("202.275").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0.1977").length).toBeGreaterThan(0);
    expect(screen.queryByRole("columnheader", { name: "Best" })).toBeNull();
    expect(screen.queryByLabelText("Expand row")).toBeNull();
    expect(screen.getByLabelText("Best round")).toBeTruthy();

    const bestPoint = container.querySelector(".case-latency-chart-point-best");
    expect(bestPoint?.parentElement).toBeTruthy();
    fireEvent.mouseEnter(bestPoint?.parentElement as Element);

    expect(screen.getByText("best_latency_us: 162.286 us")).toBeTruthy();
    expect(screen.getByText("baseline_latency_us: 202.275 us")).toBeTruthy();
    expect(screen.queryByText("valid")).toBeNull();
    expect(screen.queryByText(/a42f8c36a8e65/)).toBeNull();
    expect(screen.queryByText(/sourceArtifact/)).toBeNull();
  });
});
