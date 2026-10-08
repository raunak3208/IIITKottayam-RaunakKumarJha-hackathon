import { randomUUID } from 'node:crypto';
import { getSourceCount } from '../db/queries/events.js';
import { insertStressRun } from '../db/queries/stress.js';

const lastRun = new Map();
let library = [];

function matchScenario(signal) {
  return library.find(
    (s) =>
      s.trigger.event_type === signal.event_type &&
      signal.impact >= s.trigger.min_impact &&
      signal.confidence >= s.trigger.min_confidence,
  );
}

export async function runStress(ctx, scenarioId, signal = null, whatIf = null) {
  const payload = signal
    ? {
        scenario_id: scenarioId,
        impact: signal.impact,
        confidence: signal.confidence,
        tickers: signal.tickers,
      }
    : { scenario_id: scenarioId, ...(whatIf ?? {}) };
  const result = await ctx.quant.stress(payload);
  const run = {
    run_id: randomUUID(),
    timestamp: new Date().toISOString(),
    trigger: signal
      ? {
          signal_id: signal.signal_id,
          event_id: signal.event_id,
          event_type: signal.event_type,
          impact: signal.impact,
          confidence: signal.confidence,
          tickers: signal.tickers,
          evidence: signal.evidence_span.text,
        }
      : { manual: true, what_if: Boolean(whatIf?.shocks) },
    ...result,
  };
  await insertStressRun(ctx.pool, run);
  ctx.hub.broadcast('stress', run);
  return run;
}

export async function maybeTrigger(ctx, signal) {
  if (!library.length) library = (await ctx.quant.scenarios()).items;

  const scenario = matchScenario(signal);
  if (!scenario || signal.degraded) return;

  const sources = await getSourceCount(ctx.pool, signal.event_id);
  if (sources < ctx.config.stressMinSources) return;

  const now = Date.now();
  const last = lastRun.get(scenario.scenario_id) ?? 0;
  if (now - last < ctx.config.stressCooldownSec * 1000) return;

  lastRun.set(scenario.scenario_id, now);
  await runStress(ctx, scenario.scenario_id, signal);
}
