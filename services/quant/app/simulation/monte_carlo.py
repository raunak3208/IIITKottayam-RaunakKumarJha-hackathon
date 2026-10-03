import numpy as np

FACTORS = ["equity_pct", "rate_bp", "credit_spread_bp", "fx_pct"]
CORRELATION = np.array(
    [
        [1.0, -0.2, -0.7, 0.3],
        [-0.2, 1.0, 0.1, -0.1],
        [-0.7, 0.1, 1.0, -0.3],
        [0.3, -0.1, -0.3, 1.0],
    ]
)
FLOORS = np.array([2.0, 25.0, 25.0, 1.0])
DISPERSION = 0.35


def sample_shocks(mean, simulations, seed):
    centre = np.array([mean[f] for f in FACTORS], dtype=float)
    sigma = DISPERSION * np.maximum(np.abs(centre), FLOORS)
    covariance = CORRELATION * np.outer(sigma, sigma)
    draws = np.random.default_rng(seed).multivariate_normal(centre, covariance, size=simulations)
    return {f: draws[:, i] for i, f in enumerate(FACTORS)}


def tail_risk(pnl):
    out = {}
    for level in (95, 99):
        cutoff = np.percentile(pnl, 100 - level)
        out[f"var_{level}"] = round(float(-cutoff), 2)
        out[f"es_{level}"] = round(float(-pnl[pnl <= cutoff].mean()), 2)
    return out
