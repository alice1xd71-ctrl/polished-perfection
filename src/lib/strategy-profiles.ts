/**
 * Strategy Profiles — configuration schema, defaults, validation, import/export.
 *
 * The trading engine is the single source of execution truth. Profiles here
 * are pure configuration snapshots persisted to Supabase; the engine reads
 * them via service-role and decides how to apply them.
 */
import { z } from "zod";

export const STRATEGY_TYPES = [
  "standing_limit",
  "btc5m_scalper",
  "mean_reversion",
  "momentum",
  "market_making",
  "custom",
] as const;
export type StrategyType = (typeof STRATEGY_TYPES)[number];

export const DEFAULT_MODES = ["paper", "live"] as const;
export type DefaultMode = (typeof DEFAULT_MODES)[number];

export const positionSizingSchema = z.object({
  method: z.enum(["fixed_usdc", "percent_bankroll", "kelly_fraction"]).default("fixed_usdc"),
  fixed_usdc: z.number().min(0).max(1_000_000).default(10),
  percent_bankroll: z.number().min(0).max(100).default(1),
  kelly_fraction: z.number().min(0).max(1).default(0.1),
});

export const riskSchema = z.object({
  max_daily_loss_usdc: z.number().min(0).max(1_000_000).default(50),
  max_position_size_usdc: z.number().min(0).max(1_000_000).default(100),
  max_exposure_usdc: z.number().min(0).max(1_000_000).default(500),
  max_retries: z.number().int().min(0).max(20).default(3),
  cooldown_ms: z.number().int().min(0).max(3_600_000).default(2_000),
  kill_switch: z.boolean().default(false),
  emergency_stop_behaviour: z.enum(["cancel_all", "flatten", "hold"]).default("cancel_all"),
});

export const executionSchema = z.object({
  order_timeout_ms: z.number().int().min(100).max(600_000).default(5_000),
  price_tolerance_bps: z.number().min(0).max(10_000).default(50),
  slippage_tolerance_bps: z.number().min(0).max(10_000).default(100),
  min_notional_usdc: z.number().min(0).max(1_000_000).default(1),
  post_only: z.boolean().default(false),
});

export const schedulingSchema = z.object({
  enabled: z.boolean().default(true),
  start_utc: z.string().regex(/^\d{2}:\d{2}$/).default("00:00"),
  end_utc: z.string().regex(/^\d{2}:\d{2}$/).default("23:59"),
  weekdays: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
});

export const marketFiltersSchema = z.object({
  allow_slugs: z.array(z.string()).default([]),
  block_slugs: z.array(z.string()).default([]),
  min_liquidity_usdc: z.number().min(0).default(0),
  min_time_to_close_ms: z.number().int().min(0).default(0),
});

export const btc5mSchema = z.object({
  enabled: z.boolean().default(false),
  trigger_price_yes: z.number().min(0).max(1).default(0.5),
  target_offset_ticks: z.number().int().min(0).default(2),
  window_open_offset_ms: z.number().int().default(-60_000),
  window_close_offset_ms: z.number().int().default(-1_000),
  min_edge_bps: z.number().min(0).default(25),
});

export const strategyConfigSchema = z.object({
  position_sizing: positionSizingSchema.default({}),
  risk: riskSchema.default({}),
  execution: executionSchema.default({}),
  scheduling: schedulingSchema.default({}),
  market_filters: marketFiltersSchema.default({}),
  btc5m: btc5mSchema.default({}),
});
export type StrategyConfig = z.infer<typeof strategyConfigSchema>;

export const strategyProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().max(2000).default(""),
  strategy_type: z.enum(STRATEGY_TYPES).default("custom"),
  enabled: z.boolean().default(false),
  default_mode: z.enum(DEFAULT_MODES).default("paper"),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  notes: z.string().max(5000).default(""),
  config: strategyConfigSchema,
});
export type StrategyProfileInput = z.infer<typeof strategyProfileSchema>;

export const importEnvelopeSchema = z.object({
  schema: z.literal("p4.strategy_profile"),
  version: z.number().int().min(1),
  exported_at: z.string(),
  profile: strategyProfileSchema,
});
export type ImportEnvelope = z.infer<typeof importEnvelopeSchema>;

export const EXPORT_SCHEMA_VERSION = 1;

export function defaultProfile(name = "New strategy"): StrategyProfileInput {
  return strategyProfileSchema.parse({
    name,
    description: "",
    strategy_type: "custom",
    enabled: false,
    default_mode: "paper",
    tags: [],
    notes: "",
    config: strategyConfigSchema.parse({}),
  });
}

export function toExportEnvelope(profile: StrategyProfileInput): ImportEnvelope {
  return {
    schema: "p4.strategy_profile",
    version: EXPORT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    profile: strategyProfileSchema.parse(profile),
  };
}

export function parseImportPayload(raw: string): ImportEnvelope {
  const json = JSON.parse(raw);
  return importEnvelopeSchema.parse(json);
}

/** Cross-field validation. Returns null when valid, or a human-readable error. */
export function validateConfig(cfg: StrategyConfig): string | null {
  if (cfg.risk.max_position_size_usdc > cfg.risk.max_exposure_usdc) {
    return "Max position size cannot exceed max exposure.";
  }
  if (cfg.execution.slippage_tolerance_bps < cfg.execution.price_tolerance_bps) {
    return "Slippage tolerance must be >= price tolerance.";
  }
  if (cfg.scheduling.enabled && cfg.scheduling.start_utc >= cfg.scheduling.end_utc) {
    return "Scheduling window start must be before end.";
  }
  if (cfg.btc5m.enabled && (cfg.btc5m.trigger_price_yes <= 0 || cfg.btc5m.trigger_price_yes >= 1)) {
    return "BTC 5m trigger price must be strictly between 0 and 1.";
  }
  return null;
}
