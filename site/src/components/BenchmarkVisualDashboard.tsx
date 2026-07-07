import React, { useMemo, useState } from "react";
import { Button, Empty, Input, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { getDashboardData } from "../data/leaderboardDataSource";
import {
  buildRadarSeries,
  type DashboardBenchmarkData,
  type PrimaryCategoryId,
} from "../features/dashboardData";
import { useLocale } from "../i18n/LocaleContext";
import type { MessageKey } from "../i18n/messages";

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

const RADAR_COLORS = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#17becf",
];

function formatScore(score: number): string {
  return score.toFixed(4);
}

function pointForAxis(
  index: number,
  total: number,
  score: number,
  radius: number,
  center: number
): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / total;
  const scaledRadius = Math.max(0, Math.min(1, score)) * radius;
  return {
    x: center + Math.cos(angle) * scaledRadius,
    y: center + Math.sin(angle) * scaledRadius,
  };
}

function polygonPoints(
  scores: number[],
  radius: number,
  center: number
): string {
  return scores
    .map((score, index) => {
      const point = pointForAxis(index, scores.length, score, radius, center);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

export const BenchmarkVisualDashboard: React.FC = () => {
  const { t } = useLocale();
  const allSecondaryIds = useMemo(
    () =>
      PRIMARY_CATEGORIES.flatMap((category) =>
        category.children.map((child) => child.id)
      ),
    []
  );
  const [selectedSecondaries, setSelectedSecondaries] = useState<Set<string>>(
    () => new Set(allSecondaryIds)
  );
  const [modelQuery, setModelQuery] = useState("");

  const radarData = useMemo(
    () => buildRadarSeries(data, selectedSecondaries, modelQuery),
    [modelQuery, selectedSecondaries]
  );
  const unfilteredRadarData = useMemo(
    () => buildRadarSeries(data, selectedSecondaries, ""),
    [selectedSecondaries]
  );
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

  const center = 300;
  const radius = 218;
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];
  const hasRadarData = radarData.axes.length > 2 && radarData.series.length > 0;

  return (
    <section className="visual-dashboard">
      <div className="hf-search-wrap visual-search-wrap">
        <Input
          allowClear
          className="hf-search"
          prefix={<SearchOutlined />}
          placeholder={t("searchPlaceholder")}
          suffix={
            <span className="hf-search-count">
              {radarData.series.length} / {unfilteredRadarData.series.length}
            </span>
          }
          value={modelQuery}
          onChange={(event) => setModelQuery(event.target.value)}
        />
        <Typography.Text className="hf-search-hint">
          {t("searchHintDashboard")}
        </Typography.Text>
      </div>

      <div className="hf-quick-filters visual-quick-filters">
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

      <div className="radar-panel">
        <div className="radar-card">
          {hasRadarData ? (
            <svg className="radar-chart" viewBox="0 0 600 600" role="img">
              <title>Long-Horizon-Network-Bench radar chart</title>
              {gridLevels.map((level) => (
                <polygon
                  key={level}
                  className="radar-grid"
                  points={polygonPoints(
                    Array(radarData.axes.length).fill(level),
                    radius,
                    center
                  )}
                />
              ))}
              {radarData.axes.map((axis, index) => {
                const end = pointForAxis(
                  index,
                  radarData.axes.length,
                  1,
                  radius,
                  center
                );
                const label = pointForAxis(
                  index,
                  radarData.axes.length,
                  1.14,
                  radius,
                  center
                );
                return (
                  <g key={axis.id}>
                    <line
                      className="radar-axis-line"
                      x1={center}
                      y1={center}
                      x2={end.x}
                      y2={end.y}
                    />
                    <text
                      className="radar-axis-label"
                      x={label.x}
                      y={label.y}
                      textAnchor={
                        Math.abs(label.x - center) < 12
                          ? "middle"
                          : label.x > center
                            ? "start"
                            : "end"
                      }
                    >
                      {axis.id}
                    </text>
                  </g>
                );
              })}
              {radarData.series.map((series, index) => {
                const color = RADAR_COLORS[index % RADAR_COLORS.length];
                const scores = series.values.map((value) => value.score);
                return (
                  <g key={`${series.provider}-${series.model}`}>
                    <polygon
                      className="radar-series-fill"
                      points={polygonPoints(scores, radius, center)}
                      style={{ fill: color }}
                    />
                    <polygon
                      className="radar-series-line"
                      points={polygonPoints(scores, radius, center)}
                      style={{ stroke: color }}
                    />
                  </g>
                );
              })}
            </svg>
          ) : (
            <Empty description={t("noMatchingModels")} />
          )}
        </div>

        <aside className="radar-legend">
          <div className="radar-legend-header">
            <Typography.Text strong>{t("modelLegend")}</Typography.Text>
            <Typography.Text type="secondary">
              {radarData.series.length} {t("modelCount")}
            </Typography.Text>
          </div>
          <div className="radar-legend-list">
            {radarData.series.map((series, index) => {
              const color = RADAR_COLORS[index % RADAR_COLORS.length];
              return (
                <div key={`${series.provider}-${series.model}`} className="radar-legend-item">
                  <span className="radar-legend-dot" style={{ background: color }} />
                  <span className="radar-legend-name">{series.model}</span>
                  <strong>{formatScore(series.average)}</strong>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
};
