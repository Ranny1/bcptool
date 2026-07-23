"""
Computation engine — scenario impact propagation and mission sensitivity.

This is the core calculation module. Given a scenario (or combined scenario),
it computes:
1. Direct damage per block (with combined-scenario residual multiplication)
2. Effective capacity per block (after mitigations)
3. Propagated impact through the dependency graph (linear cascade, 3 passes)
4. Mission capacity and sensitivity scores
"""
from typing import Optional, List, Dict, Tuple
from sqlalchemy.orm import Session
from app.models import (
    Block, Dependency, Contribution, Mission, Scenario, ScenarioDamage,
    CombinedScenario, CombinedScenarioComponent, Mitigation, MitigationScenario
)


def compute_scenario(
    db: Session,
    scenario_id: Optional[int] = None,
    combined_scenario_id: Optional[int] = None,
    mitigations_enabled: bool = True,
    enabled_mitigation_ids: Optional[List[int]] = None,
    propagation_passes: int = 3,
) -> dict:
    """
    Run the full computation for a scenario or combined scenario.
    Returns a dict with block results and mission results.
    """
    # ── 1. Gather direct damage per block ────────────────────
    block_damage: Dict[int, float] = {}  # block_id -> damage_pct (0-100)

    all_blocks = db.query(Block).all()
    for b in all_blocks:
        block_damage[b.id] = 0.0

    if combined_scenario_id:
        # Combined scenario: residual multiplication
        combined = db.query(CombinedScenario).get(combined_scenario_id)
        if not combined:
            raise ValueError(f"Combined scenario {combined_scenario_id} not found")

        # Gather damages from each component scenario
        component_damages: Dict[int, List[float]] = {}  # block_id -> [damage from each component]
        for comp in combined.components:
            comp_damages = db.query(ScenarioDamage).filter(
                ScenarioDamage.scenario_id == comp.component_scenario_id
            ).all()
            for cd in comp_damages:
                component_damages.setdefault(cd.block_id, []).append(cd.damage_pct / 100.0)

        # Residual multiplication: combined = 1 - Π(1 - dᵢ)
        for block_id, dmg_list in component_damages.items():
            residual = 1.0
            for d in dmg_list:
                residual *= (1.0 - d)
            block_damage[block_id] = (1.0 - residual) * 100.0

    elif scenario_id:
        scenario = db.query(Scenario).get(scenario_id)
        if not scenario:
            raise ValueError(f"Scenario {scenario_id} not found")

        for sd in scenario.damages:
            block_damage[sd.block_id] = sd.damage_pct

    else:
        raise ValueError("Either scenario_id or combined_scenario_id must be provided")

    # ── 2. Apply mitigations ────────────────────────────────
    if mitigations_enabled:
        block_damage = _apply_mitigations(
            db, block_damage, scenario_id, combined_scenario_id, enabled_mitigation_ids
        )

    # ── 3. Build dependency graph ────────────────────────────
    # adjacency: dependent_block_id -> [(dependency_block_id, strength)]
    deps_out: Dict[int, List[Tuple[int, int]]] = {}
    all_deps = db.query(Dependency).all()
    for dep in all_deps:
        deps_out.setdefault(dep.dependent_block_id, []).append(
            (dep.dependency_block_id, dep.strength)
        )

    # ── 4. Propagate impact (linear cascade, N passes) ──────
    # effective_capacity starts as 100 - direct_damage
    eff_capacity: Dict[int, float] = {}
    for b in all_blocks:
        eff_capacity[b.id] = max(0.0, 100.0 - block_damage.get(b.id, 0.0))

    for _pass in range(propagation_passes):
        new_capacity = dict(eff_capacity)
        for block_id, current_cap in eff_capacity.items():
            # Sum propagated losses from dependencies
            total_loss = 0.0
            for dep_block_id, strength in deps_out.get(block_id, []):
                dep_cap = eff_capacity.get(dep_block_id, 100.0)
                dep_loss = (100.0 - dep_cap) * (strength / 5.0)
                total_loss += dep_loss

            # Total loss capped at 100%
            total_loss = min(total_loss, 100.0)
            new_capacity[block_id] = max(0.0, 100.0 - block_damage.get(block_id, 0.0) - total_loss)

        eff_capacity = new_capacity

    # ── 5. Compute mission capacity & sensitivity ──────────
    # contributions: mission_id -> [(block_id, strength)]
    mission_contribs: Dict[int, List[Tuple[int, int]]] = {}
    all_contribs = db.query(Contribution).all()
    for c in all_contribs:
        mission_contribs.setdefault(c.mission_id, []).append((c.block_id, c.strength))

    all_missions = db.query(Mission).all()

    mission_results = []
    for m in all_missions:
        contribs = mission_contribs.get(m.id, [])
        if not contribs:
            capacity = 100.0
        else:
            weighted_sum = 0.0
            weight_total = 0.0
            for block_id, strength in contribs:
                cap = eff_capacity.get(block_id, 100.0)
                weighted_sum += cap * (strength / 5.0)
                weight_total += (strength / 5.0)
            capacity = weighted_sum / weight_total if weight_total > 0 else 100.0

        sensitivity = m.importance * (100.0 - capacity)
        mission_results.append({
            "mission_id": m.id,
            "mission_name": m.name,
            "importance": m.importance,
            "capacity_pct": round(capacity, 2),
            "sensitivity": round(sensitivity, 2),
        })

    # Sort by sensitivity descending (worst first)
    mission_results.sort(key=lambda x: x["sensitivity"], reverse=True)

    # ── 6. Build block results ───────────────────────────────
    block_results = []
    for b in all_blocks:
        block_results.append({
            "block_id": b.id,
            "block_name": b.name,
            "direct_damage_pct": round(block_damage.get(b.id, 0.0), 2),
            "effective_capacity_pct": round(eff_capacity.get(b.id, 100.0), 2),
        })

    return {
        "blocks": block_results,
        "missions": mission_results,
    }


