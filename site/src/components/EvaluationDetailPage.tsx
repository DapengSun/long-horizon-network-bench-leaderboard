import React, { useCallback, useMemo, useState } from "react";
import { Button, Select, Table, Tooltip, Typography, type TableColumnsType } from "antd";
import { LineChartOutlined } from "@ant-design/icons";
import { getEvaluationDetailEntry } from "../data/evaluationDetailsLoader";
import { buildCaseDetailChartPayload } from "../features/caseDetailChart";
import {
  bestRoundForDisplay,
  formatPhaseRoundCount,
  isMultiphaseCategory,
} from "../features/multiphaseDetail";
import { DEFAULT_DETAIL_METRIC, sortDetailPoints } from "../features/caseDetailChart";
import { useLocale } from "../i18n/LocaleContext";
import type { MessageKey } from "../i18n/messages";
import type {
  CaseDetailChartPayload,
  EvaluationCaseAttempt,
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

function attemptTime(
  attempt: Pick<EvaluationCaseResult, "evaluatedAt" | "submittedAt">
): string | undefined {
  return attempt.evaluatedAt ?? attempt.submittedAt;
}

function latestAttemptTime(record: EvaluationCaseResult): string | undefined {
  const latestAttempt = record.history?.find((attempt) => attempt.isLatest);
  return latestAttempt
    ? latestAttempt.evaluatedAt ?? latestAttempt.submittedAt
    : attemptTime(record);
}

function renderScoreCell(
  record: Pick<EvaluationCaseResult, "score" | "isBest">,
  t: (key: MessageKey) => string,
  options?: { showBestStar?: boolean }
): React.ReactNode {
  const label = formatScore(record.score);
  const showBestStar = options?.showBestStar && record.isBest;

  return (
    <span className="detail-score-pill">
      <span className="detail-score-pill-value">{label}</span>
      {showBestStar ? (
        <Tooltip title={t("detailBestScoreTooltip")}>
          <span
            className="detail-score-pill-star multiphase-selected-star"
            aria-label={t("detailBestScoreLabel")}
          >
            ⭐
          </span>
        </Tooltip>
      ) : null}
    </span>
  );
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

  const openAttemptChart = useCallback(
    (caseName: string, attempt: EvaluationCaseAttempt) => {
      if (!attempt.detail?.length) {
        return;
      }
      const timeLabel = formatAttemptTime(attempt.evaluatedAt ?? attempt.submittedAt);
      setChartPayload({
        case: caseName,
        category: selection.category,
        categoryTitle,
        metric: activeEntry?.metric ?? DEFAULT_DETAIL_METRIC,
        results: [
          {
            model: `${selection.model} · ${timeLabel}`,
            detail: sortDetailPoints(attempt.detail),
            finalScore: attempt.score,
            bestRound: attempt.best,
            durationMinutes: attempt.durationMinutes,
            roundCount: attempt.rounds,
          },
        ],
      });
      setChartOpen(true);
    },
    [activeEntry?.metric, categoryTitle, selection.category, selection.model]
  );

  const columns = useMemo<TableColumnsType<(typeof cases)[number]>>(
    () => [
      {
        title: t("detailCaseColumn"),
        dataIndex: "case",
        key: "case",
        align: "center",
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
                onClick={(event) => {
                  event.stopPropagation();
                  openCaseChart(record.case);
                }}
              />
            ) : null}
          </div>
        ),
      },
      {
        title: (
          <Tooltip title={t("detailBestEvaluatedAtTooltip")}>
            <span>{t("detailBestEvaluatedAtColumn")}</span>
          </Tooltip>
        ),
        key: "evaluatedAt",
        align: "center",
        width: "16%",
        sorter: (a, b) =>
          new Date(attemptTime(a) ?? 0).getTime() -
          new Date(attemptTime(b) ?? 0).getTime(),
        render: (_, record) => (
          <div className="detail-attempt-time-cell">
            <span>{formatAttemptTime(attemptTime(record))}</span>
          </div>
        ),
      },
      {
        title: (
          <Tooltip title={t("detailLastEvaluatedAtTooltip")}>
            <span>{t("detailLastEvaluatedAtColumn")}</span>
          </Tooltip>
        ),
        key: "lastEvaluatedAt",
        align: "center",
        width: "16%",
        sorter: (a, b) =>
          new Date(latestAttemptTime(a) ?? 0).getTime() -
          new Date(latestAttemptTime(b) ?? 0).getTime(),
        render: (_, record) => (
          <div className="detail-attempt-time-cell">
            <span>{formatAttemptTime(latestAttemptTime(record))}</span>
          </div>
        ),
      },
      {
        title: t("detailRoundsColumn"),
        dataIndex: "rounds",
        key: "rounds",
        align: "center",
        width: "10%",
        sorter: (a, b) => a.rounds - b.rounds,
        render: (rounds: number, record) =>
          isMultiphase ? formatPhaseRoundCount(record.detail, rounds) : rounds,
      },
      {
        title: t("detailBestColumn"),
        dataIndex: "best",
        key: "best",
        align: "center",
        width: "12%",
        render: (best: string, record) =>
          isMultiphase ? bestRoundForDisplay(record.detail, best) : best,
      },
      {
        title: t("detailScoreColumn"),
        dataIndex: "score",
        key: "score",
        align: "center",
        width: "14%",
        sorter: (a, b) => a.score - b.score,
        render: (_, record) => renderScoreCell(record, t),
      },
      {
        title: t("detailDurationColumn"),
        dataIndex: "durationMinutes",
        key: "durationMinutes",
        align: "center",
        width: "12%",
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
        <div className="detail-history-panel">
          <table className="detail-history-rows-table">
          <colgroup>
            <col className="detail-history-col-expand" />
            <col style={{ width: "20%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <tbody>
            {history.map((attempt, index) => (
              <tr
                key={`${attempt.runId ?? "run"}-${attempt.evaluatedAt ?? index}`}
                className="detail-history-row"
              >
                <td className="detail-history-col-expand" aria-hidden="true" />
                <td className="detail-history-cell-case" />
                <td className="detail-history-cell-center">
                  <div className="detail-history-cell-inner">
                    <div className="detail-attempt-time-cell">
                      {attempt.detail?.length ? (
                        <Button
                          type="text"
                          size="small"
                          className="detail-case-chart-button"
                          icon={<LineChartOutlined />}
                          title={t("detailViewLatencyChart")}
                          aria-label={t("detailViewLatencyChart")}
                          onClick={(event) => {
                            event.stopPropagation();
                            openAttemptChart(record.case, attempt);
                          }}
                        />
                      ) : null}
                      <span>
                        {formatAttemptTime(attempt.evaluatedAt ?? attempt.submittedAt)}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="detail-history-cell-center" />
                <td className="detail-history-cell-center">
                  <span className="detail-history-cell-inner">
                    {isMultiphase
                      ? formatPhaseRoundCount(attempt.detail, attempt.rounds)
                      : attempt.rounds}
                  </span>
                </td>
                <td className="detail-history-cell-center">
                  <span className="detail-history-cell-inner">
                    {isMultiphase
                      ? bestRoundForDisplay(attempt.detail, attempt.best)
                      : attempt.best}
                  </span>
                </td>
                <td className="detail-history-cell-center">
                  <span className="detail-history-cell-inner">
                    {renderScoreCell(attempt, t, { showBestStar: true })}
                  </span>
                </td>
                <td className="detail-history-cell-center">
                  <span className="detail-history-cell-inner">
                    {formatDuration(attempt.durationMinutes)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      );
    },
    [isMultiphase, openAttemptChart, t]
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

      <Typography.Paragraph className="detail-attempt-policy">
        {t("detailBestAttemptNotice")}
      </Typography.Paragraph>

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
                expandRowByClick: true,
                expandedRowRender: renderHistory,
                expandedRowClassName: () => "detail-expanded-row",
                rowExpandable: (record) => (record.history?.length ?? 0) > 1,
              }
            : undefined
        }
        rowClassName={(record) =>
          (record.history?.length ?? 0) > 1 ? "detail-row-expandable" : ""
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
