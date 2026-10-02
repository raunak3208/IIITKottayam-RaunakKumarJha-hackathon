export async function insertSignal(pool, s) {
  const result = await pool.query(
    `INSERT INTO signals
       (signal_id, event_id, ts, source, tickers, sentiment, event_type, impact, confidence, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (signal_id) DO NOTHING`,
    [
      s.signal_id,
      s.event_id,
      s.timestamp,
      s.source,
      s.tickers,
      s.sentiment,
      s.event_type,
      s.impact,
      s.confidence,
      s,
    ],
  );
  return result.rowCount === 1;
}

export async function listSignals(pool, { limit = 50, ticker, eventType, minImpact }) {
  const where = [];
  const params = [];

  if (ticker) {
    params.push(ticker);
    where.push(`$${params.length} = ANY(tickers)`);
  }
  if (eventType) {
    params.push(eventType);
    where.push(`event_type = $${params.length}`);
  }
  if (minImpact !== undefined) {
    params.push(minImpact);
    where.push(`impact >= $${params.length}`);
  }
  params.push(limit);

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT payload FROM signals ${clause} ORDER BY ts DESC LIMIT $${params.length}`,
    params,
  );
  return rows.map((row) => row.payload);
}
