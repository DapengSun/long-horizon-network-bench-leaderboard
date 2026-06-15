import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider, useLocale } from "./LocaleContext";

const LocaleProbe = () => {
  const { locale, t } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span>{t("tabRanking")}</span>
      <span>{t("searchPlaceholder")}</span>
      <span>{t("quickFilters")}</span>
      <span>{t("modelLegend")}</span>
    </div>
  );
};

describe("LocaleContext", () => {
  it("defaults the site language to English", () => {
    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>
    );

    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(screen.getByText("Ranking")).toBeTruthy();
    expect(screen.getByText('Search by model name · try "Qwen GLM"')).toBeTruthy();
    expect(screen.getByText("Quick Filters")).toBeTruthy();
    expect(screen.getByText("Model Legend")).toBeTruthy();
  });
});
