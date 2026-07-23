"""Pydantic schemas for API request/response validation."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


# ── Organization ──────────────────────────────────────────────
class OrganizationBase(BaseModel):
    name: str
    description: Optional[str] = None

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationOut(OrganizationBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ── Body ──────────────────────────────────────────────────────
class BodyBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_body_id: Optional[int] = None

class BodyCreate(BodyBase):
    organization_id: int

class BodyOut(BodyBase):
    id: int
    organization_id: int
    model_config = ConfigDict(from_attributes=True)


# ── Mission ──────────────────────────────────────────────────
class MissionBase(BaseModel):
    name: str
    description: Optional[str] = None
    importance: int = Field(default=3, ge=1, le=5)

class MissionCreate(MissionBase):
    organization_id: Optional[int] = None
    body_id: Optional[int] = None

class MissionOut(MissionBase):
    id: int
    organization_id: Optional[int] = None
    body_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


# ── Block ─────────────────────────────────────────────────────
class BlockBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_block_id: Optional[int] = None
    is_external: bool = False
    block_type: Optional[str] = None

class BlockCreate(BlockBase):
    body_id: Optional[int] = None  # None for external

class BlockOut(BlockBase):
    id: int
    body_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


# ── Dependency ───────────────────────────────────────────────
class DependencyBase(BaseModel):
    dependent_block_id: int
    dependency_block_id: int
    strength: int = Field(default=3, ge=1, le=5)
    description: Optional[str] = None

class DependencyCreate(DependencyBase):
    pass

class DependencyOut(DependencyBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ── Contribution ─────────────────────────────────────────────
class ContributionBase(BaseModel):
    block_id: int
    mission_id: int
    strength: int = Field(default=3, ge=1, le=5)

class ContributionCreate(ContributionBase):
    pass

class ContributionOut(ContributionBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ── Scenario ─────────────────────────────────────────────────
class ScenarioBase(BaseModel):
    name: str
    description: Optional[str] = None

class ScenarioCreate(ScenarioBase):
    pass

class ScenarioOut(ScenarioBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ── Scenario Damage ──────────────────────────────────────────
class ScenarioDamageBase(BaseModel):
    block_id: int
    damage_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    notes: Optional[str] = None

class ScenarioDamageCreate(ScenarioDamageBase):
    pass

class ScenarioDamageOut(ScenarioDamageBase):
    id: int
    scenario_id: int
    model_config = ConfigDict(from_attributes=True)

class ScenarioDamageBulkUpdate(BaseModel):
    damages: List[ScenarioDamageCreate]


# ── Combined Scenario ────────────────────────────────────────
class CombinedScenarioBase(BaseModel):
    name: str
    description: Optional[str] = None

class CombinedScenarioCreate(CombinedScenarioBase):
    component_scenario_ids: List[int]

class CombinedScenarioOut(CombinedScenarioBase):
    id: int
    component_scenario_ids: List[int] = []
    model_config = ConfigDict(from_attributes=True)


# ── Mitigation ───────────────────────────────────────────────
class MitigationBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str  # redundancy, hardening, buffering, rapid_recovery, free_form
    target_block_id: Optional[int] = None
    target_dependency_id: Optional[int] = None
    cost: float = 0.0
    effect_factor: float = 0.0
    buffer_floor: Optional[float] = None
    free_form_desc: Optional[str] = None
    enabled: bool = True

class MitigationCreate(MitigationBase):
    scenario_ids: List[int] = []

class MitigationOut(MitigationBase):
    id: int
    scenario_ids: List[int] = []
    model_config = ConfigDict(from_attributes=True)


# ── Computation ──────────────────────────────────────────────
class ComputeRequest(BaseModel):
    scenario_id: Optional[int] = None
    combined_scenario_id: Optional[int] = None
    mitigations_enabled: bool = True
    enabled_mitigation_ids: Optional[List[int]] = None

class BlockResult(BaseModel):
    block_id: int
    block_name: str
    direct_damage_pct: float
    effective_capacity_pct: float

class MissionResult(BaseModel):
    mission_id: int
    mission_name: str
    importance: int
    capacity_pct: float
    sensitivity: float

class ComputeResult(BaseModel):
    blocks: List[BlockResult]
    missions: List[MissionResult]


# ── User ──────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "expert"  # or "manager"

class UserOut(BaseModel):
    id: int
    username: str
    role: str
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"