import React, { useCallback, useMemo, useState } from "react";
import { Button, Select, Table, Tag, Typography, type TableColumnsType } from "antd";
import { LineChartOutlined } from "@ant-design/icons";
import { getEvaluationDetailEntry } from "../data/evaluationDetailsLoader";
import { buildCaseDetailChartPayload } from "../features/caseDetailChart";
import {
  bestRoundForDisplay,
  formatPhaseRoundCount,
  isMultiphaseCategory,
} from "../features/multiphaseDetail";
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
  { value: "LTMixOps", labelKey: "ltmixOpsTitle" },
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

function formatScore(value: number): string {
  return value.toFixed(4);
}

function formatAttemptTime(value: string | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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
  const hasExpandableHistory = cases.some((record) => (record.history?.length ?? 0) > 1);
  const isMultiphase = isMultiphaseCategory(selection.category);

  const openCaseChart = useCallback(
    (caseName: string) => {
      const payload = buildCaseDetailChartPayload(
        selection.category,
        caseName,
        categoryTitle,
        selection.model
      );
      if (!payload) {
        return;
      }
      setChartPayload(payload);
      setChartOpen(true);
    },
    [categoryTitle, selection.category, selection.model]
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
        render: (rounds: number, record) =>
          isMultiphase ? formatPhaseRoundCount(record.detail, rounds) : rounds,
      },
      {
        title: t("detailBestColumn"),
        dataIndex: "best",
        key: "best",
        align: "center",
        width: "20%",
        render: (best: string, record) =>
          isMultiphase ? bestRoundForDisplay(record.detail, best) : best,
      },
      {
        title: isMultiphase ? t("detailScoreColumn") : t("detailOptPercentColumn"),
        dataIndex: "optPercent",
        key: "optPercent",
        align: "center",
        width: "20%",
        sorter: (a, b) =>
          isMultiphase ? a.score - b.score : a.optPercent - b.optPercent,
        render: (value: number, record) => (
          <span className="detail-score-pill">
            {isMultiphase ? formatScore(record.score) : formatOptPercent(value)}
          </span>
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
    [isMultiphase, openCaseChart, t]
  );
  const activeDuration = totalDuration(cases);

  const renderHistory = useCallback(
    (record: (typeof cases)[number]) => {
      const history = record.history ?? [];
      if (history.length <= 1) {
        return null;
      }

      return (
        <div className="detail-history-list">
          {history.map((attempt, index) => (
            <div
              className="detail-history-item"
              key={`${attempt.runId ?? "run"}-${attempt.evaluatedAt ?? index}`}
            >
              <span>{formatAttemptTime(attempt.evaluatedAt ?? attempt.submittedAt)}</span>
              <strong>
                {isMultiphase
                  ? formatScore(attempt.score)
                  : formatOptPercent(attempt.optPercent)}
              </strong>
              <span>{formatDuration(attempt.durationMinutes)}</span>
              <span className="detail-history-tags">
                {attempt.isLatest ? <Tag color="blue">latest</Tag> : null}
                {attempt.isBest ? <Tag color="green">best</Tag> : null}
              </span>
              <small>{attempt.sourceCaseRunPath ?? attempt.runId}</small>
            </div>
          ))}
        </div>
      );
    },
    [isMultiphase]
  );

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

      {isMultiphase ? (
        <div className="detail-multiphase-explainer">
          <Typography.Text strong>{t("multiphaseExplainerTitle")}</Typography.Text>
          <Typography.Paragraph>
            {selection.category === "LTCC"
              ? t("ltccDetailExplainer")
              : t("ltlbDetailExplainer")}
          </Typography.Paragraph>
        </div>
      ) : null}

      <Table<(typeof cases)[number]>
        className="detail-result-table"
        rowKey="case"
        columns={columns}
        dataSource={cases}
        expandable={
          hasExpandableHistory
            ? {
                expandedRowRender: renderHistory,
                rowExpandable: (record) => (record.history?.length ?? 0) > 1,
              }
            : undefined
        }
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
