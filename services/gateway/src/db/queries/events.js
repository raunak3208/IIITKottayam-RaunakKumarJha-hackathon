const columns = `
  event_id, event_type, tickers, first_seen, last_seen, signal_count,
  cardinality(sources) AS source_count, impact, sentiment, confidence,
  CASE WHEN last_seen > now() - make_interval(hours => $1) THEN 'open' ELSE 'closed' END AS status`;

const toEvent = (row) => ({ schema_version: '1', ...row });

export async function listEvents(pool, { limit, minSources, windowHours }) {
  const { rows } = await pool.query(
    `SELECT ${columns} FROM events
     WHERE cardinality(sources) >= $2
     ORDER BY last_seen DESC LIMIT $3`,
    [windowHours, minSources, limit],
  );
  return rows.map(toEvent);
}

export async function getEvent(pool, id, windowHours) {
  const { rows } = await pool.query(`SELECT ${columns} FROM events WHERE event_id = $2`, [
    windowHours,
    id,
  ]);
  if (!rows.length) return null;

  const signals = await pool.query(
    'SELECT payload FROM signals WHERE event_id = $1 ORDER BY ts DESC LIMIT 100',
    [id],
  );
  return { ...toEvent(rows[0]), signals: signals.rows.map((r) => r.payload) };
}

export async function getSourceCount(pool, eventId) {
  const { rows } = await pool.query(
    'SELECT cardinality(sources) AS n FROM events WHERE event_id = $1',
    [eventId],
  );
  return rows[0]?.n ?? 0;
}
