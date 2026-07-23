"""Contribution CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=list[schemas.ContributionOut])
def list_contributions(mission_id: int = Query(None), block_id: int = Query(None), db: Session = Depends(get_db)):
    q = db.query(models.Contribution)
    if mission_id is not None:
        q = q.filter(models.Contribution.mission_id == mission_id)
    if block_id is not None:
        q = q.filter(models.Contribution.block_id == block_id)
    return q.all()


@router.post("/", response_model=schemas.ContributionOut)
def create_contribution(contrib: schemas.ContributionCreate, db: Session = Depends(get_db)):
    db_contrib = models.Contribution(**contrib.model_dump())
    db.add(db_contrib)
    db.commit()
    db.refresh(db_contrib)
    return db_contrib


@router.delete("/{contrib_id}")
def delete_contribution(contrib_id: int, db: Session = Depends(get_db)):
    db_contrib = db.query(models.Contribution).get(contrib_id)
    if not db_contrib:
        raise HTTPException(status_code=404, detail="Contribution not found")
    db.delete(db_contrib)
    db.commit()
    return {"ok": True}