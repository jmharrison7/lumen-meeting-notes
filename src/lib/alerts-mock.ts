import type { AlertRule, ClientAlertConfig, GlobalAlertConfig } from "./types";

export const DEFAULT_TERMS = [
  "Budget",
  "Pricing",
  "Quote",
  "Timeline",
  "Deadline",
  "Contract",
  "Renewal",
  "Competitor",
  "Scope",
];

export const DEFAULT_TOPICS = [
  { key: "scope-creep", label: "Scope creep", enabled: true },
  { key: "money", label: "Money talk", enabled: true },
  { key: "timing", label: "Timing risk", enabled: true },
  { key: "praise", label: "Praise & wins", enabled: false },
];

export const TOPIC_PHRASES: Record<string, string[]> = {
  "scope-creep": ["out of scope", "extra round", "one more", "additional sku", "add another"],
  money: ["cost", "estimate", "invoice", "per unit", "cents a unit", "retainer"],
  timing: ["push it", "slip", "delayed", "tight", "by friday", "next week"],
  praise: ["love it", "brilliant", "really strong", "exactly what we wanted"],
};

export function defaultGlobalConfig(): GlobalAlertConfig {
  return {
    rules: DEFAULT_TERMS.map(
      (term, i): AlertRule => ({ id: `r-${i + 1}`, term, enabled: true, notify: i < 3 }),
    ),
    topics: { enabled: true, topics: DEFAULT_TOPICS.map((t) => ({ ...t })) },
  };
}

export const clientConfigs: Record<string, ClientAlertConfig> = {
  "c-harbor": {
    clientId: "c-harbor",
    inheritGlobal: true,
    rules: [{ id: "rc-1", term: "Signage", enabled: true, notify: false }],
  },
};

export let globalConfig: GlobalAlertConfig = defaultGlobalConfig();

export function setGlobalConfig(cfg: GlobalAlertConfig) {
  globalConfig = cfg;
}
