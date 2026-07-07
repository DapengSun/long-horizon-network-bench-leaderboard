import React, { useMemo, useState } from "react";
import { Button, Checkbox, Input, Popover, Space, Table, Typography } from "antd";
import { CaretRightOutlined, FilterOutlined, SearchOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import { getDashboardData } from "../data/leaderboardDataSource";
import {
  buildScoreTableRows,
  categoryMatchesQuery,
  dashboardRowMatchesQuery,
  getScoreFillStyle,
  shouldScrollScoreTable,
  type DashboardBenchmarkData,
  type DashboardScoreTableRow,
  type PrimaryCategoryId,
} from "../features/dashboardData";
import { useLocale } from "../i18n/LocaleContext";
import type { MessageKey } from "../i18n/messages";
import type { EvaluationDetailSelection } from "../types";

const data: DashboardBenchmarkData = getDashboardData();

const PRIMARY_CATEGORIES: Array<{
  id: PrimaryCategoryId;
  labelKey: MessageKey;
  children: Array<{ id: string; labelKey: MessageKey }>;
}> = [
  {
    id: "network-planning",
    labelKey: "networkPlanning",
    children: [
      { id: "LTNP", labelKey: "ltnpTitle" },
      { id: "LTRP", labelKey: "ltrpTitle" },
      { id: "LTCG", labelKey: "ltcgTitle" },
    ],
  },
  {
    id: "performance-tuning",
    labelKey: "performanceTuning",
    children: [
      { id: "LTCC", labelKey: "ltccTitle" },
      { id: "LTLB", labelKey: "ltlbTitle" },
      { id: "LTCO", labelKey: "ltcoTitle" },
    ],
  },
  {
    id: "ops",
    labelKey: "ops",
    children: [
      { id: "LTHOps", labelKey: "lthOpsTitle" },
      { id: "LTMixOps", labelKey: "ltmixOpsTitle" },
      { id: "LTSOps", labelKey: "ltsOpsTitle" },
      { id: "LTNOps", labelKey: "ltnOpsTitle" },
    ],
  },
];

interface FieldOption {
  key: "provider" | "model" | "average";
  labelKey: MessageKey;
}

type RankedScoreTableRow = DashboardScoreTableRow & {
  globalRank: number;
};

const FIELD_OPTIONS: FieldOption[] = [
  { key: "provider", labelKey: "provider" },
  { key: "model", labelKey: "model" },
  { key: "average", labelKey: "average" },
];

function formatAverage(value: number): string {
  return value.toFixed(4);
}

function scoreStyle(score: number): React.CSSProperties {
  const fill = getScoreFillStyle(score);
  return {
    "--score-width": fill.width,
    "--score-color": fill.color,
    "--score-text": fill.textColor,
  } as React.CSSProperties;
}

function ScoreBar({ score, title }: { score: number; title?: string }) {
  return (
    <span className="tw-score-bar" style={scoreStyle(score)} title={title}>
      <span className="tw-score-fill" />
      <span className="tw-score-value">{formatAverage(score)}</span>
    </span>
  );
}

export function detailCategoryForRow(
  row: DashboardScoreTableRow,
  selectedItems: Array<{ id: string }>
): string {
  const visibleScored = selectedItems
    .map((item) => item.id)
    .filter((id) => typeof row.scores[id] === "number");
  if (visibleScored.length === 1) {
    return visibleScored[0];
  }
  return visibleScored[0] ?? "LTNP";
}

interface BenchmarkDashboardProps {
  onViewDetail: (selection: EvaluationDetailSelection) => void;
}

export const BenchmarkDashboard: React.FC<BenchmarkDashboardProps> = ({
  onViewDetail,
}) => {
  const { t } = useLocale();
  const allSecondaryIds = useMemo(
    () =>
      PRIMARY_CATEGORIES.flatMap((category) =>
        category.children.map((child) => child.id)
      ),
    []
  );
  const localizedCategories = useMemo(
    () =>
      PRIMARY_CATEGORIES.map((category) => ({
        ...category,
        children: category.children.map((child) => ({
          id: child.id,
          label: t(child.labelKey),
        })),
      })),
    [t]
  );
  const [selectedSecondaries, setSelectedSecondaries] = useState<Set<string>>(
    () => new Set(allSecondaryIds)
  );
  const [expanded, setExpanded] = useState<Set<PrimaryCategoryId>>(
    () => new Set(PRIMARY_CATEGORIES.map((category) => category.id))
  );
  const [categoryQuery, setCategoryQuery] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const [visibleFields, setVisibleFields] = useState(
    () => new Set<FieldOption["key"]>(["provider", "model", "average"])
  );

  const scoreRowSecondaries = useMemo(
    () =>
      selectedSecondaries.size > 0
        ? selectedSecondaries
        : new Set(allSecondaryIds),
    [allSecondaryIds, selectedSecondaries]
  );
  const rows = useMemo(
    () => buildScoreTableRows(data, scoreRowSecondaries),
    [scoreRowSecondaries]
  );
  const rankedRows = useMemo<RankedScoreTableRow[]>(
    () =>
      rows.map((row, index) => ({
        ...row,
        globalRank: index + 1,
      })),
    [rows]
  );
  const filteredRows = useMemo(() => {
    return rankedRows.filter((row) => dashboardRowMatchesQuery(row, modelQuery));
  }, [modelQuery, rankedRows]);
  const selectedSecondaryItems = useMemo(
    () =>
      localizedCategories
        .flatMap((category) => category.children)
        .filter((child) => selectedSecondaries.has(child.id)),
    [localizedCategories, selectedSecondaries]
  );
  const shouldScroll = shouldScrollScoreTable(selectedSecondaryItems.length);
  const scrollX = shouldScroll
    ? 72 + 150 + 280 + selectedSecondaryItems.length * 112 + 130 + 130
    : undefined;
  const filteredCategories = useMemo(
    () =>
      localizedCategories.filter((category) =>
        categoryMatchesQuery(t(category.labelKey), category.children, categoryQuery)
      ),
    [categoryQuery, localizedCategories, t]
  );

  const columns = useMemo<TableColumnsType<RankedScoreTableRow>>(() => {
    const next: TableColumnsType<RankedScoreTableRow> = [
      {
        title: t("rank"),
        key: "rank",
        align: "center",
        fixed: shouldScroll ? "left" : undefined,
        width: shouldScroll ? 72 : 72,
        render: (_, row) => (
          <span className={`hf-rank ${row.globalRank <= 3 ? "podium" : ""}`}>
            {row.globalRank}
          </span>
        ),
      },
    ];

    if (visibleFields.has("provider")) {
      next.push({
        title: t("provider"),
        dataIndex: "provider",
        key: "provider",
        align: "center",
        fixed: shouldScroll ? "left" : undefined,
        width: shouldScroll ? 150 : undefined,
        render: (provider: string) => (
          <Typography.Text className="tw-provider">{provider}</Typography.Text>
        ),
      });
    }

    if (visibleFields.has("model")) {
      next.push({
        title: t("model"),
        dataIndex: "model",
        key: "model",
        align: "left",
        fixed: shouldScroll ? "left" : undefined,
        width: shouldScroll ? 280 : undefined,
        render: (model: string, row) => (
          <div className="tw-model-cell">
            {row.url ? (
              <a href={row.url} target="_blank" rel="noopener noreferrer">
                {model}
              </a>
            ) : (
              <Typography.Text>{model}</Typography.Text>
            )}
          </div>
        ),
      });
    }

    if (visibleFields.has("average")) {
      next.push({
        title: t("average"),
        dataIndex: "average",
        key: "average",
        align: "center",
        fixed: shouldScroll ? "left" : undefined,
        width: shouldScroll ? 130 : undefined,
        sorter: (a, b) => a.average - b.average,
        defaultSortOrder: "descend",
        render: (average: number) => <ScoreBar score={average} />,
      });
    }

    for (const item of selectedSecondaryItems) {
      next.push({
        title: item.id,
        key: item.id,
        align: "center",
        width: shouldScroll ? 112 : undefined,
        sorter: (a, b) => (a.scores[item.id] ?? -1) - (b.scores[item.id] ?? -1),
        render: (_, row) => {
          const score = row.scores[item.id];
          return score === undefined ? (
            <Typography.Text type="secondary">-</Typography.Text>
          ) : (
            <ScoreBar score={score} title={item.label} />
          );
        },
      });
    }

    next.push({
      title: t("details"),
      key: "latestResult",
      align: "center",
      width: shouldScroll ? 130 : undefined,
      render: (_, row) => (
        <Button
          className="latest-result-button"
          size="small"
          title={t("viewDetailsTitle")}
          onClick={() =>
            onViewDetail({
              model: row.model,
              category: detailCategoryForRow(row, selectedSecondaryItems),
            })
          }
        >
          {t("viewDetails")}
        </Button>
      ),
    });

    return next;
  }, [onViewDetail, selectedSecondaryItems, shouldScroll, t, visibleFields]);

  const quickFilters = [
    { key: "all", label: t("allBenchmarks"), ids: allSecondaryIds },
    ...PRIMARY_CATEGORIES.map((category) => ({
      key: category.id,
      label: t(category.labelKey),
      ids: category.children.map((child) => child.id),
    })),
  ];
  const selectedQuickFilter =
    quickFilters.find(
      (filter) =>
        filter.ids.length === selectedSecondaries.size &&
        filter.ids.every((id) => selectedSecondaries.has(id))
    )?.key ?? "custom";

  const selectorContent = (
    <aside className="benchmark-tree-panel">
          <div className="benchmark-tree-actions">
            <Button
              onClick={() => {
                setSelectedSecondaries(new Set(allSecondaryIds));
                setExpanded(new Set(PRIMARY_CATEGORIES.map((c) => c.id)));
              }}
            >
              {t("showAll")}
            </Button>
            <Button onClick={() => setSelectedSecondaries(new Set())}>
              {t("hideAll")}
            </Button>
          </div>
          <Input
            allowClear
            className="benchmark-tree-search"
            prefix={<SearchOutlined />}
            placeholder={t("searchBenchmarks")}
            value={categoryQuery}
            onChange={(event) => setCategoryQuery(event.target.value)}
          />
          <div className="benchmark-tree-list">
            {filteredCategories.map((category) => {
              const isExpanded = expanded.has(category.id);
              const childIds = category.children.map((child) => child.id);
              const selectedChildCount = childIds.filter((id) =>
                selectedSecondaries.has(id)
              ).length;
              const isPrimaryActive = selectedChildCount > 0;
              const isPrimaryFullySelected =
                selectedChildCount === childIds.length;
              return (
                <div key={category.id} className="benchmark-tree-group">
                  <div className="benchmark-tree-parent">
                    <button
                      className={`benchmark-tree-caret ${isExpanded ? "expanded" : ""}`}
                      type="button"
                      onClick={() => {
                        const next = new Set(expanded);
                        if (next.has(category.id)) next.delete(category.id);
                        else next.add(category.id);
                        setExpanded(next);
                      }}
                    >
                      <CaretRightOutlined />
                    </button>
                    <Checkbox
                      checked={isPrimaryActive}
                      indeterminate={isPrimaryActive && !isPrimaryFullySelected}
                      onChange={() => {
                        setSelectedSecondaries((current) => {
                          const next = new Set(current);
                          if (isPrimaryFullySelected) {
                            childIds.forEach((id) => next.delete(id));
                          } else {
                            childIds.forEach((id) => next.add(id));
                          }
                          return next;
                        });
                        setExpanded((current) => new Set(current).add(category.id));
                      }}
                    />
                    <button
                      className={`benchmark-tree-label ${isPrimaryActive ? "active" : ""}`}
                      type="button"
                      onClick={() => {
                        const next = new Set(expanded);
                        if (next.has(category.id)) next.delete(category.id);
                        else next.add(category.id);
                        setExpanded(next);
                      }}
                    >
                      {t(category.labelKey)}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="benchmark-tree-children">
                      {category.children.map((child) => {
                        const activeChild = selectedSecondaries.has(child.id);
                        return (
                          <div
                            key={child.id}
                            className={`benchmark-tree-child ${activeChild ? "active" : ""}`}
                          >
                            <Checkbox
                              checked={activeChild}
                              onChange={(event) => {
                                setSelectedSecondaries((current) => {
                                  const next = new Set(current);
                                  if (event.target.checked) next.add(child.id);
                                  else next.delete(child.id);
                                  return next;
                                });
                              }}
                            />
                            <span
                              onClick={() => {
                                setSelectedSecondaries((current) => {
                                  const next = new Set(current);
                                  if (next.has(child.id)) next.delete(child.id);
                                  else next.add(child.id);
                                  return next;
                                });
                              }}
                            >
                              {child.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
  );

  const columnContent = (
    <div className="column-visibility-panel">
      {FIELD_OPTIONS.map((field) => (
        <Checkbox
          key={field.key}
          checked={visibleFields.has(field.key)}
          onChange={(event) => {
            const next = new Set(visibleFields);
            if (event.target.checked) {
              next.add(field.key);
            } else if (next.size > 1) {
              next.delete(field.key);
            }
            setVisibleFields(next);
          }}
        >
          {t(field.labelKey)}
        </Checkbox>
      ))}
    </div>
  );

  return (
    <section className="benchmark-dashboard hf-leaderboard">
      <div className="hf-search-wrap">
        <Input
          allowClear
          className="hf-search"
          prefix={<SearchOutlined />}
          placeholder={t("searchPlaceholder")}
          suffix={
            <span className="hf-search-count">
              {filteredRows.length} / {rows.length}
            </span>
          }
          value={modelQuery}
          onChange={(event) => setModelQuery(event.target.value)}
        />
        <Typography.Text className="hf-search-hint">
          {t("searchHintRanking")}
        </Typography.Text>
      </div>

      <div className="hf-quick-filters">
        <Typography.Text strong>{t("quickFilters")}</Typography.Text>
        {quickFilters.map((filter) => (
          <Button
            key={filter.key}
            size="small"
            className={selectedQuickFilter === filter.key ? "active" : ""}
            onClick={() => setSelectedSecondaries(new Set(filter.ids))}
          >
            {filter.label}
            <span>{filter.ids.length}</span>
          </Button>
        ))}
      </div>

      <main className="benchmark-table-pane">
        <div className="benchmark-fieldbar">
          <div />
          <Space size={8} wrap>
            <Popover
              content={selectorContent}
              trigger="click"
              open={selectorOpen}
              onOpenChange={setSelectorOpen}
              placement="bottomRight"
              overlayClassName="benchmark-tree-popover"
            >
              <Button className="table-option-button" type="text" icon={<FilterOutlined />}>
                {t("advancedFilters")}
              </Button>
            </Popover>
            <Popover
              content={columnContent}
              trigger="click"
              open={columnOpen}
              onOpenChange={setColumnOpen}
              placement="bottomRight"
            >
              <Button className="table-option-button" type="text">
                {t("columnVisibility")}
              </Button>
            </Popover>
          </Space>
        </div>

        <Table<RankedScoreTableRow>
          className="benchmark-table"
          rowKey={(row) => `${row.provider}-${row.model}`}
          columns={columns}
          dataSource={filteredRows}
          scroll={scrollX ? { x: scrollX } : undefined}
          pagination={false}
          size="small"
          bordered={false}
          tableLayout={shouldScroll ? "auto" : "fixed"}
        />
      </main>
    </section>
  );
};
