import { DEFAULT_DETAIL_METRIC } from "./evaluationDetailMetric";
import type {
  DashboardBenchmarkData,
  PrimaryCategoryId,
} from "../features/dashboardData";
import type {
  EvaluationCaseDetailPoint,
  EvaluationCaseScenario,
  EvaluationCaseResult,
  EvaluationDetailEntry,
  EvaluationDetailMetric,
  EvaluationMetricValue,
  EvaluationSloCheck,
} from "../types";

type DataMode = "fake" | "real";

interface AgentMetadata {
  id: string;
  name: string;
}

interface ModelMetadata {
  id: string;
  name: string;
  provider: string;
  url?: string;
  tags?: string[];
}

interface ModelDisplayFields {
  name: string;
  provider: string;
  url?: string;
  tags?: string[];
}

interface GeneratedOverviewBenchmark {
  id: string;
  primary: PrimaryCategoryId;
  secondary?: string;
  title: string;
  tests?: number;
}

interface GeneratedOverviewRow {
  model: string;
  agent: string;
  provider?: string;
  url?: string;
  tags?: string[];
  benchmarks: Record<string, number>;
}

interface GeneratedOverview {
  benchmarks: GeneratedOverviewBenchmark[];
  rows: GeneratedOverviewRow[];
}

interface RawRunRound {
  round: string;
  score: number;
  phase?: string;
  roundIndex?: number;
  scoreKind?: string;
  selectedFromPhase1Round?: string;
  metrics?: Record<string, EvaluationMetricValue>;
  sloChecks?: Record<string, EvaluationSloCheck>;
  scenarios?: EvaluationCaseScenario[];
}

interface RawRunResult {
  benchmark: string;
  status: string;
  score: number;
  nativeScore?: number;
  metric?: EvaluationDetailMetric;
  bestRound?: string;
  durationMinutes?: number;
  evaluatedAt?: string;
  completedAt?: string;
  roundCount?: number;
  phaseRoundCounts?: {
    phase1?: number;
    phase2?: number;
  };
  rounds?: RawRunRound[];
  source?: {
    caseRunPath?: string;
  };
}

interface RawRunRecord {
  runId: string;
  agent: string;
  model: string;
  provider?: string;
  submittedAt: string;
  results?: Record<string, RawRunResult>;
}

interface CaseAttemptCandidate {
  displayModel: string;
  category: string;
  taskId: string;
  runId: string;
  submittedAt: string;
  evaluatedAt?: string;
  completedAt?: string;
  sourceCaseRunPath?: string;
  result: RawRunResult;
}

function resolveDataMode(): DataMode {
  const explicitMode = import.meta.env.VITE_LEADERBOARD_DATA_MODE;
  if (explicitMode === "fake" || explicitMode === "real") {
    return explicitMode;
  }
  return import.meta.env.MODE === "production" ? "real" : "fake";
}

const dataMode: DataMode = resolveDataMode();

const agentMetadataModules = import.meta.glob<AgentMetadata[]>(
  "./metadata/agents.json",
  { eager: true, import: "default" }
);
const modelMetadataModules = import.meta.glob<ModelMetadata[]>(
  "./metadata/models.json",
  { eager: true, import: "default" }
);
const fakeOverviewModules = import.meta.glob<GeneratedOverview>(
  "./fake/generated/overview.json",
  { eager: true, import: "default" }
);
const realOverviewModules = import.meta.glob<GeneratedOverview>(
  "./generated/overview.json",
  { eager: true, import: "default" }
);
const fakeRawRunModules = import.meta.glob<string>(
  "./fake/raw-runs/export_to_leaderboard*.jsonl",
  { eager: true, import: "default", query: "?raw" }
);
const realRawRunModules = import.meta.glob<string>(
  "./raw-runs/export_to_leaderboard*.jsonl",
  { eager: true, import: "default", query: "?raw" }
);

function firstModuleValue<T>(modules: Record<string, T>): T | undefined {
  return Object.values(modules)[0];
}

function parseJsonl(content: string): RawRunRecord[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RawRunRecord);
}

const agents = firstModuleValue(agentMetadataModules) ?? [];
const agentNameById = new Map(agents.map((agent) => [agent.id, agent.name]));
const models = firstModuleValue(modelMetadataModules) ?? [];

function metadataKey(value: string): string {
  return value.toUpperCase();
}

