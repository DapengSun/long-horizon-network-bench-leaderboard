import React, { useMemo, useState } from "react";
import { Tooltip } from "antd";
import {
  chartValueForDetailPoint,
  findBestDetailPoint,
  formatNormalizedScore,
  formatScoreWithUnit,
  parseRoundIndex,
} from "../features/caseDetailChart";
import { useLocale } from "../i18n/LocaleContext";
import type {
  CaseDetailChartModelResult,
  CaseDetailChartPayload,
  EvaluationCaseDetailPoint,
} from "../types";

const SERIES_COLORS = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#17becf",
];

const CHART_WIDTH = 720;
const CHART_HEIGHT = 360;
const MARGIN = { top: 28, right: 24, bottom: 52, left: 76 };

interface PlotPoint {
  model: string;
  round: string;
  roundIndex: number;
  score: number;
  bestLatencyUs?: number;
  baselineLatencyUs?: number;
  chartScore: number;
  x: number;
  y: number;
  color: string;
  isBest: boolean;
}

interface CaseLatencyChartProps {
  payload: CaseDetailChartPayload;
}

function metricNumber(
  point: EvaluationCaseDetailPoint,
  key: string
): number | undefined {
  const value = point.metrics?.[key];
  return typeof value === "number" ? value : undefined;
}

function formatScore(score: number): string {
  return score.toFixed(4);
}

function formatLatencyUs(value: number | undefined): string {
  return value === undefined ? "-" : String(Number(value.toFixed(6)));
}

function ltcoFormula(point: EvaluationCaseDetailPoint): string {
  const bestLatency = metricNumber(point, "best_latency_us");
  const baselineLatency = metricNumber(point, "baseline_latency_us");
  if (bestLatency === undefined || baselineLatency === undefined) {
    return "max(0, 1 - best_latency_us / baseline_latency_us)";
  }
  return `max(0, 1 - ${bestLatency} / ${baselineLatency})`;
}

