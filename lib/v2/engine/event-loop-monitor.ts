/**
 * EventLoopMonitor — the missing production sentinel for months-long VPS runs.
 *
 * Complements Watchdog + HealthMonitor + SystemMonitor without duplicating them:
 *
 *  • Watchdog       — repairs zombie sockets, stale quotes, wedged SLO loop.
 *  • HealthMonitor  — subsystem OK/NOT-OK transitions → Telegram alerts.
 *  • SystemMonitor  — one-shot RSS / heap / CPU / load / disk snapshot.
 *  • EventLoopMonitor (this file) — CONTINUOUS observability for the two
 *    silent-degradation modes that none of the above detect:
 *
 *      1. EVENT LOOP LAG — a stuck sync callback / GC pause / blocking file
 *         write freezes the loop for hundreds of ms, delaying trigger
 *         detection, order submission, and WS keep-alives. Sampled at kernel
 *         resolution via perf_hooks.monitorEventLoopDelay so it is exact
 *         (histogram in nanoseconds) and cheap (<10µs / poll).
 *
 *      2. HEAP GROWTH TREND — a slow leak (e.g. accumulating listeners on a
 *         reconnecting socket, a Map that only ever grows) never trips the
 *         static 400MB RSS warn threshold on a fresh boot but WILL after 3
 *         weeks. Detect via rolling linear regression of heap samples over
 *         a 30-minute window: report growth in MB/hour. Sustained positive
 *         slope > 5MB/h is the memory-leak signature.
 *
 * Strictly READ-ONLY: never mutates trading state, never places orders. The
 * output feeds the dashboard health panel and a single Telegram warning per
 * threshold breach (rate-limited) so operators see problems days before PM2's
 * hard 512MB restart kicks in.
 */

import { monitorEventLoopDelay, type IntervalHistogram } from "node:perf_hooks"
import { logEvent } from "./events"
import { notify } from "./notifier"

// --- tunables (constants, not env — reliability posture, not per-deploy config)

/** perf_hooks histogram resolution — kernel samples every 20ms. */
const HISTOGRAM_RESOLUTION_MS = 20
/** How often we roll the histogram + heap sample. Cheap; 15s keeps signal fresh. */
const SAMPLE_INTERVAL_MS = 15_000
/** Rolling window over which we compute p50/p99/max + heap slope. 30 min. */
const WINDOW_MINUTES = 30
const MAX_SAMPLES = Math.ceil((WINDOW_MINUTES * 60_000) / SAMPLE_INTERVAL_MS)
/** Event loop lag warning threshold (p99 in ms). Anything above this stalls
 *  the 1s SLO tick and the 10s WS keep-alive; operators must be alerted. */
const LAG_WARN_P99_MS = 250
/** Heap growth rate threshold (MB/hour). A steady ≥ this rate for the whole
 *  window means we would breach the 512MB PM2 ceiling within days. */
const HEAP_GROWTH_WARN_MB_PER_HR = 5
/** Rate-limit the alerts so a genuinely slow leak does not spam Telegram.
 *  One alert per breach type per hour is enough for actionable ops. */
const ALERT_COOLDOWN_MS = 60 * 60_000

interface Sample {
  ts: number
  heapUsedMb: number
}

export interface EventLoopMonitorSnapshot {
  /** Rolling p50 of event loop lag over the sampling window, in ms. */
  lagP50Ms: number
  /** Rolling p99 of event loop lag over the sampling window, in ms. */
  lagP99Ms: number
  /** Peak lag observed in the current interval (reset each SAMPLE_INTERVAL_MS). */
  lagMaxMs: number
  /** Current heap in MB (last sample). */
  heapUsedMb: number
  /** Rolling linear-regression slope of heapUsedMb over the window, in MB/hour.
   *  Positive = growing; > HEAP_GROWTH_WARN_MB_PER_HR is the leak signature. */
  heapGrowthMbPerHour: number
  /** How many samples currently drive the trend calculation. */
  windowSamples: number
  /** Whether the monitor is currently sampling. */
  active: boolean
}

export class EventLoopMonitor {
  private histogram: IntervalHistogram | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private samples: Sample[] = []
  /** Values from the LAST completed rolling window; snapshot reads these. */
  private lastP50 = 0
  private lastP99 = 0
  private lastMax = 0
  private lastLagAlertMs = 0
  private lastHeapAlertMs = 0

