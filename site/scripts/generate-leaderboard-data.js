import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(__dirname, "../src/data");

function parseArgs(argv) {
  const args = {
    dataDir: DEFAULT_DATA_DIR,
    mode: "fake",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--data-dir") {
      args.dataDir = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === "--mode") {
      args.mode = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!["fake", "real"].includes(args.mode)) {
    throw new Error(`--mode must be "fake" or "real", got: ${args.mode}`);
  }

  return args;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function round4(value) {
  return Number(value.toFixed(4));
}

function detailIndexKey({ taskId, model, agent, runId }) {
  return `${taskId}|${model}|${agent}|${runId}`;
}

function metadataKey(value) {
  return String(value).toUpperCase();
}

function modelDisplayFieldsFromMetadata(modelId, models, fallbackProvider = "") {
  const metadata = models.find(
    (model) => metadataKey(model.id) === metadataKey(modelId)
  );
  return {
    name: modelId,
    provider: metadata?.provider ?? fallbackProvider,
    url: metadata?.url,
    tags: metadata?.tags,
  };
}

function isNewer(a, b) {
  return timestampValue(resultTime(a)) > timestampValue(resultTime(b));
}

function isBetter(a, b) {
  if (a.score !== b.score) {
    return a.score > b.score;
  }
  return isNewer(a, b);
}

function resultTime(result) {
  return result.evaluatedAt ?? result.completedAt ?? result.submittedAt;
}

function timestampValue(value) {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function roundCount(result) {
  if (Array.isArray(result.rounds) && result.rounds.length > 0) {
    return result.rounds.length;
  }
  return result.roundCount;
}

async function readRawRuns(rawRunsDir) {
  const fileNames = await readdir(rawRunsDir);
  const jsonlFiles = fileNames.filter(
    (fileName) =>
      fileName.startsWith("export_to_leaderboard") && fileName.endsWith(".jsonl")
  );
  const runs = [];

  for (const fileName of jsonlFiles) {
    const filePath = path.join(rawRunsDir, fileName);
    const records = await readJsonl(filePath);
    for (const record of records) {
      runs.push({
        ...record,
        rawFile: path.relative(path.dirname(rawRunsDir), filePath),
      });
    }
  }

  return runs;
}

export function selectBestCompletedResults(runs, benchmarks) {
  const best = new Map();
  const allowedBenchmarks = new Set(benchmarks.map((benchmark) => benchmark.id));

  for (const run of runs) {
    for (const [taskId, result] of Object.entries(run.results ?? {})) {
      if (result.status !== "completed" || typeof result.score !== "number") {
        continue;
      }
      if (!allowedBenchmarks.has(result.benchmark)) {
        continue;
      }

      const key = `${run.model}|${run.agent}|${result.benchmark}|${taskId}`;
      const candidate = {
        ...result,
        taskId,
        runId: run.runId,
        agent: run.agent,
        model: run.model,
        provider: run.provider,
        submittedAt: run.submittedAt,
        evaluatedAt: result.evaluatedAt,
        completedAt: result.completedAt,
        rawFile: run.rawFile,
      };
      const current = best.get(key);
      if (!current || isBetter(candidate, current)) {
        best.set(key, candidate);
      }
    }
  }

  return [...best.values()];
}

export function buildOverview({ benchmarks, models, latestResults, generatedAt }) {
  const byModelAgentBenchmark = new Map();

  for (const result of latestResults) {
    const key = `${result.model}|${result.agent}|${result.benchmark}`;
    const bucket = byModelAgentBenchmark.get(key) ?? {
      model: result.model,
      agent: result.agent,
      provider: result.provider,
      benchmark: result.benchmark,
      scores: [],
      latestRunId: result.runId,
    };
    bucket.scores.push(result.score);
    if (isNewer(result, { submittedAt: bucket.submittedAt ?? "" })) {
      bucket.latestRunId = result.runId;
      bucket.submittedAt = result.submittedAt;
    }
    byModelAgentBenchmark.set(key, bucket);
  }

  const rowsByModelAgent = new Map();
  for (const bucket of byModelAgentBenchmark.values()) {
    const modelFields = modelDisplayFieldsFromMetadata(
      bucket.model,
      models,
      bucket.provider ?? ""
    );
    const rowKey = `${bucket.model}|${bucket.agent}`;
    const row = rowsByModelAgent.get(rowKey) ?? {
      model: bucket.model,
      agent: bucket.agent,
      provider: modelFields.provider,
      url: modelFields.url,
      tags: modelFields.tags,
      latestRunId: bucket.latestRunId,
      benchmarks: {},
    };
    const average =
      bucket.scores.reduce((sum, score) => sum + score, 0) / bucket.scores.length;
    row.benchmarks[bucket.benchmark] = round4(average);
    row.latestRunId = bucket.latestRunId;
    rowsByModelAgent.set(rowKey, row);
  }

  const rows = [...rowsByModelAgent.values()]
    .map((row) => {
      const benchmarkValues = Object.values(row.benchmarks);
      const overall =
        benchmarkValues.length === 0
          ? 0
          : benchmarkValues.reduce((sum, score) => sum + score, 0) /
            benchmarkValues.length;
      return {
        ...row,
        overall: round4(overall),
      };
    })
    .sort((a, b) => b.overall - a.overall);

  return {
    generatedAt,
    benchmarks: benchmarks.map((benchmark) => ({
      id: benchmark.id,
      primary: benchmark.primary,
      secondary: benchmark.secondary ?? benchmark.id,
      title: benchmark.title,
      metric: benchmark.metric,
    })),
    rows,
  };
}

export function buildCategorySummaries({ benchmarks, latestResults, generatedAt }) {
  return benchmarks.map((benchmark) => ({
    fileName: `${benchmark.id}.json`,
    data: {
      benchmark: benchmark.id,
      generatedAt,
      tasks: latestResults
        .filter((result) => result.benchmark === benchmark.id)
        .map((result) => ({
          taskId: result.taskId,
          model: result.model,
          agent: result.agent,
          runId: result.runId,
          score: result.score,
          nativeScore: result.nativeScore,
          bestRound: result.bestRound,
          rounds: roundCount(result),
          phaseRoundCounts: result.phaseRoundCounts,
          durationMinutes: result.durationMinutes,
          submittedAt: result.submittedAt,
        }))
        .sort((a, b) =>
          `${a.taskId}|${a.model}|${a.agent}`.localeCompare(
            `${b.taskId}|${b.model}|${b.agent}`
          )
        ),
    },
  }));
}

function buildTaskDetailIndex(latestResults) {
  return Object.fromEntries(
    latestResults.map((result) => [
      detailIndexKey(result),
      {
        rawFile: result.rawFile,
        runId: result.runId,
        taskId: result.taskId,
      },
    ])
  );
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataRoot =
    args.mode === "fake" ? path.join(args.dataDir, "fake") : args.dataDir;
  const rawRunsDir = path.join(dataRoot, "raw-runs");
  const generatedDir = path.join(dataRoot, "generated");
  const metadataDir = path.join(args.dataDir, "metadata");
  const generatedAt = new Date().toISOString();

  const [benchmarks, models, runs] = await Promise.all([
    readJson(path.join(metadataDir, "benchmarks.json")),
    readJson(path.join(metadataDir, "models.json")),
    readRawRuns(rawRunsDir),
  ]);
  const bestResults = selectBestCompletedResults(runs, benchmarks);
  const overview = buildOverview({ benchmarks, models, latestResults: bestResults, generatedAt });
  const categorySummaries = buildCategorySummaries({
    benchmarks,
    latestResults: bestResults,
    generatedAt,
  });
  const taskDetailIndex = buildTaskDetailIndex(bestResults);

  await writeJson(path.join(generatedDir, "overview.json"), overview);
  await rm(path.join(generatedDir, "categories"), { recursive: true, force: true });
  for (const summary of categorySummaries) {
    await writeJson(path.join(generatedDir, "categories", summary.fileName), summary.data);
  }
  await writeJson(
    path.join(generatedDir, "indexes", "task-detail-index.json"),
    taskDetailIndex
  );
  await writeJson(path.join(generatedDir, "generation-report.json"), {
    generatedAt,
    mode: args.mode,
    rawRuns: runs.length,
    bestResults: bestResults.length,
    categories: categorySummaries.length,
  });

  console.log(
    `Generated ${args.mode} leaderboard data: ${bestResults.length} best task results`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
