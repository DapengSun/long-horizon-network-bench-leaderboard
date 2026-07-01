import React, { useMemo, useState } from "react";
import { Select, Tooltip, Typography } from "antd";
import {
  buildMultiphaseDetailView,
  phaseLabel,
  type MultiphaseModelView,
} from "../features/multiphaseDetail";
import type {
  CaseDetailChartPayload,
  EvaluationCaseDetailPoint,
  EvaluationMetricValue,
  EvaluationSloCheck,
} from "../types";

const CHART_WIDTH = 760;
const CHART_HEIGHT = 220;
const MARGIN = { top: 18, right: 20, bottom: 36, left: 58 };
type DetailPhase = "phase1" | "phase2";

interface MultiphaseCaseDetailProps {
  payload: CaseDetailChartPayload;
}

interface PlotPoint {
  point: EvaluationCaseDetailPoint;
  x: number;
  y: number;
  sloPass?: boolean;
}

function roundSloPass(point: EvaluationCaseDetailPoint): boolean | undefined {
  const direct = point.metrics?.sloPass;
  if (typeof direct === "boolean") {
    return direct;
  }
  const scenarios = point.scenarios?.filter((scenario) => scenario.sloPass !== undefined);
  if (!scenarios?.length) {
    return undefined;
  }
  return scenarios.every((scenario) => scenario.sloPass === true);
}

function phaseScoreLabel(round: EvaluationCaseDetailPoint | undefined): string {
  return round ? `${round.round} · ${formatScore(round.score)}` : "-";
}

function formatScore(score: number | undefined): string {
  return score === undefined ? "-" : score.toFixed(4);
}

function buildScorePlot(rounds: EvaluationCaseDetailPoint[]) {
  const innerWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const scores = rounds.map((point) => point.score);
  const minScore = Math.min(0, ...scores);
  const maxScore = Math.max(1, ...scores);
  const xStep = rounds.length > 1 ? innerWidth / (rounds.length - 1) : 0;
  const yForScore = (score: number) => {
    const ratio = (score - minScore) / (maxScore - minScore || 1);
    return MARGIN.top + innerHeight - ratio * innerHeight;
  };
  const points: PlotPoint[] = rounds.map((point, index) => ({
    point,
    x: MARGIN.left + index * xStep,
    y: yForScore(point.score),
    sloPass: roundSloPass(point),
  }));
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  return { points, path, yForScore, innerWidth, innerHeight };
}

function ScoreTimeline({ rounds }: { rounds: EvaluationCaseDetailPoint[] }) {
  const plot = useMemo(() => buildScorePlot(rounds), [rounds]);

  if (rounds.length === 0) {
    return null;
  }

  return (
    <svg
      className="multiphase-score-chart"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label="Multiphase score timeline"
    >
      <rect
        x={MARGIN.left}
        y={MARGIN.top}
        width={plot.innerWidth}
        height={plot.innerHeight}
        rx="14"
        className="multiphase-score-bg"
      />
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const y = plot.yForScore(tick);
        return (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + plot.innerWidth}
              y1={y}
              y2={y}
              className="multiphase-score-grid"
            />
            <text x={MARGIN.left - 10} y={y + 4} className="multiphase-score-tick">
              {formatScore(tick)}
            </text>
          </g>
        );
      })}
      <path className="multiphase-score-line" d={plot.path} fill="none" />
      {plot.points.map((plotPoint) => (
        <g key={plotPoint.point.round}>
          <circle
            cx={plotPoint.x}
            cy={plotPoint.y}
            r={plotPoint.sloPass === false ? 6 : 4.8}
            className={
              plotPoint.sloPass === false
                ? "multiphase-score-point failed"
                : "multiphase-score-point"
            }
          />
          <text
            x={plotPoint.x}
            y={MARGIN.top + plot.innerHeight + 24}
            className="multiphase-score-round-label"
          >
            {plotPoint.point.phase === "phase2" ? "P2" : "P1"} r
            {plotPoint.point.roundIndex ?? plotPoint.point.round.replace(/\D+/g, "")}
          </text>
        </g>
      ))}
    </svg>
  );
}

