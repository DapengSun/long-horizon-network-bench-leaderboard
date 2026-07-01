import { access, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, "..");
const dataDir = path.join(siteRoot, "src/data");
const defaultSkillsDir = path.resolve(
  siteRoot,
  "../../..",
  "long-horizon-network-bench-skills/skills"
);

const skillsDir = process.env.LHNB_SKILLS_DIR
  ? path.resolve(process.env.LHNB_SKILLS_DIR)
  : defaultSkillsDir;

const CATEGORY_META = {
  LTNP: {
    primary: "network-planning",
    title: "园区/机房网络规划-LTNP",
  },
  LTRP: {
    primary: "network-planning",
    title: "可达性/IP/路由规划-LTRP",
  },
  LTCG: {
    primary: "network-planning",
    title: "网络配置生成-LTCG",
  },
  LTCC: {
    primary: "performance-tuning",
    title: "交换机/端侧联合调优-LTCC",
  },
  LTLB: {
    primary: "performance-tuning",
    title: "负载均衡配置与 RDMA 分流-LTLB",
  },
  LTCO: {
    primary: "performance-tuning",
    title: "集合通信优化-LTCO",
  },
  LTHOps: {
    primary: "ops",
    title: "计算类故障定位与修复-LTHOps",
  },
  LTMixOps: {
    primary: "ops",
    title: "混合故障定位与修复-LTMixOps",
  },
  LTNOps: {
    primary: "ops",
    title: "机间网络故障定位与修复-LTNOps",
  },
  LTSOps: {
    primary: "ops",
    title: "存储类故障定位与修复-LTSOps",
  },
};

const CATEGORY_ORDER = Object.keys(CATEGORY_META);

