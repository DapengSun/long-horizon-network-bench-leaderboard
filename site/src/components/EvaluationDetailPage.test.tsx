import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { LocaleProvider, useLocale } from "../i18n/LocaleContext";
import type { Locale } from "../i18n/messages";
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

describe("EvaluationDetailPage", () => {
  it("shows the LTCO case list with English UI chrome by default", () => {
    renderDetail({ model: "DeepSeek-V4-Pro", category: "LTCO" });

    expect(screen.getByText("Back to ranking")).toBeTruthy();
    expect(screen.getByText("Latest Evaluation Details")).toBeTruthy();
    expect(screen.getByText("Model")).toBeTruthy();
    expect(screen.getByText("Benchmark Category")).toBeTruthy();
    expect(
      screen.getByText("Collective Communication CCL Algorithm Optimization - LTCO")
    ).toBeTruthy();
    expect(screen.getByText("Case Count")).toBeTruthy();
    expect(screen.getByText("Total Duration")).toBeTruthy();
    expect(screen.getByText("case")).toBeTruthy();
    expect(screen.getByText("rounds")).toBeTruthy();
    expect(screen.getByText("best")).toBeTruthy();
    expect(screen.getByText("opt%")).toBeTruthy();
    expect(screen.getByText("duration")).toBeTruthy();
    expect(screen.getByText("ltco-a100-ag-16-128m")).toBeTruthy();
    expect(screen.getByText("0.10%")).toBeTruthy();
    expect(screen.getByText("15.2m")).toBeTruthy();
  });

  it("shows Chinese UI chrome when locale is Chinese", () => {
    renderDetail({ model: "DeepSeek-V4-Pro", category: "LTCO" }, "zh-CN");

    expect(screen.getByText("返回排名表")).toBeTruthy();
    expect(screen.getByText("最新评测详情")).toBeTruthy();
    expect(screen.getByText("模型")).toBeTruthy();
    expect(screen.getByText("基准分类")).toBeTruthy();
    expect(screen.getByText("集合通信 CCL 算法调优-LTCO")).toBeTruthy();
    expect(screen.getByText("case 数量")).toBeTruthy();
    expect(screen.getByText("总评测时长")).toBeTruthy();
    expect(screen.getByText("用例")).toBeTruthy();
    expect(screen.getByText("轮次")).toBeTruthy();
    expect(screen.getByText("最佳")).toBeTruthy();
    expect(screen.getByText("时长")).toBeTruthy();
    expect(screen.getByText("ltco-a100-ag-16-128m")).toBeTruthy();
  });

  it("shows no data for models without LTCO detail data", () => {
    renderDetail({ model: "GLM-5.1", category: "LTCO" });

    expect(screen.getAllByText("No data").length).toBeGreaterThan(0);
    expect(screen.queryByText("ltco-a100-ag-16-128m")).toBeNull();
  });

  it("opens the latency chart modal when clicking the case trend icon", () => {
    renderDetail({ model: "DeepSeek-V4-Pro", category: "LTCO" });

    const chartButtons = screen.getAllByLabelText("View latency trend chart");
    expect(chartButtons.length).toBeGreaterThan(0);

    fireEvent.click(chartButtons[0]);

    expect(screen.getByText("Optimization Trend")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getAllByText("DeepSeek-V4-Pro").length).toBeGreaterThan(0);
  });
});
