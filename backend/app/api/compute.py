"""Computation endpoint — run scenario and return results."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app import schemas
from app.services.computation import compute_scenario

router = APIRouter()


@router.post("/", response_model=schemas.ComputeResult)
def run_compute(req: schemas.ComputeRequest, db: Session = Depends(get_db)):
    if not req.scenario_id and not req.combined_scenario_id:
        raise HTTPException(status_code=400, detail="Either scenario_id or combined_scenario_id required")

    try:
        result = compute_scenario(
            db=db,
            scenario_id=req.scenario_id,
            combined_scenario_id=req.combined_scenario_id,
            mitigations_enabled=req.mitigations_enabled,
            enabled_mitigation_ids=req.enabled_mitigation_ids,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))