"""Scenario and combined scenario CRUD endpoints."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app import models, schemas

router = APIRouter()
router_combined = APIRouter()


# ── Scenarios ────────────────────────────────────────────────
@router.get("/", response_model=List[schemas.ScenarioOut])
def list_scenarios(db: Session = Depends(get_db)):
    return db.query(models.Scenario).all()


@router.post("/", response_model=schemas.ScenarioOut)
def create_scenario(scenario: schemas.ScenarioCreate, db: Session = Depends(get_db)):
    db_scenario = models.Scenario(**scenario.model_dump())
    db.add(db_scenario)
    db.commit()
    db.refresh(db_scenario)
    return db_scenario


@router.get("/{scenario_id}", response_model=schemas.ScenarioOut)
def get_scenario(scenario_id: int, db: Session = Depends(get_db)):
    s = db.query(models.Scenario).get(scenario_id)
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return s


@router.put("/{scenario_id}", response_model=schemas.ScenarioOut)
def update_scenario(scenario_id: int, scenario: schemas.ScenarioBase, db: Session = Depends(get_db)):
    db_s = db.query(models.Scenario).get(scenario_id)
    if not db_s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    for key, value in scenario.model_dump(exclude_unset=True).items():
        setattr(db_s, key, value)
    db.commit()
    db.refresh(db_s)
    return db_s


@router.delete("/{scenario_id}")
def delete_scenario(scenario_id: int, db: Session = Depends(get_db)):
    db_s = db.query(models.Scenario).get(scenario_id)
    if not db_s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    db.delete(db_s)
    db.commit()
    return {"ok": True}


# ── Scenario Damage ──────────────────────────────────────────
@router.get("/{scenario_id}/damages", response_model=List[schemas.ScenarioDamageOut])
def list_damages(scenario_id: int, db: Session = Depends(get_db)):
    return db.query(models.ScenarioDamage).filter(
        models.ScenarioDamage.scenario_id == scenario_id
    ).all()


@router.put("/{scenario_id}/damages", response_model=List[schemas.ScenarioDamageOut])
def bulk_update_damages(scenario_id: int, bulk: schemas.ScenarioDamageBulkUpdate, db: Session = Depends(get_db)):
    # Delete existing damages for this scenario
    db.query(models.ScenarioDamage).filter(
        models.ScenarioDamage.scenario_id == scenario_id
    ).delete()

    # Insert new damages
    new_damages = []
    for d in bulk.damages:
        sd = models.ScenarioDamage(
            scenario_id=scenario_id,
            block_id=d.block_id,
            damage_pct=d.damage_pct,
            notes=d.notes,
        )
        db.add(sd)
        new_damages.append(sd)

    db.commit()
    for sd in new_damages:
        db.refresh(sd)
    return new_damages


@router.delete("/{scenario_id}/damages/{block_id}")
def delete_damage(scenario_id: int, block_id: int, db: Session = Depends(get_db)):
    sd = db.query(models.ScenarioDamage).filter(
        models.ScenarioDamage.scenario_id == scenario_id,
        models.ScenarioDamage.block_id == block_id,
    ).first()
    if sd:
        db.delete(sd)
        db.commit()
    return {"ok": True}


# ── Combined Scenarios ───────────────────────────────────────
@router_combined.get("/", response_model=List[schemas.CombinedScenarioOut])
def list_combined_scenarios(db: Session = Depends(get_db)):
    combined_list = db.query(models.CombinedScenario).all()
    result = []
    for cs in combined_list:
        out = schemas.CombinedScenarioOut(
            id=cs.id, name=cs.name, description=cs.description,
            component_scenario_ids=[c.component_scenario_id for c in cs.components]
        )
        result.append(out)
    return result


@router_combined.post("/", response_model=schemas.CombinedScenarioOut)
def create_combined_scenario(cs: schemas.CombinedScenarioCreate, db: Session = Depends(get_db)):
    db_cs = models.CombinedScenario(name=cs.name, description=cs.description)
    db.add(db_cs)
    db.commit()
    db.refresh(db_cs)

    for sid in cs.component_scenario_ids:
        comp = models.CombinedScenarioComponent(
            combined_scenario_id=db_cs.id,
            component_scenario_id=sid,
        )
        db.add(comp)

    db.commit()
    return schemas.CombinedScenarioOut(
        id=db_cs.id, name=db_cs.name, description=db_cs.description,
        component_scenario_ids=cs.component_scenario_ids,
    )


@router_combined.get("/{cs_id}", response_model=schemas.CombinedScenarioOut)
def get_combined_scenario(cs_id: int, db: Session = Depends(get_db)):
    cs = db.query(models.CombinedScenario).get(cs_id)
    if not cs:
        raise HTTPException(status_code=404, detail="Combined scenario not found")
    return schemas.CombinedScenarioOut(
        id=cs.id, name=cs.name, description=cs.description,
        component_scenario_ids=[c.component_scenario_id for c in cs.components]
    )


@router_combined.delete("/{cs_id}")
def delete_combined_scenario(cs_id: int, db: Session = Depends(get_db)):
    cs = db.query(models.CombinedScenario).get(cs_id)
    if not cs:
        raise HTTPException(status_code=404, detail="Combined scenario not found")
    db.delete(cs)
    db.commit()
    return {"ok": True}