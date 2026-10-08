import React, { useEffect, useState } from 'react';
import { get, post } from '../api/http.js';
import { usePolling } from '../api/usePolling.js';

const JOBS = {
  evaluate: ['Run full evaluation', 'Sentiment, event classification, cascade ablation, cache, retrieval, adversarial suite and the leakage probe. Writes the results report.'],
  load_test: ['Run load test', 'Publishes a steady stream and then a 10x burst through the live pipeline and records latency per path.'],
  train_classifier: ['Train event classifier', 'Trains the embedding classifier from confident pseudo labels and the gold set, then loads it into the engine.'],
  build_reactions: ['Fill historical price reactions', 'Fetches market moves for the historical analog events used for retrieval and impact anchoring.'],
};

export default function EvaluationPanel() {
  const { data, error, reload } = usePolling('/v1/jobs', 3000);
  const [failure, setFailure] = useState('');
  const [hasResults, setHasResults] = useState(false);
  const [reportKey, setReportKey] = useState(0);

  const finished = data?.items.map((j) => j.finished ?? '').join('|');
  useEffect(() => {
    get('/v1/results/summary')
      .then(() => {
        setHasResults(true);
        setReportKey((k) => k + 1);
      })
      .catch(() => setHasResults(false));
  }, [finished]);

  async function start(name) {
    setFailure('');
    try {
      await post(`/v1/jobs/${name}`);
      reload();
    } catch (err) {
      setFailure(err.message);
    }
  }

  const running = data?.items.some((j) => j.status === 'running');

  return (
    <section aria-label="Evaluation">
      <h2>Evaluation and training</h2>
      {(error || failure) && <p className="neg-text">{error || failure}</p>}
      <div className="grid">
        {data?.items.map((job) => {
          const [title, description] = JOBS[job.name] ?? [job.name, ''];
          return (
            <div className="card" key={job.name}>
              <h3>
                {title} <span className={`pill ${job.status === 'failed' ? 'degraded' : job.status === 'running' ? 'busy' : 'ok'}`}>{job.status}</span>
              </h3>
              <p className="muted">{description}</p>
              <button disabled={running} onClick={() => start(job.name)}>
                {job.status === 'running' ? 'Running' : 'Start'}
              </button>
              {job.tail.length > 0 && <pre className="log">{job.tail.join('\n')}</pre>}
            </div>
          );
        })}
      </div>

      <h3 className="sub">Results report</h3>
      {hasResults ? (
        <iframe title="Results report" className="report" src={`/v1/results/report?k=${reportKey}`} />
      ) : (
        <p className="empty">No results yet. Run the full evaluation to generate the report.</p>
      )}
    </section>
  );
}