export function modelDisplayFieldsFromMetadata(
  modelId: string,
  modelMetadata: ModelMetadata[],
  fallbackProvider?: string
): ModelDisplayFields {
  const requestedKey = metadataKey(modelId);
  const metadata = modelMetadata.find(
    (model) =>
      metadataKey(model.id) === requestedKey || metadataKey(model.name) === requestedKey
  );

  return {
    name: modelId,
    provider: metadata?.provider ?? fallbackProvider ?? "",
    url: metadata?.url,
    tags: metadata?.tags,
  };
}

function modelDisplayFields(
  modelId: string,
  fallbackProvider?: string
): ModelDisplayFields {
  return modelDisplayFieldsFromMetadata(modelId, models, fallbackProvider);
}

function formatAgentName(agentId: string): string {
  return agentNameById.get(agentId) ?? agentId;
}

function formatModelWithAgent(model: string, agent: string): string {
  return `${model} · ${formatAgentName(agent)}`;
}

function activeOverview(): GeneratedOverview | undefined {
  return firstModuleValue(dataMode === "fake" ? fakeOverviewModules : realOverviewModules);
}

function activeRawRuns(): RawRunRecord[] {
  const modules = dataMode === "fake" ? fakeRawRunModules : realRawRunModules;
  return Object.values(modules).flatMap(parseJsonl);
}

function averageCaseScore(cases: EvaluationCaseResult[]): number {
  if (cases.length === 0) {
    return 0;
  }
  const average = cases.reduce((sum, item) => sum + item.score, 0) / cases.length;
  return Number(average.toFixed(4));
}

export function getLeaderboardDataMode(): DataMode {
  return dataMode;
}

export function getDashboardData(): DashboardBenchmarkData {
  const overview = activeOverview();
  if (!overview) {
    return { benchmarks: [] };
  }
  const bestAveragesByModelCategory = new Map(
    getEvaluationDetailEntries().map((entry) => [
      `${entry.model}|${entry.category}`,
      averageCaseScore(entry.cases),
    ])
  );

  return {
    benchmarks: overview.benchmarks.map((benchmark) => {
      const secondary = benchmark.secondary ?? benchmark.id;
      return {
        id: benchmark.id.toLowerCase(),
        primary: benchmark.primary,
        secondary,
        title: benchmark.title,
        tests: benchmark.tests ?? 0,
        rows: overview.rows
          .filter((row) => typeof row.benchmarks[secondary] === "number")
          .map((row) => {
            const modelFields = modelDisplayFields(row.model, row.provider);
            const displayModel = formatModelWithAgent(row.model, row.agent);
            return {
              provider: modelFields.provider,
              model: displayModel,
              url: modelFields.url ?? row.url,
              average:
                bestAveragesByModelCategory.get(`${displayModel}|${secondary}`) ??
                row.benchmarks[secondary],
              tags: [...(modelFields.tags ?? row.tags ?? []), formatAgentName(row.agent)],
            };
          }),
      };
    }),
  };
}

function candidateTime(candidate: CaseAttemptCandidate): string {
  return candidate.evaluatedAt ?? candidate.completedAt ?? candidate.submittedAt;
}

function timestampValue(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isLaterAttempt(a: CaseAttemptCandidate, b: CaseAttemptCandidate): boolean {
  return timestampValue(candidateTime(a)) > timestampValue(candidateTime(b));
}

function isBetterAttempt(a: CaseAttemptCandidate, b: CaseAttemptCandidate): boolean {
  if (a.result.score !== b.result.score) {
    return a.result.score > b.result.score;
  }
  return isLaterAttempt(a, b);
}

function rawRoundCount(result: RawRunResult): number {
  if (Array.isArray(result.rounds) && result.rounds.length > 0) {
    return result.rounds.length;
  }
  return result.roundCount ?? 0;
}

function caseFromCandidate(
  candidate: CaseAttemptCandidate,
  flags: { isBest: boolean; isLatest: boolean },
  history?: EvaluationCaseResult["history"]
): EvaluationCaseResult {
  const result = candidate.result;
  return {
    case: candidate.taskId,
    rounds: rawRoundCount(result),
    best: result.bestRound ?? "",
    score: result.score,
    durationMinutes: result.durationMinutes ?? 0,
    runId: candidate.runId,
    evaluatedAt: candidate.evaluatedAt,
    submittedAt: candidate.submittedAt,
    sourceCaseRunPath: candidate.sourceCaseRunPath,
    isBest: flags.isBest,
    isLatest: flags.isLatest,
    phaseRoundCounts: result.phaseRoundCounts,
    history,
    detail: result.rounds?.map(roundDetailFromRaw),
  };
}

function attemptFromCandidate(
  candidate: CaseAttemptCandidate,
  flags: { isBest: boolean; isLatest: boolean }
): NonNullable<EvaluationCaseResult["history"]>[number] {
  const result = candidate.result;
  return {
    runId: candidate.runId,
    evaluatedAt: candidate.evaluatedAt,
    submittedAt: candidate.submittedAt,
    sourceCaseRunPath: candidate.sourceCaseRunPath,
    rounds: rawRoundCount(result),
    best: result.bestRound ?? "",
    score: result.score,
    durationMinutes: result.durationMinutes ?? 0,
    isBest: flags.isBest,
    isLatest: flags.isLatest,
    phaseRoundCounts: result.phaseRoundCounts,
    detail: result.rounds?.map(roundDetailFromRaw),
  };
}

function cloneRecord<T extends Record<string, EvaluationMetricValue> | undefined>(
  record: T
): T {
  if (!record) {
    return record;
  }
  return { ...record };
}

function cloneSloChecks(
  checks: Record<string, EvaluationSloCheck> | undefined
): Record<string, EvaluationSloCheck> | undefined {
  if (!checks) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(checks).map(([name, check]) => [name, { ...check }])
  );
}

