"""Block CRUD + tree hierarchy endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from app.core.database import get_db
from app import models, schemas

router = APIRouter()


# ── Cycle prevention helper ──────────────────────────────────
def _is_descendant(db: Session, block_id: int, candidate_parent_id: int) -> bool:
    """Check if candidate_parent_id is a descendant of block_id.
    
    Traverses the children of block_id. If candidate_parent_id is found
    among the descendants, reparenting block_id under candidate_parent_id
    would create a cycle.
    """
    visited = set()
    stack = [block_id]
    while stack:
        current = stack.pop()
        if current in visited:
            continue
        visited.add(current)
        children = db.query(models.Block).filter(
            models.Block.parent_block_id == current
        ).all()
        for child in children:
            if child.id == candidate_parent_id:
                return True
            stack.append(child.id)
    return False


# ── CRUD ─────────────────────────────────────────────────────
@router.get("/", response_model=List[schemas.BlockOut])
def list_blocks(
    body_id: Optional[int] = Query(None),
    parent_block_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(models.Block)
    if body_id is not None:
        q = q.filter(models.Block.body_id == body_id)
    if parent_block_id is not None:
        q = q.filter(models.Block.parent_block_id == parent_block_id)
    return q.all()


@router.post("/", response_model=schemas.BlockOut)
def create_block(block: schemas.BlockCreate, db: Session = Depends(get_db)):
    # Validate parent_block_id if provided
    if block.parent_block_id is not None:
        parent = db.query(models.Block).get(block.parent_block_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent block not found")
        # Parent must be in the same body (or both external)
        if block.body_id is not None and parent.body_id is not None:
            if block.body_id != parent.body_id:
                raise HTTPException(
                    status_code=400,
                    detail="Parent block must be in the same body"
                )
        # If creating external block, parent must also be external
        if block.is_external and not parent.is_external:
            raise HTTPException(
                status_code=400,
                detail="External block cannot have an internal parent"
            )
        if not block.is_external and parent.is_external:
            raise HTTPException(
                status_code=400,
                detail="Internal block cannot have an external parent"
            )

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
    """Delete a block and all its descendants (cascade)."""
    db_block = db.query(models.Block).get(block_id)
    if not db_block:
        raise HTTPException(status_code=404, detail="Block not found")

    # Collect all descendants
    to_delete = []
    stack = [db_block]
    while stack:
        current = stack.pop()
        to_delete.append(current)
        children = db.query(models.Block).filter(
            models.Block.parent_block_id == current.id
        ).all()
        stack.extend(children)

    # Explicitly delete all FK references before deleting blocks
    # (SQLAlchemy nullifies FKs by default, which hits NOT NULL constraints)
    block_ids = [b.id for b in to_delete]
    db.query(models.Dependency).filter(
        models.Dependency.dependent_block_id.in_(block_ids)
    ).delete(synchronize_session=False)
    db.query(models.Dependency).filter(
        models.Dependency.dependency_block_id.in_(block_ids)
    ).delete(synchronize_session=False)
    db.query(models.Contribution).filter(
        models.Contribution.block_id.in_(block_ids)
    ).delete(synchronize_session=False)
    db.query(models.ScenarioDamage).filter(
        models.ScenarioDamage.block_id.in_(block_ids)
    ).delete(synchronize_session=False)
    db.query(models.Mitigation).filter(
        models.Mitigation.target_block_id.in_(block_ids)
    ).delete(synchronize_session=False)
    db.flush()

    count = len(to_delete)
    for b in to_delete:
        db.delete(b)
    db.commit()
    return {"ok": True, "deleted_count": count}


# ── Tree endpoints ────────────────────────────────────────────
@router.get("/tree/{body_id}", response_model=List[schemas.BlockTreeNode])
def get_block_tree(body_id: int, db: Session = Depends(get_db)):
    """Get the full block tree for a body as nested structure."""
    body = db.query(models.Body).get(body_id)
    if not body:
        raise HTTPException(status_code=404, detail="Body not found")

    # Get all blocks for this body
    all_blocks = db.query(models.Block).filter(
        models.Block.body_id == body_id
    ).all()

    # Build lookup: id -> block dict with children
    block_map: Dict[int, dict] = {}
    for b in all_blocks:
        block_map[b.id] = {
            "id": b.id,
            "name": b.name,
            "description": b.description,
            "parent_block_id": b.parent_block_id,
            "body_id": b.body_id,
            "is_external": b.is_external,
            "block_type": b.block_type,
            "children": [],
        }

    # Build tree
    roots = []
    for b in all_blocks:
        node = block_map[b.id]
        if b.parent_block_id is None:
            roots.append(node)
        elif b.parent_block_id in block_map:
            block_map[b.parent_block_id]["children"].append(node)

    return roots


@router.get("/{block_id}/children", response_model=List[schemas.BlockOut])
def get_block_children(block_id: int, db: Session = Depends(get_db)):
    """Get immediate children of a block."""
    block = db.query(models.Block).get(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    children = db.query(models.Block).filter(
        models.Block.parent_block_id == block_id
    ).all()
    return children


@router.get("/{block_id}/descendants", response_model=List[schemas.BlockOut])
def get_block_descendants(block_id: int, db: Session = Depends(get_db)):
    """Get all descendants of a block (recursive)."""
    block = db.query(models.Block).get(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    result = []
    stack = [block_id]
    visited = set()
    while stack:
        current_id = stack.pop()
        if current_id in visited:
            continue
        visited.add(current_id)
        children = db.query(models.Block).filter(
            models.Block.parent_block_id == current_id
        ).all()
        for child in children:
            result.append(child)
            stack.append(child.id)

    return result


@router.post("/{block_id}/reparent", response_model=schemas.BlockOut)
def reparent_block(
    block_id: int,
    req: schemas.ReparentRequest,
    db: Session = Depends(get_db)
):
    """Move a block to a new parent (or to body root if new_parent_id is None)."""
    block = db.query(models.Block).get(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    if req.new_parent_id is not None:
        new_parent = db.query(models.Block).get(req.new_parent_id)
        if not new_parent:
            raise HTTPException(status_code=404, detail="New parent block not found")

        # Cycle check: can't reparent to own descendant
        if _is_descendant(db, block_id, req.new_parent_id):
            raise HTTPException(
                status_code=400,
                detail="Cannot reparent to a descendant — would create a cycle"
            )

        # Same body check
        if block.body_id is not None and new_parent.body_id is not None:
            if block.body_id != new_parent.body_id:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot move block between bodies"
                )

        # External/internal match
        if block.is_external != new_parent.is_external:
            raise HTTPException(
                status_code=400,
                detail="Cannot reparent between external and internal blocks"
            )

    block.parent_block_id = req.new_parent_id
    db.commit()
    db.refresh(block)
    return block


@router.post("/{block_id}/apply-damage-to-descendants")
def apply_damage_to_descendants(
    block_id: int,
    req: schemas.ApplyDamageToDescendantsRequest,
    scenario_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Convenience: apply the same damage to a block and all its descendants."""
    block = db.query(models.Block).get(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    scenario = db.query(models.Scenario).get(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Collect block + all descendants
    target_ids = set()
    stack = [block_id]
    while stack:
        current_id = stack.pop()
        if current_id in target_ids:
            continue
        target_ids.add(current_id)
        children = db.query(models.Block).filter(
            models.Block.parent_block_id == current_id
        ).all()
        for child in children:
            stack.append(child.id)

    # Upsert damage for each target
    for tid in target_ids:
        existing = db.query(models.ScenarioDamage).filter(
            models.ScenarioDamage.scenario_id == scenario_id,
            models.ScenarioDamage.block_id == tid,
        ).first()
        if existing:
            existing.damage_pct = req.damage_pct
        else:
            db.add(models.ScenarioDamage(
                scenario_id=scenario_id,
                block_id=tid,
                damage_pct=req.damage_pct,
            ))

    db.commit()
    return {"ok": True, "affected_count": len(target_ids)}