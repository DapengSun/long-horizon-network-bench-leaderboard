import React, { useCallback, useMemo, useState } from "react";
import { Button, Select, Table, Typography, type TableColumnsType } from "antd";
import { LineChartOutlined } from "@ant-design/icons";
import { getEvaluationDetailEntry } from "../data/evaluationDetailsLoader";
import { buildCaseDetailChartPayload } from "../features/caseDetailChart";
import { useLocale } from "../i18n/LocaleContext";
import type { MessageKey } from "../i18n/messages";
import type {
  CaseDetailChartPayload,
  EvaluationCaseResult,
  EvaluationDetailSelection,
} from "../types";
import { CaseDetailChartModal } from "./CaseDetailChartModal";

const CATEGORY_OPTIONS: Array<{ value: string; labelKey: MessageKey }> = [
  { value: "LTNP", labelKey: "ltnpTitle" },
  { value: "LTRP", labelKey: "ltrpTitle" },
  { value: "LTCG", labelKey: "ltcgTitle" },
  { value: "LTCC", labelKey: "ltccTitle" },
  { value: "LTLB", labelKey: "ltlbTitle" },
  { value: "LTCO", labelKey: "ltcoTitle" },
  { value: "LTHOps", labelKey: "lthOpsTitle" },
  { value: "LTSOps", labelKey: "ltsOpsTitle" },
  { value: "LTNOps", labelKey: "ltnOpsTitle" },
];

interface EvaluationDetailPageProps {
  selection: EvaluationDetailSelection;
  onSelectionChange: (selection: EvaluationDetailSelection) => void;
  onBack: () => void;
}

function formatDuration(minutes: number): string {
  return `${minutes.toFixed(1)}m`;
}

function formatOptPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function totalDuration(cases: EvaluationCaseResult[]): number {
  return cases.reduce((sum, item) => sum + item.durationMinutes, 0);
}

export const EvaluationDetailPage: React.FC<EvaluationDetailPageProps> = ({
  selection,
  onSelectionChange,
  onBack,
}) => {
  const { t } = useLocale();
  const [chartOpen, setChartOpen] = useState(false);
  const [chartPayload, setChartPayload] = useState<CaseDetailChartPayload | null>(
    null
  );
  const localizedCategoryOptions = useMemo(
    () =>
      CATEGORY_OPTIONS.map((option) => ({
        value: option.value,
        label: `${option.value} · ${t(option.labelKey)}`,
        title: t(option.labelKey),
      })),
    [t]
  );
  const activeEntry = useMemo(
    () => getEvaluationDetailEntry(selection.model, selection.category),
    [selection.category, selection.model]
  );
  const categoryTitle =
    localizedCategoryOptions.find((option) => option.value === selection.category)
      ?.title ?? t("noData");
  const cases = activeEntry?.cases ?? [];

  const openCaseChart = useCallback(
    (caseName: string) => {
      const payload = buildCaseDetailChartPayload(
        selection.category,
        caseName,
        categoryTitle
      );
      if (!payload) {
        return;
      }
      setChartPayload(payload);
      setChartOpen(true);
    },
    [categoryTitle, selection.category]
  );

  const columns = useMemo<TableColumnsType<(typeof cases)[number]>>(
    () => [
      {
        title: t("detailCaseColumn"),
        dataIndex: "case",
        key: "case",
        width: "20%",
        defaultSortOrder: "ascend",
        sorter: (a, b) => a.case.localeCompare(b.case),
        render: (_, record) => (
          <div className="detail-case-cell">
            <Typography.Text className="detail-case-name" strong title={record.case}>
              {record.case}
            </Typography.Text>
            {record.detail && record.detail.length > 0 ? (
              <Button
                type="text"
                size="small"
                className="detail-case-chart-button"
                icon={<LineChartOutlined />}
                title={t("detailViewLatencyChart")}
                aria-label={t("detailViewLatencyChart")}
                onClick={() => openCaseChart(record.case)}
              />
            ) : null}
          </div>
        ),
      },
      {
        title: t("detailRoundsColumn"),
        dataIndex: "rounds",
        key: "rounds",
        align: "center",
        width: "20%",
        sorter: (a, b) => a.rounds - b.rounds,
      },
      {
        title: t("detailBestColumn"),
        dataIndex: "best",
        key: "best",
        align: "center",
        width: "20%",
      },
      {
        title: t("detailOptPercentColumn"),
        dataIndex: "optPercent",
        key: "optPercent",
        align: "center",
        width: "20%",
        sorter: (a, b) => a.optPercent - b.optPercent,
        render: (value: number) => (
          <span className="detail-score-pill">{formatOptPercent(value)}</span>
        ),
      },
      {
        title: t("detailDurationColumn"),
        dataIndex: "durationMinutes",
        key: "durationMinutes",
        align: "center",
        width: "20%",
        sorter: (a, b) => a.durationMinutes - b.durationMinutes,
        render: (minutes: number) => formatDuration(minutes),
      },
    ],
    [openCaseChart, t]
  );
  const activeDuration = totalDuration(cases);

  return (
    <section className="detail-page">
      <div className="detail-page-header">
        <div>
          <Button type="link" onClick={onBack} className="detail-back-button">
            {t("detailBackToRanking")}
          </Button>
          <Typography.Title level={3} className="detail-title">
            {t("detailTitle")}
          </Typography.Title>
        </div>
        <div className="detail-selectors">
          <Select
            value={selection.category}
            options={localizedCategoryOptions}
            onChange={(category) =>
              onSelectionChange({ model: selection.model, category })
            }
          />
        </div>
      </div>

      <div className="detail-summary-grid">
        <div className="detail-summary-card">
          <span>{t("model")}</span>
          <strong>{selection.model}</strong>
          <small>{t("detailCurrentRankingSelection")}</small>
        </div>
        <div className="detail-summary-card">
          <span>{t("detailBenchmarkCategory")}</span>
          <strong>{selection.category}</strong>
          <small>{categoryTitle}</small>
        </div>
        <div className="detail-summary-card accent">
          <span>{t("detailCaseCount")}</span>
          <strong>{cases.length}</strong>
          <small>{activeEntry ? t("detailLtcoCaseList") : t("noData")}</small>
        </div>
        <div className="detail-summary-card">
          <span>{t("detailTotalDuration")}</span>
          <strong>{formatDuration(activeDuration)}</strong>
          <small>{activeEntry?.submittedAt ?? t("noData")}</small>
        </div>
      </div>

      <Table<(typeof cases)[number]>
        className="detail-result-table"
        rowKey="case"
        columns={columns}
        dataSource={cases}
        pagination={false}
        bordered={false}
        tableLayout="fixed"
        locale={{ emptyText: t("noData") }}
      />

      <CaseDetailChartModal
        open={chartOpen}
        payload={chartPayload}
        onClose={() => {
          setChartOpen(false);
          setChartPayload(null);
        }}
      />
    </section>
  );
};
