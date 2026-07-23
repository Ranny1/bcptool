"""Mission CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from sqlalchemy.orm import Session
from app.core.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=list[schemas.MissionOut])
def list_missions(body_id: int = Query(None), include_org: bool = True, db: Session = Depends(get_db)):
    q = db.query(models.Mission)
    if body_id is not None:
        q = q.filter(models.Mission.body_id == body_id)
    elif not include_org:
        q = q.filter(models.Mission.body_id.isnot(None))
    return q.all()


@router.post("/", response_model=schemas.MissionOut)
def create_mission(mission: schemas.MissionCreate, db: Session = Depends(get_db)):
    if mission.organization_id is None and mission.body_id is None:
        raise HTTPException(status_code=400, detail="Either organization_id or body_id must be set")
    if mission.organization_id is not None and mission.body_id is not None:
        raise HTTPException(status_code=400, detail="Only one of organization_id or body_id can be set")
    db_mission = models.Mission(**mission.model_dump())
    db.add(db_mission)
    db.commit()
    db.refresh(db_mission)
    return db_mission


@router.get("/{mission_id}", response_model=schemas.MissionOut)
def get_mission(mission_id: int, db: Session = Depends(get_db)):
    mission = db.query(models.Mission).get(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    return mission


@router.put("/{mission_id}", response_model=schemas.MissionOut)
def update_mission(mission_id: int, mission: schemas.MissionBase, db: Session = Depends(get_db)):
    db_mission = db.query(models.Mission).get(mission_id)
    if not db_mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    for key, value in mission.model_dump(exclude_unset=True).items():
        setattr(db_mission, key, value)
    db.commit()
    db.refresh(db_mission)
    return db_mission


@router.delete("/{mission_id}")
def delete_mission(mission_id: int, db: Session = Depends(get_db)):
    db_mission = db.query(models.Mission).get(mission_id)
    if not db_mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    db.delete(db_mission)
    db.commit()
    return {"ok": True}