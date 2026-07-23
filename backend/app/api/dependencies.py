"""Dependency CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from sqlalchemy.orm import Session
from app.core.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=List[schemas.DependencyOut])
def list_dependencies(block_id: int = Query(None), db: Session = Depends(get_db)):
    q = db.query(models.Dependency)
    if block_id is not None:
        q = q.filter(
            (models.Dependency.dependent_block_id == block_id) |
            (models.Dependency.dependency_block_id == block_id)
        )
    return q.all()


@router.post("/", response_model=schemas.DependencyOut)
def create_dependency(dep: schemas.DependencyCreate, db: Session = Depends(get_db)):
    if dep.dependent_block_id == dep.dependency_block_id:
        raise HTTPException(status_code=400, detail="Block cannot depend on itself")
    db_dep = models.Dependency(**dep.model_dump())
    db.add(db_dep)
    db.commit()
    db.refresh(db_dep)
    return db_dep


@router.put("/{dep_id}", response_model=schemas.DependencyOut)
def update_dependency(dep_id: int, dep: schemas.DependencyBase, db: Session = Depends(get_db)):
    db_dep = db.query(models.Dependency).get(dep_id)
    if not db_dep:
        raise HTTPException(status_code=404, detail="Dependency not found")
    for key, value in dep.model_dump(exclude_unset=True).items():
        setattr(db_dep, key, value)
    db.commit()
    db.refresh(db_dep)
    return db_dep


@router.delete("/{dep_id}")
def delete_dependency(dep_id: int, db: Session = Depends(get_db)):
    db_dep = db.query(models.Dependency).get(dep_id)
    if not db_dep:
        raise HTTPException(status_code=404, detail="Dependency not found")
    db.delete(db_dep)
    db.commit()
    return {"ok": True}