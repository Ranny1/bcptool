"""Block CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=list[schemas.BlockOut])
def list_blocks(body_id: int = Query(None), db: Session = Depends(get_db)):
    q = db.query(models.Block)
    if body_id is not None:
        q = q.filter(models.Block.body_id == body_id)
    return q.all()


@router.post("/", response_model=schemas.BlockOut)
def create_block(block: schemas.BlockCreate, db: Session = Depends(get_db)):
    db_block = models.Block(**block.model_dump())
    db.add(db_block)
    db.commit()
    db.refresh(db_block)
    return db_block


@router.get("/{block_id}", response_model=schemas.BlockOut)
def get_block(block_id: int, db: Session = Depends(get_db)):
    block = db.query(models.Block).get(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    return block


@router.put("/{block_id}", response_model=schemas.BlockOut)
def update_block(block_id: int, block: schemas.BlockBase, db: Session = Depends(get_db)):
    db_block = db.query(models.Block).get(block_id)
    if not db_block:
        raise HTTPException(status_code=404, detail="Block not found")
    for key, value in block.model_dump(exclude_unset=True).items():
        setattr(db_block, key, value)
    db.commit()
    db.refresh(db_block)
    return db_block


@router.delete("/{block_id}")
def delete_block(block_id: int, db: Session = Depends(get_db)):
    db_block = db.query(models.Block).get(block_id)
    if not db_block:
        raise HTTPException(status_code=404, detail="Block not found")
    db.delete(db_block)
    db.commit()
    return {"ok": True}