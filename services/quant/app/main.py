from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.portfolio.loader import load_positions
from app.stress.engine import exposure, get_scenario, run_stress, scenarios

app = FastAPI(title="riskpulse-quant")


class StressRequest(BaseModel):
    scenario_id: str


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
        return run_stress(scenario)
    except (FileNotFoundError, ValueError) as err:
        raise HTTPException(503, str(err))
