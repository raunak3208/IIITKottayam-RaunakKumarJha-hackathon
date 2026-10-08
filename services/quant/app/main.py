from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.portfolio.loader import load_positions
from app.simulation.monte_carlo import FACTORS
from app.stress.engine import exposure, get_scenario, reverse, run_stress, scenarios, sensitivity

app = FastAPI(title="riskpulse-quant")


class StressRequest(BaseModel):
    scenario_id: str
    impact: float | None = Field(default=None, ge=1, le=10)
    confidence: float | None = Field(default=None, ge=0, le=1)
    tickers: list[str] = []
    simulations: int = Field(default=2000, ge=100, le=20000)
    shocks: dict[str, float] | None = None

    @field_validator("shocks")
    @classmethod
    def all_factors(cls, value):
        if value is not None and set(value) != set(FACTORS):
            raise ValueError(f"shocks must contain exactly {FACTORS}")
        return value


class SensitivityRequest(BaseModel):
    scenario_id: str
    tickers: list[str] = []
    shocks: dict[str, float] | None = None


class ReverseRequest(BaseModel):
    scenario_id: str
    target_loss_pct: float = Field(gt=0, le=100)
    tickers: list[str] = []


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/v1/scenarios")
def list_scenarios():
    return {"items": scenarios()}


@app.get("/v1/portfolio")
def portfolio():
    try:
        positions = load_positions()
    except (FileNotFoundError, ValueError) as err:
        raise HTTPException(503, str(err))
    return {
        "positions": len(positions),
        "total_value": round(sum(p["market_value"] for p in positions), 2),
        "exposure": exposure(positions),
    }


@app.post("/v1/stress")
def stress(request: StressRequest):
    scenario = get_scenario(request.scenario_id)
    if scenario is None:
        raise HTTPException(404, "unknown scenario")
    try:
        return run_stress(
            scenario, request.impact, request.confidence, request.tickers, request.simulations,
            custom_shocks=request.shocks,
        )
    except (FileNotFoundError, ValueError) as err:
        raise HTTPException(503, str(err))


def _scenario(scenario_id):
    scenario = get_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(404, "unknown scenario")
    return scenario


@app.post("/v1/stress/sensitivity")
def stress_sensitivity(request: SensitivityRequest):
    try:
        return sensitivity(_scenario(request.scenario_id), request.tickers, request.shocks)
    except (FileNotFoundError, ValueError) as err:
        raise HTTPException(503, str(err))


@app.post("/v1/stress/reverse")
def stress_reverse(request: ReverseRequest):
    try:
        return reverse(_scenario(request.scenario_id), request.target_loss_pct, request.tickers)
    except (FileNotFoundError, ValueError) as err:
        raise HTTPException(503, str(err))
