import React, { useState } from "react";
import { App as AntApp, ConfigProvider, theme } from "antd";
import { BenchmarkDashboard } from "./components/BenchmarkDashboard";
import { BenchmarkVisualDashboard } from "./components/BenchmarkVisualDashboard";
import { EvaluationDetailPage } from "./components/EvaluationDetailPage";
import { SiteHeader } from "./components/SiteHeader";
import { LocaleProvider } from "./i18n/LocaleContext";
import type { EvaluationDetailSelection } from "./types";

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState("ranking");
  const [detailSelection, setDetailSelection] = useState<EvaluationDetailSelection>({
    model: "GLM-5.1 · ClaudeCode",
    category: "LTNP",
  });

  const handleViewDetail = (selection: EvaluationDetailSelection) => {
    setDetailSelection(selection);
    setActiveTab("detail");
  };

  return (
    <div className="tw-page">
      <SiteHeader activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="tw-main">
        {activeTab === "ranking" ? (
          <BenchmarkDashboard onViewDetail={handleViewDetail} />
        ) : activeTab === "dashboard" ? (
          <BenchmarkVisualDashboard />
        ) : (
          <EvaluationDetailPage
            selection={detailSelection}
            onSelectionChange={setDetailSelection}
            onBack={() => setActiveTab("ranking")}
          />
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <ConfigProvider
    theme={{
      algorithm: theme.defaultAlgorithm,
      token: {
        colorPrimary: "#1677ff",
        borderRadius: 6,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif",
      },
    }}
  >
    <LocaleProvider>
      <AntApp>
        <AppContent />
      </AntApp>
    </LocaleProvider>
  </ConfigProvider>
);

export default App;