def _apply_mitigations(
    db: Session,
    block_damage: Dict[int, float],
    scenario_id: Optional[int],
    combined_scenario_id: Optional[int],
    enabled_mitigation_ids: Optional[List[int]],
) -> Dict[int, float]:
    """Apply mitigation effects to block damage values."""
    query = db.query(Mitigation).filter(Mitigation.enabled == True)
    if enabled_mitigation_ids is not None:
        query = query.filter(Mitigation.id.in_(enabled_mitigation_ids))

    mitigations = query.all()

    # Determine which scenario IDs are in scope
    in_scope_scenario_ids = set()
    if scenario_id:
        in_scope_scenario_ids.add(scenario_id)
    elif combined_scenario_id:
        combined = db.query(CombinedScenario).get(combined_scenario_id)
        if combined:
            for comp in combined.components:
                in_scope_scenario_ids.add(comp.component_scenario_id)

    for mit in mitigations:
        # Check if this mitigation applies to any in-scope scenario
        mit_scenario_ids = {ms.scenario_id for ms in mit.scenario_links}
        if mit_scenario_ids and not (mit_scenario_ids & in_scope_scenario_ids):
            continue  # mitigation not applicable to this scenario

        if not mit.target_block_id:
            # Dependency-targeted mitigations: skip for now (v1)
            # TODO: apply to propagated loss
            continue

        block_id = mit.target_block_id
        original_damage = block_damage.get(block_id, 0.0)

        if mit.category == "redundancy":
            # effective_damage = damage × (1 - effect_factor)
            block_damage[block_id] = original_damage * (1.0 - mit.effect_factor)

        elif mit.category == "hardening":
            # effective_damage = damage × (1 - effect_factor)
            block_damage[block_id] = original_damage * (1.0 - mit.effect_factor)

        elif mit.category == "rapid_recovery":
            # effective_damage = damage × (1 - effect_factor)
            block_damage[block_id] = original_damage * (1.0 - mit.effect_factor)

        elif mit.category == "buffering":
            # Buffer sets a floor on effective capacity, which means a ceiling on effective damage
            if mit.buffer_floor is not None:
                max_damage = 100.0 - mit.buffer_floor
                block_damage[block_id] = min(original_damage, max_damage)

        elif mit.category == "free_form":
            # Expert-defined: use effect_factor as a generic reduction
            block_damage[block_id] = original_damage * (1.0 - mit.effect_factor)

    return block_damage