function titleFromTaskId(taskId) {
  return taskId
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function scoreForIndex(index) {
  return Number((0.58 + ((index * 17) % 37) / 100).toFixed(4));
}

function roundsForScore(score, index) {
  const start = Math.max(0.2, score - 0.28 - (index % 4) * 0.025);
  const middle1 = start + (score - start) * 0.38;
  const middle2 = start + (score - start) * 0.68;
  const middle3 = start + (score - start) * 0.9;
  return [start, middle1, middle2, middle3, score].map((roundScore, roundIndex) => ({
    round: `round${roundIndex}`,
    score: Number(roundScore.toFixed(4)),
    metrics: {},
  }));
}

const PUBLIC_SCENARIOS = {
  "ltcc-highbdp-v4": [
    "highbdp_075_nominal",
    "highbdp_055_tight",
    "highbdp_100_elephant",
  ],
  "ltcc-incast-v4": ["incast_16", "incast_32", "incast_64"],
  "ltcc-lat-mouse-v4": [
    "lat_mouse_16_sync",
    "lat_mouse_16_mixed",
    "lat_mouse_32_dense",
  ],
  "ltcc-link-perturb-v4": [
    "public_base_16",
    "public_offset_16",
    "public_heavy_16",
  ],
  "ltcc-m2m-mixed-v4": [
    "m2m_base",
    "m2m_elephant_heavy",
    "m2m_mouse_heavy",
    "m2m_hotspot_order",
  ],
  "ltcc-tandem-db-v4": [
    "tandem_16_nominal",
    "tandem_16_shifted",
    "tandem_16_mixed",
  ],
  "ltlb-heavytail-ecmp-v4": [
    "public_load50_x12_base",
    "public_load60_x12_tight",
    "public_load70_x12_pressure",
  ],
  "ltlb-elephant-interfere-v4": [
    "public_r25_x2_base",
    "public_r20_x2_shifted",
    "public_r35_x2_tight",
  ],
  "ltlb-flowlet-timeout-v4": [
    "public_load50_base",
    "public_load50_shifted",
    "public_load60_tight",
  ],
  "ltlb-rdma-reorder-v4": [
    "public_load50_x7_base",
    "public_load50_x7_shifted",
    "public_load60_x7_tight",
  ],
  "ltlb-voq-path-lb-v4": [
    "public_load50_base",
    "public_load55_seed2",
    "public_load60_tight",
    "public_load70_pressure",
  ],
};

function publicScenariosForTask(task) {
  return PUBLIC_SCENARIOS[task.id] ?? [`${task.id}_base`, `${task.id}_stress`];
}

function scenarioMetrics(task, scenarioIndex, roundIndex) {
  const throughput = Number((6.2 + roundIndex * 0.34 - scenarioIndex * 0.18).toFixed(3));
  const p99 = Number((860 - roundIndex * 72 + scenarioIndex * 46).toFixed(1));
  const pfc = Math.max(0, scenarioIndex * 2 - roundIndex);
  if (task.benchmark === "LTCC") {
    return {
      throughput_mean_gbps: throughput,
      p99_fct_us: p99,
      pfc_event_count: pfc,
      qlen_peak_cells: 1200 + scenarioIndex * 310 + roundIndex * 85,
    };
  }
  return {
    throughput_mean_gbps: throughput,
    p99_fct_us: p99,
    pfc_event_count: pfc,
    cnp_event_count: 1800 + scenarioIndex * 420 + roundIndex * 140,
    uplink_imbalance_cv: Number((0.62 + scenarioIndex * 0.18 - roundIndex * 0.05).toFixed(3)),
    voq_occupancy_peak_bytes: 56000 + scenarioIndex * 9000 + roundIndex * 2200,
  };
}

function phaseRoundsForTask(task, score, index) {
  const scenarios = publicScenariosForTask(task);
  const phase1Scores = [0.18, 0.36, 0.52].map((base, roundOffset) =>
    Number(Math.min(score + 0.08, base + (index % 5) * 0.018 + roundOffset * 0.05).toFixed(4))
  );
  const phase2Scores = [0.42, 0.54, score].map((base, roundOffset) =>
    Number(Math.min(0.98, Math.max(0, roundOffset === 2 ? score : base + (index % 4) * 0.02)).toFixed(4))
  );

  return [
    ...phase1Scores.map((roundScore, roundIndex) => ({
      round: `phase1/round${roundIndex + 1}`,
      phase: "phase1",
      roundIndex: roundIndex + 1,
      score: roundScore,
      scoreKind: "single_scenario",
      metrics: {
        raw_score_before_slo_gate: Number(Math.min(1, roundScore + 0.08).toFixed(4)),
        sloPass: roundIndex > 0,
        scenario: scenarios[0],
        sourceArtifact: `fake/${task.id}/artifacts/phase1/round${roundIndex + 1}/score.json`,
      },
    })),
    ...phase2Scores.map((roundScore, roundIndex) => {
      const roundNumber = roundIndex + 1;
      const perScenario = scenarios.map((scenario, scenarioIndex) => {
        const scenarioScore = Number(
          Math.max(0, roundScore - scenarioIndex * 0.07 + roundIndex * 0.025).toFixed(4)
        );
        const sloPass = !(roundIndex === 0 && scenarioIndex === scenarios.length - 1);
        return {
          scenario,
          suite: "public",
          score: sloPass ? scenarioScore : 0,
          rawScoreBeforeSloGate: scenarioScore,
          sloPass,
          metrics: scenarioMetrics(task, scenarioIndex, roundNumber),
          sloChecks: {
            p99_fct: {
              actual: scenarioMetrics(task, scenarioIndex, roundNumber).p99_fct_us,
              threshold: 900,
              pass: true,
            },
            pfc_count: {
              actual: scenarioMetrics(task, scenarioIndex, roundNumber).pfc_event_count,
              threshold: task.benchmark === "LTCC" ? 0 : 5000,
              pass: sloPass,
            },
          },
          components:
            task.benchmark === "LTCC"
              ? {
                  throughput_normalized: 0.82,
                  latency_normalized: 0.74,
                  pfc_normalized: sloPass ? 1 : 0,
                  queue_normalized: 0.66,
                }
              : {
                  balance_normalized: 0.78,
                  latency_normalized: 0.72,
                  throughput_normalized: 0.84,
                  pfc_normalized: 0.88,
                  cnp_safety_normalized: 0.7,
                },
        };
      });
      const publicScores = perScenario.map((scenario) => scenario.score);
      return {
        round: `phase2/round${roundNumber}`,
        phase: "phase2",
        roundIndex: roundNumber,
        score: roundScore,
        scoreKind: "public_suite",
        metrics: {
          phase2_public_score: roundScore,
          public_weighted_mean: Number((roundScore + 0.04).toFixed(4)),
          phase2_public_worst_scenario_score: Math.min(...publicScores),
          sloPass: perScenario.every((scenario) => scenario.sloPass),
          sourceArtifact: `fake/${task.id}/artifacts/phase2/round${roundNumber}/public_suite_score.json`,
        },
        scenarios: perScenario,
      };
    }),
  ];
}

function taskMetadata(category, taskId) {
  const parts = taskId.split("-");
  return {
    id: taskId,
    benchmark: category,
    title: titleFromTaskId(taskId),
    family: parts.slice(0, 2).join("-") || category,
    scenario: parts.slice(2, -1).join("-") || "default",
    scale: parts.at(-2) ?? "default",
    size: parts.at(-1) ?? "default",
  };
}

async function discoverTasks() {
  const tasks = [];

  for (const category of CATEGORY_ORDER) {
    const categoryDir = path.join(skillsDir, category);
    let entries = [];
    try {
      entries = await readdir(categoryDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      try {
        await access(path.join(categoryDir, entry.name, "SKILL.md"));
      } catch {
        continue;
      }
      tasks.push(taskMetadata(category, entry.name));
    }
  }

  return tasks.sort((a, b) =>
    `${a.benchmark}|${a.id}`.localeCompare(`${b.benchmark}|${b.id}`)
  );
}

function buildRawRun(tasks) {
  const results = {};

  tasks.forEach((task, index) => {
    const evaluatedAt = new Date(Date.UTC(2026, 5, 16, 1, 15 + index)).toISOString();
    const score = scoreForIndex(index);
    const rounds =
      task.benchmark === "LTCC" || task.benchmark === "LTLB"
        ? phaseRoundsForTask(task, score, index)
        : roundsForScore(score, index);
    results[task.id] = {
      benchmark: task.benchmark,
      status: "completed",
      score,
      nativeScore: score,
      metric: {
        name: "score",
        label: "Score",
        unit: "",
        direction: "higher_is_better",
        baseline: "first_round",
      },
      bestRound:
        task.benchmark === "LTCC" || task.benchmark === "LTLB"
          ? rounds
              .filter((round) => round.phase === "phase2")
              .reduce((best, round) => (round.score > best.score ? round : best)).round
          : rounds.at(-1).round,
      durationMinutes: Number((8 + (index % 9) * 1.7).toFixed(1)),
      evaluatedAt,
      rounds,
      source: {
        caseRunPath: path.join(
          "fake",
          "runs",
          `${task.benchmark}_${task.id}`
        ),
      },
    };
  });

  return {
    schemaVersion: 1,
    runId: "2026-06-16T091500+0800-opencode-deepseek-v4-pro",
    agent: "opencode",
    agentVersion: null,
    model: "DeepSeek-V4-Pro",
    provider: "DeepSeek",
    submittedAt: "2026-06-16T09:15:00+08:00",
    source: {
      type: "fake-seed",
      paths: [path.relative(siteRoot, skillsDir)],
    },
    results,
  };
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
  const tasks = await discoverTasks();
  const benchmarks = CATEGORY_ORDER.map((id) => ({
    id,
    secondary: id,
    ...CATEGORY_META[id],
    metric: {
      name: "score",
      label: "Score",
      unit: "",
      direction: "higher_is_better",
      baseline: "first_round",
    },
  }));

  await writeJson(path.join(dataDir, "metadata/agents.json"), [
    {
      id: "opencode",
      name: "OpenCode",
      type: "agent-framework",
    },
  ]);
  await writeJson(path.join(dataDir, "metadata/models.json"), [
    {
      id: "DeepSeek-V4-Pro",
      name: "DeepSeek-V4-Pro",
      provider: "DeepSeek",
      url: "https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro",
      tags: ["OSS", "国产"],
    },
  ]);
  await writeJson(path.join(dataDir, "metadata/benchmarks.json"), benchmarks);
  await writeJson(path.join(dataDir, "metadata/tasks.json"), tasks);

  const rawRunsDir = path.join(dataDir, "fake/raw-runs");
  await rm(rawRunsDir, { recursive: true, force: true });
  await mkdir(rawRunsDir, { recursive: true });
  await writeFile(
    path.join(rawRunsDir, "export_to_leaderboard_fake_seed.jsonl"),
    `${JSON.stringify(buildRawRun(tasks))}\n`
  );

  console.log(
    `Seeded fake leaderboard data for DeepSeek-V4-Pro/OpenCode with ${tasks.length} tasks`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