function JourneyPipeline({
  activePhase,
  modelView,
  onPhaseChange,
}: {
  activePhase: DetailPhase;
  modelView: MultiphaseModelView;
  onPhaseChange: (phase: DetailPhase) => void;
}) {
  const steps = [
    {
      label: "Baseline",
      value: "initial config",
      detail: "reference",
    },
    {
      label: "Phase 1",
      value: phaseScoreLabel(modelView.summary.bestPhase1Round),
      detail: "anchor optimization",
      phase: "phase1" as const,
    },
    {
      label: "Phase 2",
      value: phaseScoreLabel(modelView.summary.bestPhase2Round),
      detail: "public generalization",
      phase: "phase2" as const,
    },
    {
      label: "Final",
      value: formatScore(modelView.result.finalScore),
      detail: "robustness exam",
    },
  ];

  return (
    <div className="multiphase-journey-pipeline">
      {steps.map((step, index) => (
        <React.Fragment key={step.label}>
          {step.phase ? (
            <button
              type="button"
              className={`multiphase-journey-step selectable ${
                activePhase === step.phase ? "active" : ""
              }`}
              onClick={() => onPhaseChange(step.phase)}
            >
              <span>{step.label}</span>
              <strong>{step.value}</strong>
              <small>{step.detail}</small>
            </button>
          ) : (
            <div className="multiphase-journey-step">
              <span>{step.label}</span>
              <strong>{step.value}</strong>
              <small>{step.detail}</small>
            </div>
          )}
          {index < steps.length - 1 ? (
            <div className="multiphase-journey-arrow" aria-hidden="true">
              →
            </div>
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}

function ScenarioMatrix({ modelView }: { modelView: MultiphaseModelView }) {
  const { scenarioMatrix } = modelView;
  if (scenarioMatrix.rounds.length === 0 || scenarioMatrix.scenarios.length === 0) {
    return (
      <div className="multiphase-empty">
        Phase 2 scenario matrix is unavailable for this result.
      </div>
    );
  }

  const cellFor = (round: string, scenario: string) =>
    scenarioMatrix.cells.find(
      (cell) => cell.round === round && cell.scenario === scenario
    );

  return (
    <div className="multiphase-matrix-wrap">
      <table className="multiphase-scenario-matrix">
        <thead>
          <tr>
            <th>Round</th>
            {scenarioMatrix.scenarios.map((scenario) => (
              <th key={scenario}>{scenario}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scenarioMatrix.rounds.map((round) => (
            <tr key={round}>
              <th>{round}</th>
              {scenarioMatrix.scenarios.map((scenario) => {
                const cell = cellFor(round, scenario);
                return (
                  <td key={`${round}-${scenario}`}>
                    {cell ? (
                      <div className="multiphase-scenario-cell">
                        <span
                          className={
                            cell.sloPass === false
                              ? "multiphase-slo-badge failed"
                              : "multiphase-slo-badge"
                          }
                        >
                          {formatScore(cell.score)}
                          <small>{cell.sloPass === false ? "SLO fail" : "SLO pass"}</small>
                        </span>
                        <SloCheckList checks={displayChecks(cell.sloChecks)} compact />
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface DisplayCheck {
  name: string;
  actual?: EvaluationMetricValue;
  threshold?: EvaluationMetricValue;
  pass?: boolean;
}

function displayChecks(
  checks: Record<string, EvaluationSloCheck> | undefined,
  limit = 3
): DisplayCheck[] {
  const rows = Object.entries(checks ?? {}).map(([name, check]) => ({
    name,
    actual: check.actual,
    threshold: check.threshold,
    pass: check.pass,
  }));
  return rows
    .sort((left, right) => {
      if (left.pass === right.pass) {
        return 0;
      }
      return left.pass === false ? -1 : 1;
    })
    .slice(0, limit);
}

function fallbackRoundChecks(round: EvaluationCaseDetailPoint): DisplayCheck[] {
  const exportedChecks = displayChecks(round.sloChecks, 8);
  if (exportedChecks.length > 0) {
    return exportedChecks;
  }
  if (round.metrics?.slo_violation === true) {
    return [{ name: "slo_violation", pass: false }];
  }
  const sloPass = roundSloPass(round);
  if (sloPass !== undefined) {
    return [{ name: "slo_gate", pass: sloPass }];
  }
  return [];
}

function formatCheckValue(value: EvaluationMetricValue | undefined): string {
  if (value === undefined || value === null) {
    return "-";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(4);
  }
  return String(value);
}

function SloCheckList({
  checks,
  compact = false,
}: {
  checks: DisplayCheck[];
  compact?: boolean;
}) {
  if (checks.length === 0) {
    return (
      <Typography.Text type="secondary" className="multiphase-no-slo-checks">
        No exported SLO check detail.
      </Typography.Text>
    );
  }

  return (
    <div className={compact ? "multiphase-check-list compact" : "multiphase-check-list"}>
      {checks.map((check) => (
        <div
          key={`${check.name}-${formatCheckValue(check.actual)}-${formatCheckValue(
            check.threshold
          )}`}
          className={check.pass === false ? "multiphase-check-row failed" : "multiphase-check-row"}
        >
          <strong>{check.name}</strong>
          {check.actual !== undefined ? (
            <span>actual={formatCheckValue(check.actual)}</span>
          ) : null}
          {check.threshold !== undefined ? (
            <span>threshold={formatCheckValue(check.threshold)}</span>
          ) : null}
          <em>{check.pass === false ? "fail" : "pass"}</em>
        </div>
      ))}
    </div>
  );
}

function RoundDiagnostics({ round }: { round: EvaluationCaseDetailPoint | undefined }) {
  if (!round) {
    return null;
  }
  const checks = fallbackRoundChecks(round);
  return (
    <div className="multiphase-round-diagnostics">
      <div>
        <Typography.Text strong>{round.round}</Typography.Text>
        <Typography.Text type="secondary">
          {phaseLabel(round.phase)} · {round.scoreKind ?? "score"} · {formatScore(round.score)}
        </Typography.Text>
      </div>
      <div className="multiphase-slo-detail">
        <Typography.Text strong>SLO detail</Typography.Text>
        <SloCheckList checks={checks} />
      </div>
    </div>
  );
}

function RoundTable({
  phase,
  rounds,
  modelView,
}: {
  phase: DetailPhase;
  rounds: EvaluationCaseDetailPoint[];
  modelView: MultiphaseModelView;
}) {
  const [expandedRound, setExpandedRound] = useState<string | null>(null);

  if (rounds.length === 0) {
    return <div className="multiphase-empty">No rounds available for this phase.</div>;
  }

  const aggregateLabel = phase === "phase2" ? "Worst scenario" : "Raw score";
  const aggregateHelp =
    phase === "phase2"
      ? "Worst scenario is the lowest scenario score in this Phase 2 public-suite round."
      : "Raw score is the ungated round score before SLO penalties or gate effects.";
  const selectedPhase1Round = modelView.phase2Rounds.find(
    (round) => round.selectedFromPhase1Round
  )?.selectedFromPhase1Round;
  const showSelectedLegend = phase === "phase1" && selectedPhase1Round;

  return (
    <div className="multiphase-round-table-wrap">
      {showSelectedLegend ? (
        <div className="multiphase-selected-config-legend">
          <Tooltip title="This Phase 1 configuration was selected as the starting point for Phase 2 public-suite tuning.">
            <span className="multiphase-selected-star" aria-label="Selected for Phase 2">
              ⭐
            </span>
          </Tooltip>
          <span>Selected for Phase 2</span>
        </div>
      ) : null}
      <table className="multiphase-round-table">
        <thead>
          <tr>
            <th className="multiphase-expand-column" aria-label="Expand row" />
            <th>Round</th>
            <th>
              <Tooltip title="SLO shows whether the exported checks for this round all pass. Expand a row to inspect each check's actual value and threshold.">
                <span className="multiphase-column-help">SLO</span>
              </Tooltip>
            </th>
            <th>
              <Tooltip title={aggregateHelp}>
                <span className="multiphase-column-help">{aggregateLabel}</span>
              </Tooltip>
            </th>
            <th>
              <Tooltip title="Total score is the leaderboard score for this round after applying the task scoring and SLO gate rules.">
                <span className="multiphase-column-help">Total score</span>
              </Tooltip>
            </th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((round) => {
            const isExpanded = expandedRound === round.round;
            const rawScore =
              typeof round.metrics?.raw_score_before_slo_gate === "number"
                ? round.metrics.raw_score_before_slo_gate
                : undefined;
            const worstScenario =
              round.scenarios && round.scenarios.length > 0
                ? Math.min(...round.scenarios.map((scenario) => scenario.score))
                : undefined;
            const isSelectedForPhase2 =
              phase === "phase1" && round.round === selectedPhase1Round;
            return (
              <React.Fragment key={round.round}>
                <tr
                  className={isExpanded ? "expanded" : ""}
                  onClick={() => setExpandedRound(isExpanded ? null : round.round)}
                >
                  <td className="multiphase-expand-column">
                    <span className="multiphase-expand-icon" aria-hidden="true">
                      {isExpanded ? "▾" : "▸"}
                    </span>
                  </td>
                  <td>
                    <span className="multiphase-round-name">
                      {round.round}
                      {isSelectedForPhase2 ? (
                        <Tooltip title="Selected as the configuration entering Phase 2.">
                          <span
                            className="multiphase-selected-star"
                            aria-label="Selected for Phase 2"
                          >
                            ⭐
                          </span>
                        </Tooltip>
                      ) : null}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        roundSloPass(round) === false
                          ? "multiphase-slo-badge failed"
                          : "multiphase-slo-badge"
                      }
                    >
                      {roundSloPass(round) === false ? "fail" : "pass"}
                    </span>
                  </td>
                  <td>{formatScore(phase === "phase2" ? worstScenario : rawScore)}</td>
                  <td>{formatScore(round.score)}</td>
                </tr>
                {isExpanded ? (
                  <tr className="multiphase-round-expanded">
                    <td colSpan={5}>
                      {phase === "phase2" ? (
                        <ScenarioMatrix
                          modelView={{
                            ...modelView,
                            phase2Rounds: [round],
                            scenarioMatrix: {
                              rounds: [round.round],
                              scenarios: Array.from(
                                new Set(
                                  (round.scenarios ?? []).map((scenario) => scenario.scenario)
                                )
                              ),
                              cells: (round.scenarios ?? []).map((scenario) => ({
                                round: round.round,
                                scenario: scenario.scenario,
                                score: scenario.score,
                                sloPass: scenario.sloPass,
                                metrics: scenario.metrics,
                                sloChecks: scenario.sloChecks,
                              })),
                            },
                          }}
                        />
                      ) : (
                        <RoundDiagnostics round={round} />
                      )}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PhaseDetail({
  activePhase,
  modelView,
}: {
  activePhase: DetailPhase;
  modelView: MultiphaseModelView;
}) {
  const rounds =
    activePhase === "phase1" ? modelView.phase1Rounds : modelView.phase2Rounds;

  return (
    <div className="multiphase-phase-detail">
      <ScoreTimeline rounds={rounds} />
      <RoundTable phase={activePhase} rounds={rounds} modelView={modelView} />
    </div>
  );
}

export const MultiphaseCaseDetail: React.FC<MultiphaseCaseDetailProps> = ({
  payload,
}) => {
  const view = useMemo(() => buildMultiphaseDetailView(payload), [payload]);
  const [modelIndex, setModelIndex] = useState(0);
  const [activePhase, setActivePhase] = useState<DetailPhase>("phase1");

  if (!view) {
    return null;
  }

  const modelView = view.models[Math.min(modelIndex, view.models.length - 1)];

  return (
    <div className="multiphase-detail">
      {view.models.length > 1 ? (
        <Select
          className="multiphase-model-select"
          value={modelIndex}
          onChange={setModelIndex}
          options={view.models.map((model, index) => ({
            value: index,
            label: model.result.model,
          }))}
        />
      ) : null}

      <JourneyPipeline
        activePhase={activePhase}
        modelView={modelView}
        onPhaseChange={setActivePhase}
      />

      <PhaseDetail activePhase={activePhase} modelView={modelView} />
    </div>
  );
};
