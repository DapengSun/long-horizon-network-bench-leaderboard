import React, { useMemo, useState } from "react";
import {
  findBestDetailPoint,
  formatImprovementPct,
  formatScoreWithUnit,
  improvementVsBaselinePct,
  parseRoundIndex,
} from "../features/caseDetailChart";
import { useLocale } from "../i18n/LocaleContext";
import type { CaseDetailChartPayload } from "../types";

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
  improvementPct: number;
  x: number;
  y: number;
  color: string;
  isBest: boolean;
}

interface CaseLatencyChartProps {
  payload: CaseDetailChartPayload;
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
      const bestPoint = findBestDetailPoint(sortedDetail, metric.direction);
      const points: PlotPoint[] = sortedDetail.map((point) => {
        const roundIndex = parseRoundIndex(point.round);
        const improvementPct = improvementVsBaselinePct(
          baselineScore,
          point.score,
          metric.direction
        );
        return {
          model: result.model,
          round: point.round,
          roundIndex,
          score: point.score,
          improvementPct,
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

    const improvements = series.flatMap((item) =>
      item.points.map((point) => point.improvementPct)
    );
    const minImprovement = Math.min(0, ...improvements);
    const maxImprovement = Math.max(0, ...improvements);
    const padding =
      (maxImprovement - minImprovement || Math.abs(maxImprovement) || 1) * 0.12;
    const yMin = minImprovement - padding;
    const yMax = maxImprovement + padding;
    const xStep =
      roundIndexes.length > 1 ? innerWidth / (roundIndexes.length - 1) : 0;

    const xForRound = (roundIndex: number) => {
      const position = roundIndexes.indexOf(roundIndex);
      return MARGIN.left + position * xStep;
    };

    const yForImprovement = (value: number) => {
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
        y: yForImprovement(point.improvementPct),
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
      return yForImprovement(0);
    }

    return {
      roundIndexes,
      yTicks: buildTicks(yMin, yMax),
      yForImprovement,
      xForRound,
      series: plottedSeries,
      innerWidth,
      innerHeight,
      baselineY: plotBaselineY(),
    };
  }, [metric.direction, payload]);

  const metricMeta = metric.unit
    ? `${metric.label} (${metric.unit})`
    : metric.label;
  const summary = useMemo(() => {
    const allPoints = plot.series.flatMap((series) => series.points);
    const bestPoint = allPoints.reduce<PlotPoint | null>((best, point) => {
      if (!best) {
        return point;
      }
      return point.improvementPct > best.improvementPct ? point : best;
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
          <strong>{t("detailImprovementAxis")}</strong>
        </div>
        <div className="case-latency-chart-meta-card">
          <span>{t("detailChartRawMetric")}</span>
          <strong>{metricMeta}</strong>
        </div>
        {summary.bestPoint ? (
          <div className="case-latency-chart-meta-card accent">
            <span>{t("detailLatencyBestRound")}</span>
            <strong>{formatImprovementPct(summary.bestPoint.improvementPct)}</strong>
          </div>
        ) : null}
      </div>

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
          const y = plot.yForImprovement(tick);
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
                {formatImprovementPct(tick)}
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
          {t("detailImprovementAxis")}
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
        <div className="case-latency-chart-tooltip">
          <strong>{hoveredPoint.model}</strong>
          <span>
            {hoveredPoint.round}: {formatImprovementPct(hoveredPoint.improvementPct)}
          </span>
          <span>
            {t("detailChartRawMetric")}:{" "}
            {formatScoreWithUnit(hoveredPoint.score, metric.unit)}
          </span>
          {hoveredPoint.isBest ? <span>{t("detailLatencyBestRound")}</span> : null}
        </div>
      )}

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
              {formatImprovementPct(summary.latestPoint.improvementPct)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