  start(): void {
    if (this.timer) return
    this.histogram = monitorEventLoopDelay({ resolution: HISTOGRAM_RESOLUTION_MS })
    this.histogram.enable()
    this.timer = setInterval(() => this.sample(), SAMPLE_INTERVAL_MS)
    if (typeof this.timer.unref === "function") this.timer.unref()
    logEvent(
      "info",
      "[EventLoopMonitor] started — perf_hooks histogram every " +
        `${HISTOGRAM_RESOLUTION_MS}ms, rolling window ${WINDOW_MINUTES}min`,
    )
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.histogram) {
      try { this.histogram.disable() } catch { /* ignore */ }
      this.histogram = null
    }
    this.samples = []
    this.lastP50 = 0
    this.lastP99 = 0
    this.lastMax = 0
  }

  snapshot(): EventLoopMonitorSnapshot {
    const heapUsedMb = Math.round(process.memoryUsage().heapUsed / 1048576)
    return {
      lagP50Ms: this.lastP50,
      lagP99Ms: this.lastP99,
      lagMaxMs: this.lastMax,
      heapUsedMb,
      heapGrowthMbPerHour: computeHeapGrowth(this.samples),
      windowSamples: this.samples.length,
      active: this.timer !== null,
    }
  }

  /** Test hook: force a sample tick without waiting for the interval. */
  tickForTest(): void {
    this.sample()
  }

  private sample(): void {
    try {
      const h = this.histogram
      if (h) {
        // perf_hooks histogram reports nanoseconds — convert to ms.
        this.lastP50 = Math.round((h.percentile(50) as number) / 1_000_000)
        this.lastP99 = Math.round((h.percentile(99) as number) / 1_000_000)
        this.lastMax = Math.round((h.max as number) / 1_000_000)
        h.reset()
      }
      const heapUsedMb = process.memoryUsage().heapUsed / 1048576
      this.samples.push({ ts: Date.now(), heapUsedMb })
      if (this.samples.length > MAX_SAMPLES) this.samples.shift()

      // Alerting — rate-limited so a slow leak or a persistent GC pause does
      // not spam operators. Only alert once we have enough data for signal.
      const now = Date.now()
      if (this.lastP99 > LAG_WARN_P99_MS && now - this.lastLagAlertMs > ALERT_COOLDOWN_MS) {
        this.lastLagAlertMs = now
        const msg =
          `[EventLoopMonitor] event loop lag p99=${this.lastP99}ms ` +
          `(p50=${this.lastP50}ms, max=${this.lastMax}ms) exceeds ${LAG_WARN_P99_MS}ms — ` +
          `SLO ticks / WS keep-alives may be delayed`
        logEvent("warn", msg)
        try { void notify("system", msg) } catch { /* best-effort */ }
      }

      if (this.samples.length >= MAX_SAMPLES) {
        const slope = computeHeapGrowth(this.samples)
        if (slope > HEAP_GROWTH_WARN_MB_PER_HR && now - this.lastHeapAlertMs > ALERT_COOLDOWN_MS) {
          this.lastHeapAlertMs = now
          const msg =
            `[EventLoopMonitor] heap growth ${slope.toFixed(1)}MB/h sustained over ` +
            `${WINDOW_MINUTES}min — investigate possible memory leak (current heap ` +
            `${Math.round(heapUsedMb)}MB, PM2 restart ceiling 512MB RSS)`
          logEvent("warn", msg)
          try { void notify("system", msg) } catch { /* best-effort */ }
        }
      }
    } catch (e) {
      // A monitor must never crash the process it is measuring.
      logEvent("warn", `[EventLoopMonitor] sample failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}

/**
 * Linear-regression slope of heapUsedMb vs. time, converted to MB/hour.
 * Exported for unit tests; also handles edge cases (< 2 samples, zero
 * time span from clock jump) by returning 0.
 */
export function computeHeapGrowth(samples: ReadonlyArray<Sample>): number {
  const n = samples.length
  if (n < 2) return 0
  const t0 = samples[0].ts
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
  for (const s of samples) {
    const x = (s.ts - t0) / 3_600_000 // hours since window start
    const y = s.heapUsedMb
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x
  }
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return 0
  const slope = (n * sumXY - sumX * sumY) / denom // MB per hour
  return Math.round(slope * 10) / 10
}
