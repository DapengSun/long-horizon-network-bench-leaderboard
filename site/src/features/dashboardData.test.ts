import { describe, expect, it } from "vitest";
import {
  buildScoreTableRows,
  buildRadarSeries,
  categoryMatchesQuery,
  dashboardRowMatchesQuery,
  getScoreFillStyle,
  getScoreTone,
  shouldScrollScoreTable,
} from "./dashboardData";
import mockData from "../data/networkDashboardMock.json";
import type { DashboardBenchmarkData } from "./dashboardData";

const fixture: DashboardBenchmarkData = {
  benchmarks: [
    {
      id: "ltnp",
      primary: "network-planning",
      secondary: "LTNP",
      title: "園區/機房網絡規劃-LTNP",
      tests: 57,
      rows: [
        {
          provider: "Twinkle AI",
          model: "planner-a",
          url: "https://example.com/a",
          average: 0.8,
        },
        {
          provider: "Meta",
          model: "planner-b",
          average: 0.6,
        },
      ],
    },
    {
      id: "ltcc",
      primary: "performance-tuning",
      secondary: "LTCC",
      title: "交換機/端側聯合調優-LTCC",
      tests: 25,
      rows: [
        {
          provider: "NVIDIA",
          model: "tuner-a",
          average: 0.4,
        },
      ],
    },
  ],
};

describe("dashboardData", () => {
  it("pivots selected secondary menus into score columns per provider and model", () => {
    const pivotFixture: DashboardBenchmarkData = {
      benchmarks: [
        {
          id: "ltnp",
          primary: "network-planning",
          secondary: "LTNP",
          title: "園區/機房網絡規劃-LTNP",
          tests: 57,
          rows: [
            {
              provider: "Twinkle AI",
              model: "net-agent",
              average: 0.8,
            },
          ],
        },
        {
          id: "ltrp",
          primary: "network-planning",
          secondary: "LTRP",
          title: "可達性/IP/路由規劃-LTRP",
          tests: 49,
          rows: [
            {
              provider: "Twinkle AI",
              model: "net-agent",
              average: 0.6,
            },
          ],
        },
      ],
    };

    const rows = buildScoreTableRows(pivotFixture, new Set(["LTNP", "LTRP"]));

    expect(rows).toHaveLength(1);
    expect(rows[0].scores).toEqual({ LTNP: 0.8, LTRP: 0.6 });
    expect(rows[0].average).toBe(0.7);
  });

  it("keeps the mock model roster identical across every secondary benchmark", () => {
    const data = mockData as DashboardBenchmarkData;
    const [first, ...rest] = data.benchmarks;
    const roster = first.rows
      .map((row) => `${row.provider}::${row.model}`)
      .sort();

    expect(first.rows).toHaveLength(8);
    expect(first.rows[0].model).toBe("GLM-5.1");

    for (const benchmark of rest) {
      expect(
        benchmark.rows.map((row) => `${row.provider}::${row.model}`).sort()
      ).toEqual(roster);
    }
  });

  it("ranks GLM-5.1 first when pivoting selected benchmarks", () => {
    const data = mockData as DashboardBenchmarkData;
    const rows = buildScoreTableRows(data, new Set(["LTNP", "LTCC"]));

    expect(rows[0].model).toBe("GLM-5.1");
    expect(rows).toHaveLength(8);
  });

  it("maps low scores to yellow and high scores to green", () => {
    expect(getScoreTone(0.35)).toBe("yellow");
    expect(getScoreTone(0.68)).toBe("lime");
    expect(getScoreTone(0.86)).toBe("green");
  });

  it("builds score fill style from score value", () => {
    expect(getScoreFillStyle(0.9037)).toMatchObject({
      width: "90%",
      textColor: "#1b5e20",
    });
    expect(getScoreFillStyle(0.6501)).toMatchObject({
      width: "65%",
      textColor: "#2f6f3e",
    });
    expect(getScoreFillStyle(0.45)).toMatchObject({
      width: "45%",
      textColor: "#d48806",
    });
  });

  it("only enables horizontal table scroll when selected score columns are many", () => {
    expect(shouldScrollScoreTable(4)).toBe(false);
    expect(shouldScrollScoreTable(5)).toBe(true);
  });

  it("matches category tree by parent label or child id", () => {
    const children = [
      { id: "LTCC", label: "交换机/端侧联合调优-LTCC" },
      { id: "LTLB", label: "负载均衡配置与 RDMA 分流-LTLB" },
    ];

    expect(categoryMatchesQuery("性能调优", children, "性能")).toBe(true);
    expect(categoryMatchesQuery("性能调优", children, "ltlb")).toBe(true);
    expect(categoryMatchesQuery("性能调优", children, "故障")).toBe(false);
  });

  it("matches dashboard rows by any space-separated model name term", () => {
    const rows = buildScoreTableRows(fixture, new Set(["LTNP"]));

    expect(rows.filter((row) => dashboardRowMatchesQuery(row, "planner tuner"))).toHaveLength(2);
    expect(dashboardRowMatchesQuery(rows[0], "Twinkle Meta")).toBe(false);
    expect(dashboardRowMatchesQuery(rows[0], "missing absent")).toBe(false);
  });

  it("builds radar axes and filters model series by query", () => {
    const radar = buildRadarSeries(fixture, new Set(["LTNP", "LTCC"]), "planner");

    expect(radar.axes.map((axis) => axis.id)).toEqual(["LTNP", "LTCC"]);
    expect(radar.series.map((series) => series.model)).toEqual([
      "planner-a",
      "planner-b",
    ]);
    expect(radar.series[0].values).toEqual([
      { axisId: "LTNP", score: 0.8 },
      { axisId: "LTCC", score: 0 },
    ]);
  });
});
