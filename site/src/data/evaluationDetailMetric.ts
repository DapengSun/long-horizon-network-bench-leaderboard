import type { EvaluationDetailMetric } from "../types";

export const DEFAULT_DETAIL_METRIC: EvaluationDetailMetric = {
  name: "latency",
  label: "Latency",
  unit: "",
  direction: "lower_is_better",
  baseline: "first_round",
};
