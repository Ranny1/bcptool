"""Tests for hierarchical block tree operations."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app import models
from app.api.blocks import _is_descendant


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def _setup(db):
    org = models.Organization(name="Test Org")
    db.add(org)
    db.commit()
    db.refresh(org)
    body = models.Body(organization_id=org.id, name="IT")
    db.add(body)
    db.commit()
    db.refresh(body)
    return org, body


def test_create_child_block(db):
    """Blocks can have parent_block_id set on creation."""
    org, body = _setup(db)

    parent = models.Block(body_id=body.id, name="Infrastructure")
    db.add(parent)
    db.commit()
    db.refresh(parent)

    child = models.Block(body_id=body.id, name="Datacenter", parent_block_id=parent.id)
    db.add(child)
    db.commit()
    db.refresh(child)

    assert child.parent_block_id == parent.id
    assert child.body_id == body.id


def test_get_descendants(db):
    """Get all descendants of a block recursively."""
    org, body = _setup(db)

    a = models.Block(body_id=body.id, name="A")
    db.add(a)
    db.commit()
    db.refresh(a)

    b = models.Block(body_id=body.id, name="B", parent_block_id=a.id)
    db.add(b)
    c = models.Block(body_id=body.id, name="C", parent_block_id=a.id)
    db.add(c)
    db.commit()
    db.refresh(b)
    db.refresh(c)

    d = models.Block(body_id=body.id, name="D", parent_block_id=b.id)
    db.add(d)
    db.commit()
    db.refresh(d)

    # Collect descendants of A
    result = []
    stack = [a.id]
    visited = set()
    while stack:
        cid = stack.pop()
        if cid in visited:
            continue
        visited.add(cid)
        children = db.query(models.Block).filter(models.Block.parent_block_id == cid).all()
        for ch in children:
            result.append(ch)
            stack.append(ch.id)

    names = sorted(r.name for r in result)
    assert names == ["B", "C", "D"]


def test_cycle_prevention(db):
    """_is_descendant correctly detects would-be cycles."""
    org, body = _setup(db)

    a = models.Block(body_id=body.id, name="A")
    db.add(a)
    db.commit()
    db.refresh(a)

    b = models.Block(body_id=body.id, name="B", parent_block_id=a.id)
    db.add(b)
    db.commit()
    db.refresh(b)

    c = models.Block(body_id=body.id, name="C", parent_block_id=b.id)
    db.add(c)
    db.commit()
    db.refresh(c)

    # C is a descendant of A, so reparenting A under C should be blocked
    # _is_descendant(db, block_id, candidate_parent_id) = is candidate_parent a descendant of block_id?
    # Reparenting A under C: is C a descendant of A? Yes → cycle!
    assert _is_descendant(db, a.id, c.id) is True
    # Reparenting A under B: is B a descendant of A? Yes → cycle!
    assert _is_descendant(db, a.id, b.id) is True
    # Reparenting C under A: is A a descendant of C? No → safe
    assert _is_descendant(db, c.id, a.id) is False


def test_delete_cascades_to_children(db):
    """Deleting a block should also delete its descendants."""
    org, body = _setup(db)

    parent = models.Block(body_id=body.id, name="Parent")
    db.add(parent)
    db.commit()
    db.refresh(parent)

    child1 = models.Block(body_id=body.id, name="Child1", parent_block_id=parent.id)
    db.add(child1)
    db.commit()
    db.refresh(child1)

    child2 = models.Block(body_id=body.id, name="Child2", parent_block_id=child1.id)
    db.add(child2)
    db.commit()
    db.refresh(child2)

    # Collect all to delete
    to_delete = []
    stack = [parent]
    while stack:
        cur = stack.pop()
        to_delete.append(cur)
        children = db.query(models.Block).filter(models.Block.parent_block_id == cur.id).all()
        stack.extend(children)

    assert len(to_delete) == 3
    for b in to_delete:
        db.delete(b)
    db.commit()

    remaining = db.query(models.Block).all()
    assert len(remaining) == 0


def test_tree_structure_nested(db):
    """Build a 3-level tree and verify structure."""
    org, body = _setup(db)

    # Level 1
    l1 = models.Block(body_id=body.id, name="IT Infra")
    db.add(l1)
    db.commit()
    db.refresh(l1)

    # Level 2
    l2a = models.Block(body_id=body.id, name="Network", parent_block_id=l1.id)
    l2b = models.Block(body_id=body.id, name="Servers", parent_block_id=l1.id)
    db.add_all([l2a, l2b])
    db.commit()
    db.refresh(l2a)
    db.refresh(l2b)

    # Level 3
    l3 = models.Block(body_id=body.id, name="Switch-1", parent_block_id=l2a.id)
    db.add(l3)
    db.commit()

    # Verify tree
    all_blocks = db.query(models.Block).filter(models.Block.body_id == body.id).all()
    block_map = {b.id: b for b in all_blocks}

    roots = [b for b in all_blocks if b.parent_block_id is None]
    assert len(roots) == 1
    assert roots[0].name == "IT Infra"

    l2_children = [b for b in all_blocks if b.parent_block_id == l1.id]
    assert len(l2_children) == 2
    assert sorted(c.name for c in l2_children) == ["Network", "Servers"]

    l3_children = [b for b in all_blocks if b.parent_block_id == l2a.id]
    assert len(l3_children) == 1
    assert l3_children[0].name == "Switch-1"