"""Tests for the computation engine."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app import models
from app.services.computation import compute_scenario


@pytest.fixture
def db():
    """In-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def _setup_org_and_body(db):
    org = models.Organization(name="Test Org")
    db.add(org)
    db.commit()

    body = models.Body(organization_id=org.id, name="Body A")
    db.add(body)
    db.commit()

    return org, body


def test_simple_mission_sensitivity(db):
    """One block, one mission, one scenario — direct damage only."""
    org, body = _setup_org_and_body(db)

    block = models.Block(body_id=body.id, name="Server 1")
    db.add(block)

    mission = models.Mission(body_id=body.id, name="Web Service", importance=5)
    db.add(mission)

    contrib = models.Contribution(block_id=block.id, mission_id=mission.id, strength=5)
    db.add(contrib)

    scenario = models.Scenario(name="Ransomware")
    db.add(scenario)
    db.commit()

    damage = models.ScenarioDamage(scenario_id=scenario.id, block_id=block.id, damage_pct=80.0)
    db.add(damage)
    db.commit()

    result = compute_scenario(db, scenario_id=scenario.id, mitigations_enabled=False)

    assert len(result["missions"]) == 1
    m = result["missions"][0]
    assert m["mission_name"] == "Web Service"
    assert m["capacity_pct"] == pytest.approx(20.0, abs=0.1)  # 100 - 80
    assert m["sensitivity"] == pytest.approx(5 * 80.0, abs=0.1)  # importance 5 × degradation 80


def test_propagation_through_dependency(db):
    """A depends on B. B is damaged → A should be degraded via propagation."""
    org, body = _setup_org_and_body(db)

    block_a = models.Block(body_id=body.id, name="App Server")
    block_b = models.Block(body_id=body.id, name="Database")
    db.add_all([block_a, block_b])
    db.commit()

    # A depends on B at strength 5
    dep = models.Dependency(
        dependent_block_id=block_a.id,
        dependency_block_id=block_b.id,
        strength=5,
    )
    db.add(dep)

    mission = models.Mission(body_id=body.id, name="Service", importance=4)
    db.add(mission)

    # Only block A contributes to the mission
    contrib = models.Contribution(block_id=block_a.id, mission_id=mission.id, strength=5)
    db.add(contrib)

    scenario = models.Scenario(name="DB Outage")
    db.add(scenario)
    db.commit()

    # Only B is directly damaged at 100%
    damage = models.ScenarioDamage(scenario_id=scenario.id, block_id=block_b.id, damage_pct=100.0)
    db.add(damage)
    db.commit()

    result = compute_scenario(db, scenario_id=scenario.id, mitigations_enabled=False)

    # Block B: 100% damage → 0% capacity
    # Block A: 0% direct damage, but depends on B at strength 5 → 100% propagated loss → 0% capacity
    # Mission: only A contributes → 0% capacity → sensitivity = 4 × 100 = 400
    block_a_result = next(b for b in result["blocks"] if b["block_id"] == block_a.id)
    assert block_a_result["effective_capacity_pct"] == pytest.approx(0.0, abs=0.1)

    m = result["missions"][0]
    assert m["capacity_pct"] == pytest.approx(0.0, abs=0.1)
    assert m["sensitivity"] == pytest.approx(400.0, abs=0.1)


def test_combined_scenario(db):
    """Combined scenario: 50% + 50% = 75% via residual multiplication."""
    org, body = _setup_org_and_body(db)

    block = models.Block(body_id=body.id, name="Facility")
    db.add(block)
    mission = models.Mission(body_id=body.id, name="Ops", importance=3)
    db.add(mission)
    contrib = models.Contribution(block_id=block.id, mission_id=mission.id, strength=5)
    db.add(contrib)

    s1 = models.Scenario(name="Earthquake")
    s2 = models.Scenario(name="Flood")
    db.add_all([s1, s2])
    db.commit()

    db.add(models.ScenarioDamage(scenario_id=s1.id, block_id=block.id, damage_pct=50.0))
    db.add(models.ScenarioDamage(scenario_id=s2.id, block_id=block.id, damage_pct=50.0))
    db.commit()

    combined = models.CombinedScenario(name="Quake+Flood")
    db.add(combined)
    db.commit()
    db.add(models.CombinedScenarioComponent(
        combined_scenario_id=combined.id, component_scenario_id=s1.id
    ))
    db.add(models.CombinedScenarioComponent(
        combined_scenario_id=combined.id, component_scenario_id=s2.id
    ))
    db.commit()

    result = compute_scenario(db, combined_scenario_id=combined.id, mitigations_enabled=False)

    # Combined: 1 - (1-0.5)(1-0.5) = 1 - 0.25 = 0.75 → 75%
    block_result = next(b for b in result["blocks"] if b["block_id"] == block.id)
    assert block_result["direct_damage_pct"] == pytest.approx(75.0, abs=0.1)

    m = result["missions"][0]
    assert m["capacity_pct"] == pytest.approx(25.0, abs=0.1)
    assert m["sensitivity"] == pytest.approx(3 * 75.0, abs=0.1)


def test_hardening_mitigation(db):
    """Hardening reduces effective damage."""
    org, body = _setup_org_and_body(db)

    block = models.Block(body_id=body.id, name="Datacenter")
    db.add(block)
    mission = models.Mission(body_id=body.id, name="Hosting", importance=5)
    db.add(mission)
    db.add(models.Contribution(block_id=block.id, mission_id=mission.id, strength=5))

    scenario = models.Scenario(name="Cyberattack")
    db.add(scenario)
    db.add(models.ScenarioDamage(scenario_id=scenario.id, block_id=block.id, damage_pct=80.0))
    db.commit()

    # Hardening with effect_factor=0.5 → reduces damage by 50% → effective damage = 40%
    mitigation = models.Mitigation(
        name="Firewall Upgrade",
        category="hardening",
        target_block_id=block.id,
        cost=100000.0,
        effect_factor=0.5,
        enabled=True,
    )
    db.add(mitigation)
    db.add(models.MitigationScenario(mitigation_id=mitigation.id, scenario_id=scenario.id))
    db.commit()

    # Without mitigation
    result_raw = compute_scenario(db, scenario_id=scenario.id, mitigations_enabled=False)
    assert result_raw["missions"][0]["capacity_pct"] == pytest.approx(20.0, abs=0.1)

    # With mitigation
    result_mit = compute_scenario(db, scenario_id=scenario.id, mitigations_enabled=True)
    assert result_mit["missions"][0]["capacity_pct"] == pytest.approx(60.0, abs=0.1)  # 100 - 40