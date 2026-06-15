export type PrimaryCategoryId =
  | "network-planning"
  | "performance-tuning"
  | "ops";

export type ScoreTone = "yellow" | "lime" | "green";

export interface DashboardBenchmarkRow {
  provider: string;
  model: string;
  url?: string;
  average: number;
  tags?: string[];
}

export interface DashboardScoreTableRow {
  provider: string;
  model: string;
  url?: string;
  tags?: string[];
  scores: Record<string, number>;
  average: number;
}

export interface DashboardBenchmark {
  id: string;
  primary: PrimaryCategoryId;
  secondary: string;
  title: string;
  tests: number;
  rows: DashboardBenchmarkRow[];
}

export interface DashboardBenchmarkData {
  benchmarks: DashboardBenchmark[];
}

export interface RadarAxis {
  id: string;
  title: string;
}

export interface RadarSeries {
  provider: string;
  model: string;
  average: number;
  values: Array<{ axisId: string; score: number }>;
}

export interface RadarData {
  axes: RadarAxis[];
  series: RadarSeries[];
}

export function shouldScrollScoreTable(selectedSecondaryCount: number): boolean {
  return selectedSecondaryCount > 4;
}

export function buildScoreTableRows(
  data: DashboardBenchmarkData,
  secondaries: Set<string>
): DashboardScoreTableRow[] {
  const grouped = new Map<string, DashboardScoreTableRow>();

  for (const benchmark of data.benchmarks) {
    if (!secondaries.has(benchmark.secondary)) continue;

    for (const row of benchmark.rows) {
      const key = `${row.provider}::${row.model}`;
      const current =
        grouped.get(key) ??
        ({
          provider: row.provider,
          model: row.model,
          url: row.url,
          tags: row.tags,
          scores: {},
          average: 0,
        } satisfies DashboardScoreTableRow);

      current.scores[benchmark.secondary] = row.average;
      current.url = current.url ?? row.url;
      current.tags = current.tags ?? row.tags;
      grouped.set(key, current);
    }
  }

  return [...grouped.values()]
    .map((row) => {
      const values = Object.values(row.scores);
      const average =
        values.length === 0
          ? 0
          : values.reduce((sum, value) => sum + value, 0) / values.length;
      return {
        ...row,
        average: Number(average.toFixed(4)),
      };
    })
    .sort((a, b) => b.average - a.average);
}

export function getScoreTone(score: number): ScoreTone {
  if (score >= 0.8) return "green";
  if (score >= 0.6) return "lime";
  return "yellow";
}

export function getScoreFillStyle(score: number): {
  width: string;
  color: string;
  textColor: string;
} {
  const clamped = Math.max(0, Math.min(1, score));
  const tone = getScoreTone(score);
  if (tone === "green") {
    return {
      width: `${Math.round(clamped * 100)}%`,
      color: "#c8e6c9",
      textColor: "#1b5e20",
    };
  }
  if (tone === "lime") {
    return {
      width: `${Math.round(clamped * 100)}%`,
      color: "#e7f4c2",
      textColor: "#2f6f3e",
    };
  }
  return {
    width: `${Math.round(clamped * 100)}%`,
    color: "#fff4b8",
    textColor: "#d48806",
  };
}

export function categoryMatchesQuery(
  label: string,
  children: Array<{ id: string; label: string }>,
  query: string
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    label.toLowerCase().includes(normalized) ||
    children.some(
      (child) =>
        child.id.toLowerCase().includes(normalized) ||
        child.label.toLowerCase().includes(normalized)
    )
  );
}

export function dashboardRowMatchesQuery(
  row: DashboardScoreTableRow,
  query: string
): boolean {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return true;

  const searchableText = row.model.toLowerCase();

  return terms.some((term) => searchableText.includes(term));
}

export function buildRadarSeries(
  data: DashboardBenchmarkData,
  secondaries: Set<string>,
  query: string
): RadarData {
  const axes = data.benchmarks
    .filter((benchmark) => secondaries.has(benchmark.secondary))
    .map((benchmark) => ({
      id: benchmark.secondary,
      title: benchmark.title,
    }));
  const rows = buildScoreTableRows(data, secondaries).filter((row) =>
    dashboardRowMatchesQuery(row, query)
  );

  return {
    axes,
    series: rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      average: row.average,
      values: axes.map((axis) => ({
        axisId: axis.id,
        score: row.scores[axis.id] ?? 0,
      })),
    })),
  };
}
