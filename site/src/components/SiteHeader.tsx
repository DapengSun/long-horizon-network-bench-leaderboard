import React from "react";
import { Segmented, Typography } from "antd";
import { useLocale } from "../i18n/LocaleContext";
import type { Locale } from "../i18n/messages";

interface SiteHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { locale, setLocale, t } = useLocale();

  return (
    <header className="site-header">
      <div className="site-header-brand">
        <Typography.Title level={1} className="site-title">
          {t("title")} {t("subtitle")}
        </Typography.Title>
        <Typography.Text className="site-tagline">{t("tagline")}</Typography.Text>
      </div>

      <div className="site-header-actions">
        <Segmented
          className="site-tab-switch"
          value={activeTab === "detail" ? "ranking" : activeTab}
          onChange={(value) => onTabChange(String(value))}
          options={[
            { label: t("tabRanking"), value: "ranking" },
            { label: t("tabDashboard"), value: "dashboard" },
          ]}
        />
        <Segmented
          className="site-locale-switch"
          value={locale}
          onChange={(value) => setLocale(value as Locale)}
          options={[
            { label: "EN", value: "en" },
            { label: "ZH", value: "zh-CN" },
          ]}
        />
        <a
          className="site-link"
          href="https://github.com/ai-twinkle/Eval"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("runEval")}
        </a>
      </div>
    </header>
  );
};