function LtcoRoundTable({
  result,
}: {
  result: CaseDetailChartModelResult;
}) {
  const bestRound =
    result.bestRound ?? findBestDetailPoint(result.detail, "higher_is_better")?.round;

  return (
    <div className="ltco-round-detail">
      <div className="multiphase-round-table-wrap ltco-round-table-wrap">
        <table className="multiphase-round-table ltco-round-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>Score</th>
              <th>Best latency (us)</th>
              <th>Baseline latency (us)</th>
              <th>
                <Tooltip title="Score formula: max(0, 1 - best_latency_us / baseline_latency_us).">
                  <span className="multiphase-column-help">Formula</span>
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.detail.map((point) => {
              const isBest = point.round === bestRound;
              const bestLatency = metricNumber(point, "best_latency_us");
              const baselineLatency = metricNumber(point, "baseline_latency_us");
              return (
                <tr key={point.round}>
                  <td>
                    <span className="multiphase-round-name">
                      {point.round}
                      {isBest ? (
                        <Tooltip title="Best round: the round with the highest normalized latency improvement for this LTCO task.">
                          <span
                            className="multiphase-selected-star"
                            aria-label="Best round"
                          >
                            ⭐
                          </span>
                        </Tooltip>
                      ) : null}
                    </span>
                  </td>
                  <td>{formatScore(point.score)}</td>
                  <td>{formatLatencyUs(bestLatency)}</td>
                  <td>{formatLatencyUs(baselineLatency)}</td>
                  <td>
                    <code>{ltcoFormula(point)}</code>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildTicks(min: number, max: number, count = 5): number[] {
  if (min === max) {
    return [min];
  }

  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
}

export const CaseLatencyChart: React.FC<CaseLatencyChartProps> = ({ payload }) => {
  const { t } = useLocale();
  const [hoveredPoint, setHoveredPoint] = useState<PlotPoint | null>(null);
  const { metric } = payload;
  const isLtco = payload.category === "LTCO";

  const plot = useMemo(() => {
    const innerWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
    const roundIndexes = Array.from(
      new Set(
        payload.results.flatMap((series) =>
          series.detail.map((point) => parseRoundIndex(point.round))
        )
      )
    ).sort((a, b) => a - b);

    const series = payload.results.map((result, index) => {
      const color = SERIES_COLORS[index % SERIES_COLORS.length];
      const sortedDetail = result.detail;
      const baselineScore = sortedDetail[0]?.score ?? 0;
      const bestPoint =
        isLtco && result.bestRound
          ? sortedDetail.find((point) => point.round === result.bestRound)
          : findBestDetailPoint(sortedDetail, metric.direction);
      const points: PlotPoint[] = sortedDetail.map((point) => {
        const roundIndex = parseRoundIndex(point.round);
        const chartScore = chartValueForDetailPoint({
          currentScore: point.score,
        });
        return {
          model: result.model,
          round: point.round,
          roundIndex,
          score: point.score,
          bestLatencyUs: metricNumber(point, "best_latency_us"),
          baselineLatencyUs: metricNumber(point, "baseline_latency_us"),
          chartScore,
          x: 0,
          y: 0,
          color,
          isBest: bestPoint?.round === point.round,
        };
      });

      return {
        model: result.model,
        color,
        baselineScore,
        points,
        linePath: "",
      };
    });

    const chartScores = series.flatMap((item) =>
      item.points.map((point) => point.chartScore)
    );
    const minScore = Math.min(0, ...chartScores);
    const maxScore = Math.max(1, ...chartScores);
    const padding = (maxScore - minScore || 1) * 0.12;
    const yMin = Math.max(0, minScore - padding);
    const yMax = Math.min(1, maxScore + padding);
    const xStep =
      roundIndexes.length > 1 ? innerWidth / (roundIndexes.length - 1) : 0;

    const xForRound = (roundIndex: number) => {
      const position = roundIndexes.indexOf(roundIndex);
      return MARGIN.left + position * xStep;
    };

    const yForScore = (value: number) => {
      if (yMax === yMin) {
        return MARGIN.top + innerHeight / 2;
      }
      const ratio = (value - yMin) / (yMax - yMin);
      return MARGIN.top + innerHeight - ratio * innerHeight;
    };

    const plottedSeries = series.map((item) => {
      const points = item.points.map((point) => ({
        ...point,
        x: xForRound(point.roundIndex),
        y: yForScore(point.chartScore),
      }));

      return {
        ...item,
        points,
        linePath: points
          .map((point, pointIndex) =>
            `${pointIndex === 0 ? "M" : "L"} ${point.x} ${point.y}`
          )
          .join(" "),
        areaPath:
          points.length > 0
            ? [
                `M ${points[0].x} ${plotBaselineY()}`,
                ...points.map((point) => `L ${point.x} ${point.y}`),
                `L ${points[points.length - 1].x} ${plotBaselineY()}`,
                "Z",
              ].join(" ")
            : "",
      };
    });

    function plotBaselineY(): number {
      return yForScore(0);
    }

    return {
      roundIndexes,
      yTicks: buildTicks(yMin, yMax),
      yForScore,
      xForRound,
      series: plottedSeries,
      innerWidth,
      innerHeight,
      baselineY: plotBaselineY(),
    };
  }, [isLtco, metric.direction, payload]);

  const metricMeta = metric.unit
    ? `${metric.label} (${metric.unit})`
    : metric.label;
  const summary = useMemo(() => {
    const allPoints = plot.series.flatMap((series) => series.points);
    const bestPoint = allPoints.reduce<PlotPoint | null>((best, point) => {
      if (!best) {
        return point;
      }
      return point.chartScore > best.chartScore ? point : best;
    }, null);
    const latestPoint = allPoints.reduce<PlotPoint | null>((latest, point) => {
      if (!latest) {
        return point;
      }
      return point.roundIndex > latest.roundIndex ? point : latest;
    }, null);

    return { bestPoint, latestPoint };
  }, [plot.series]);

  return (
    <div className="case-latency-chart">
      <div className="case-latency-chart-meta">
        <div className="case-latency-chart-meta-card">
          <span>{t("detailChartPlotMetric")}</span>
          <strong>{t("detailScoreAxis")}</strong>
        </div>
        <div className="case-latency-chart-meta-card">
          <span>{t("detailChartRawMetric")}</span>
          <strong>{metricMeta}</strong>
        </div>
        {summary.bestPoint ? (
          <div className="case-latency-chart-meta-card accent">
            <span>{t("detailLatencyBestRound")}</span>
            <strong>{formatNormalizedScore(summary.bestPoint.chartScore)}</strong>
          </div>
        ) : null}
      </div>

      <div className="case-latency-chart-plot">
        <svg
          className="case-latency-chart-svg"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label={t("detailLatencyChartAria")}
        >
        <defs>
          {plot.series.map((series, index) => (
            <React.Fragment key={series.model}>
              <linearGradient
                id={`series-line-${index}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor={series.color} stopOpacity="0.78" />
                <stop offset="100%" stopColor="#0f766e" stopOpacity="0.98" />
              </linearGradient>
              <linearGradient
                id={`series-area-${index}`}
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor={series.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={series.color} stopOpacity="0.02" />
              </linearGradient>
            </React.Fragment>
          ))}
          <filter id="chart-line-shadow" x="-10%" y="-20%" width="120%" height="140%">
            <feDropShadow
              dx="0"
              dy="6"
              stdDeviation="4"
              floodColor="#0f172a"
              floodOpacity="0.14"
            />
          </filter>
        </defs>
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={plot.innerWidth}
          height={plot.innerHeight}
          rx="18"
          className="case-latency-chart-plot-bg"
        />
        <line
          x1={MARGIN.left}
          y1={MARGIN.top + plot.innerHeight}
          x2={MARGIN.left + plot.innerWidth}
          y2={MARGIN.top + plot.innerHeight}
          className="case-latency-chart-axis"
        />
        <line
          x1={MARGIN.left}
          y1={MARGIN.top}
          x2={MARGIN.left}
          y2={MARGIN.top + plot.innerHeight}
          className="case-latency-chart-axis"
        />

        {plot.yTicks.map((tick) => {
          const y = plot.yForScore(tick);
          return (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                y1={y}
                x2={MARGIN.left + plot.innerWidth}
                y2={y}
                className="case-latency-chart-grid"
              />
              <text x={MARGIN.left - 10} y={y + 4} className="case-latency-chart-tick">
                {formatNormalizedScore(tick)}
              </text>
            </g>
          );
        })}

        <line
          x1={MARGIN.left}
          y1={plot.baselineY}
          x2={MARGIN.left + plot.innerWidth}
          y2={plot.baselineY}
          className="case-latency-chart-baseline"
        />
        <text
          x={MARGIN.left + plot.innerWidth - 4}
          y={plot.baselineY - 6}
          className="case-latency-chart-baseline-label"
        >
          {t("detailChartBaselineLabel")}
        </text>

        {plot.roundIndexes.map((roundIndex) => {
          const x = plot.xForRound(roundIndex);
          return (
            <text
              key={roundIndex}
              x={x}
              y={MARGIN.top + plot.innerHeight + 28}
              className="case-latency-chart-tick case-latency-chart-tick-x"
            >
              r{roundIndex}
            </text>
          );
        })}

        <text
          x={18}
          y={MARGIN.top + plot.innerHeight / 2}
          className="case-latency-chart-axis-label"
          transform={`rotate(-90 18 ${MARGIN.top + plot.innerHeight / 2})`}
        >
          {t("detailScoreAxis")}
        </text>
        <text
          x={MARGIN.left + plot.innerWidth / 2}
          y={CHART_HEIGHT - 8}
          className="case-latency-chart-axis-label"
        >
          {t("detailRoundAxis")}
        </text>

        {plot.series.map((series, seriesIndex) => (
          <g key={series.model}>
            <path
              className="case-latency-chart-area"
              d={series.areaPath}
              fill={`url(#series-area-${seriesIndex})`}
            />
            <path
              className="case-latency-chart-line"
              d={series.linePath}
              fill="none"
              stroke={`url(#series-line-${seriesIndex})`}
              strokeWidth={3.2}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
              filter="url(#chart-line-shadow)"
              style={{ animationDelay: `${seriesIndex * 120}ms` }}
            />
            {series.points.map((point) => {
              const pointKey = `${series.model}-${point.round}`;
              return (
                <g
                  key={pointKey}
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  {point.isBest ? (
                    <circle
                      className="case-latency-chart-point-best-ring"
                      cx={point.x}
                      cy={point.y}
                      r={10}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                    />
                  ) : null}
                  <circle
                    className={
                      point.isBest
                        ? "case-latency-chart-point case-latency-chart-point-best"
                        : "case-latency-chart-point"
                    }
                    cx={point.x}
                    cy={point.y}
                    r={point.isBest ? 5.5 : 4.2}
                    fill={point.isBest ? "#fff" : series.color}
                    stroke={series.color}
                    strokeWidth={point.isBest ? 2.5 : 2}
                  />
                </g>
              );
            })}
          </g>
        ))}
        </svg>

        {hoveredPoint && (
          <div
            className={[
              "case-latency-chart-tooltip",
              hoveredPoint.x < MARGIN.left + 90 ? "align-left" : "",
              hoveredPoint.x > CHART_WIDTH - MARGIN.right - 90 ? "align-right" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: `${(hoveredPoint.x / CHART_WIDTH) * 100}%`,
              top: `${(hoveredPoint.y / CHART_HEIGHT) * 100}%`,
            }}
          >
            <strong>{hoveredPoint.model}</strong>
            <span>
              {hoveredPoint.round}: {formatNormalizedScore(hoveredPoint.chartScore)}
            </span>
            <span>
              {t("detailChartRawMetric")}:{" "}
              {formatScoreWithUnit(hoveredPoint.score, metric.unit)}
            </span>
            {isLtco ? (
              <>
                <span>
                  best_latency_us: {formatLatencyUs(hoveredPoint.bestLatencyUs)} us
                </span>
                <span>
                  baseline_latency_us: {formatLatencyUs(hoveredPoint.baselineLatencyUs)} us
                </span>
              </>
            ) : null}
            {hoveredPoint.isBest ? <span>{t("detailLatencyBestRound")}</span> : null}
          </div>
        )}
      </div>

      <div className="case-latency-chart-legend">
        {plot.series.map((series) => (
          <div key={series.model} className="case-latency-chart-legend-item">
            <span style={{ backgroundColor: series.color }} />
            <span>{series.model}</span>
          </div>
        ))}
        {summary.latestPoint ? (
          <div className="case-latency-chart-legend-item muted">
            <span />
            <span>
              {t("detailChartLatestRound")} {summary.latestPoint.round}:{" "}
              {formatNormalizedScore(summary.latestPoint.chartScore)}
            </span>
          </div>
        ) : null}
      </div>

      {isLtco
        ? payload.results.map((result) => (
            <LtcoRoundTable key={result.model} result={result} />
          ))
        : null}
    </div>
  );
};