function scenarioFromRaw(scenario: EvaluationCaseScenario): EvaluationCaseScenario {
  return {
    ...scenario,
    metrics: cloneRecord(scenario.metrics),
    sloChecks: cloneSloChecks(scenario.sloChecks),
    components: cloneRecord(scenario.components),
  };
}

function roundDetailFromRaw(round: RawRunRound): EvaluationCaseDetailPoint {
  return {
    round: round.round,
    score: round.score,
    phase: round.phase,
    roundIndex: round.roundIndex,
    scoreKind: round.scoreKind,
    selectedFromPhase1Round: round.selectedFromPhase1Round,
    metrics: cloneRecord(round.metrics),
    sloChecks: cloneSloChecks(round.sloChecks),
    scenarios: round.scenarios?.map(scenarioFromRaw),
  };
}

export function getEvaluationDetailEntries(): EvaluationDetailEntry[] {
  const groups = new Map<string, EvaluationDetailEntry>();
  const caseGroups = new Map<string, CaseAttemptCandidate[]>();
  const allowedBenchmarks = new Set(
    activeOverview()?.benchmarks.map((benchmark) => benchmark.secondary ?? benchmark.id)
  );

  for (const run of activeRawRuns()) {
    const displayModel = formatModelWithAgent(run.model, run.agent);
    for (const [taskId, result] of Object.entries(run.results ?? {})) {
      if (result.status !== "completed") {
        continue;
      }
      if (allowedBenchmarks.size > 0 && !allowedBenchmarks.has(result.benchmark)) {
        continue;
      }

      const key = `${displayModel}|${result.benchmark}|${taskId}`;
      const attempts = caseGroups.get(key) ?? [];
      attempts.push({
        displayModel,
        category: result.benchmark,
        taskId,
        runId: run.runId,
        submittedAt: run.submittedAt,
        evaluatedAt: result.evaluatedAt,
        completedAt: result.completedAt,
        sourceCaseRunPath: result.source?.caseRunPath,
        result,
      });
      caseGroups.set(key, attempts);
    }
  }

  for (const attempts of caseGroups.values()) {
    const latest = attempts.reduce((current, candidate) =>
      isLaterAttempt(candidate, current) ? candidate : current
    );
    const best = attempts.reduce((current, candidate) =>
      isBetterAttempt(candidate, current) ? candidate : current
    );
    const entryKey = `${best.displayModel}|${best.category}`;
    const history = attempts
      .map((candidate) =>
        attemptFromCandidate(candidate, {
          isBest: candidate === best,
          isLatest: candidate === latest,
        })
      )
      .sort(
        (a, b) =>
          timestampValue(b.evaluatedAt ?? b.submittedAt) -
          timestampValue(a.evaluatedAt ?? a.submittedAt)
      );
    const current =
      groups.get(entryKey) ??
      ({
        model: best.displayModel,
        category: best.category,
        submittedAt: candidateTime(best),
        metric: best.result.metric ?? DEFAULT_DETAIL_METRIC,
        cases: [],
      } satisfies EvaluationDetailEntry);

    current.cases.push(
      caseFromCandidate(
        best,
        {
          isBest: true,
          isLatest: best === latest,
        },
        history
      )
    );
    if (timestampValue(candidateTime(best)) > timestampValue(current.submittedAt)) {
      current.submittedAt = candidateTime(best);
    }
    groups.set(entryKey, current);
  }

  return [...groups.values()].map((entry) => ({
    ...entry,
    cases: entry.cases.sort((a, b) => a.case.localeCompare(b.case)),
  }));
}
