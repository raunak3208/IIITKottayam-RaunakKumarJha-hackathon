export async function insertStressRun(pool, run) {
  await pool.query(
    `INSERT INTO stress_runs (run_id, ts, scenario_id, event_type, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [run.run_id, run.timestamp, run.scenario.scenario_id, run.trigger.event_type ?? null, run],
  );
}

export async function listStressRuns(pool, limit = 10) {
  const { rows } = await pool.query(
    'SELECT payload FROM stress_runs ORDER BY ts DESC LIMIT $1',
    [limit],
  );
  return rows.map((row) => row.payload);
}
