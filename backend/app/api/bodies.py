"""Body CRUD endpoints."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=List[schemas.BodyOut])
def list_bodies(db: Session = Depends(get_db)):
    return db.query(models.Body).all()


@router.post("/", response_model=schemas.BodyOut)
def create_body(body: schemas.BodyCreate, db: Session = Depends(get_db)):
    db_body = models.Body(**body.model_dump())
    db.add(db_body)
    db.commit()
    db.refresh(db_body)
    return db_body


@router.get("/{body_id}", response_model=schemas.BodyOut)
def get_body(body_id: int, db: Session = Depends(get_db)):
    body = db.query(models.Body).get(body_id)
    if not body:
        raise HTTPException(status_code=404, detail="Body not found")
    return body


@router.put("/{body_id}", response_model=schemas.BodyOut)
def update_body(body_id: int, body: schemas.BodyBase, db: Session = Depends(get_db)):
    db_body = db.query(models.Body).get(body_id)
    if not db_body:
        raise HTTPException(status_code=404, detail="Body not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(db_body, key, value)
    db.commit()
    db.refresh(db_body)
    return db_body


@router.delete("/{body_id}")
def delete_body(body_id: int, db: Session = Depends(get_db)):
    db_body = db.query(models.Body).get(body_id)
    if not db_body:
        raise HTTPException(status_code=404, detail="Body not found")

    # Collect all block IDs for this body
    block_ids = [b.id for b in db.query(models.Block).filter(models.Block.body_id == body_id).all()]

    if block_ids:
        # Delete dependencies referencing these blocks
        db.query(models.Dependency).filter(
            models.Dependency.dependent_block_id.in_(block_ids)
        ).delete(synchronize_session=False)
        db.query(models.Dependency).filter(
            models.Dependency.dependency_block_id.in_(block_ids)
        ).delete(synchronize_session=False)
        # Delete contributions referencing these blocks
        db.query(models.Contribution).filter(
            models.Contribution.block_id.in_(block_ids)
        ).delete(synchronize_session=False)
        # Delete scenario damages referencing these blocks
        db.query(models.ScenarioDamage).filter(
            models.ScenarioDamage.block_id.in_(block_ids)
        ).delete(synchronize_session=False)
        # Delete mitigations targeting these blocks
        db.query(models.Mitigation).filter(
            models.Mitigation.target_block_id.in_(block_ids)
        ).delete(synchronize_session=False)
        # Delete the blocks themselves
        db.query(models.Block).filter(models.Block.body_id == body_id).delete(synchronize_session=False)

    # Delete missions owned by this body
    db.query(models.Mission).filter(models.Mission.body_id == body_id).delete(synchronize_session=False)

    db.delete(db_body)
    db.commit()
    return {"ok": True}