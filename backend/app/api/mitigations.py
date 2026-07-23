"""Mitigation CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from sqlalchemy.orm import Session
from app.core.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=list[schemas.MitigationOut])
def list_mitigations(block_id: int = Query(None), db: Session = Depends(get_db)):
    q = db.query(models.Mitigation)
    if block_id is not None:
        q = q.filter(models.Mitigation.target_block_id == block_id)
    mitigations = q.all()
    result = []
    for m in mitigations:
        result.append(schemas.MitigationOut(
            **{c.name: getattr(m, c.name) for c in m.__table__.columns},
            scenario_ids=[ms.scenario_id for ms in m.scenario_links],
        ))
    return result


@router.post("/", response_model=schemas.MitigationOut)
def create_mitigation(mit: schemas.MitigationCreate, db: Session = Depends(get_db)):
    data = mit.model_dump(exclude={"scenario_ids"})
    db_mit = models.Mitigation(**data)
    db.add(db_mit)
    db.commit()
    db.refresh(db_mit)

    for sid in mit.scenario_ids:
        link = models.MitigationScenario(mitigation_id=db_mit.id, scenario_id=sid)
        db.add(link)

    db.commit()
    db.refresh(db_mit)
    return schemas.MitigationOut(
        **{c.name: getattr(db_mit, c.name) for c in db_mit.__table__.columns},
        scenario_ids=mit.scenario_ids,
    )


@router.put("/{mit_id}", response_model=schemas.MitigationOut)
def update_mitigation(mit_id: int, mit: schemas.MitigationBase, db: Session = Depends(get_db)):
    db_mit = db.query(models.Mitigation).get(mit_id)
    if not db_mit:
        raise HTTPException(status_code=404, detail="Mitigation not found")
    for key, value in mit.model_dump(exclude_unset=True).items():
        setattr(db_mit, key, value)
    db.commit()
    db.refresh(db_mit)
    return schemas.MitigationOut(
        **{c.name: getattr(db_mit, c.name) for c in db_mit.__table__.columns},
        scenario_ids=[ms.scenario_id for ms in db_mit.scenario_links],
    )


@router.delete("/{mit_id}")
def delete_mitigation(mit_id: int, db: Session = Depends(get_db)):
    db_mit = db.query(models.Mitigation).get(mit_id)
    if not db_mit:
        raise HTTPException(status_code=404, detail="Mitigation not found")
    db.delete(db_mit)
    db.commit()
    return {"ok": True}


@router.post("/{mit_id}/toggle", response_model=schemas.MitigationOut)
def toggle_mitigation(mit_id: int, db: Session = Depends(get_db)):
    db_mit = db.query(models.Mitigation).get(mit_id)
    if not db_mit:
        raise HTTPException(status_code=404, detail="Mitigation not found")
    db_mit.enabled = not db_mit.enabled
    db.commit()
    db.refresh(db_mit)
    return schemas.MitigationOut(
        **{c.name: getattr(db_mit, c.name) for c in db_mit.__table__.columns},
        scenario_ids=[ms.scenario_id for ms in db_mit.scenario_links],
    )