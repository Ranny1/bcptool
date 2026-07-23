"""SQLAlchemy ORM models matching the database schema in the spec."""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime,
    ForeignKey, UniqueConstraint, CheckConstraint, Table
)
from sqlalchemy.orm import relationship
from app.core.database import Base


# ── Organization ──────────────────────────────────────────────
class Organization(Base):
    __tablename__ = "organization"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    bodies = relationship("Body", back_populates="organization")
    missions = relationship("Mission", back_populates="organization")


# ── Body ──────────────────────────────────────────────────────
class Body(Base):
    __tablename__ = "body"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    parent_body_id = Column(Integer, ForeignKey("body.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="bodies")
    parent = relationship("Body", remote_side=[id], backref="children")
    blocks = relationship("Block", back_populates="body")
    missions = relationship("Mission", back_populates="body")


# ── Mission ──────────────────────────────────────────────────
class Mission(Base):
    __tablename__ = "mission"
    __table_args__ = (
        CheckConstraint(
            "(organization_id IS NOT NULL AND body_id IS NULL) OR "
            "(organization_id IS NULL AND body_id IS NOT NULL)",
            name="mission_owner_check"
        ),
    )
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"))
    body_id = Column(Integer, ForeignKey("body.id"))
    name = Column(String, nullable=False)
    description = Column(Text)
    importance = Column(Integer, default=3, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="missions")
    body = relationship("Body", back_populates="missions")
    contributions = relationship("Contribution", back_populates="mission")


# ── Block ─────────────────────────────────────────────────────
class Block(Base):
    __tablename__ = "block"
    id = Column(Integer, primary_key=True, index=True)
    body_id = Column(Integer, ForeignKey("body.id"))  # NULL for external
    parent_block_id = Column(Integer, ForeignKey("block.id"))
    name = Column(String, nullable=False)
    description = Column(Text)
    is_external = Column(Boolean, default=False, nullable=False)
    block_type = Column(String)  # free-form: "facility", "server", "process", etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    body = relationship("Body", back_populates="blocks")
    parent = relationship("Block", remote_side=[id], backref="children")

    # Dependencies where this block is the dependent (A depends on B)
    dependencies = relationship(
        "Dependency",
        foreign_keys="Dependency.dependent_block_id",
        back_populates="dependent_block"
    )
    # Dependencies where this block is the dependency (others depend on this)
    dependents = relationship(
        "Dependency",
        foreign_keys="Dependency.dependency_block_id",
        back_populates="dependency_block"
    )
    contributions = relationship("Contribution", back_populates="block")
    mitigations = relationship("Mitigation", back_populates="target_block")


# ── Dependency ───────────────────────────────────────────────
class Dependency(Base):
    __tablename__ = "dependency"
    __table_args__ = (
        UniqueConstraint("dependent_block_id", "dependency_block_id", name="uq_dependency_edge"),
    )
    id = Column(Integer, primary_key=True, index=True)
    dependent_block_id = Column(Integer, ForeignKey("block.id"), nullable=False)  # Block A
    dependency_block_id = Column(Integer, ForeignKey("block.id"), nullable=False)  # Block B
    strength = Column(Integer, default=3, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dependent_block = relationship("Block", foreign_keys=[dependent_block_id], back_populates="dependencies")
    dependency_block = relationship("Block", foreign_keys=[dependency_block_id], back_populates="dependents")


# ── Contribution ─────────────────────────────────────────────
class Contribution(Base):
    __tablename__ = "contribution"
    __table_args__ = (
        UniqueConstraint("block_id", "mission_id", name="uq_contribution"),
    )
    id = Column(Integer, primary_key=True, index=True)
    block_id = Column(Integer, ForeignKey("block.id"), nullable=False)
    mission_id = Column(Integer, ForeignKey("mission.id"), nullable=False)
    strength = Column(Integer, default=3, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    block = relationship("Block", back_populates="contributions")
    mission = relationship("Mission", back_populates="contributions")


# ── Scenario ─────────────────────────────────────────────────
class Scenario(Base):
    __tablename__ = "scenario"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    damages = relationship("ScenarioDamage", back_populates="scenario", cascade="all, delete-orphan")


class CombinedScenario(Base):
    __tablename__ = "combined_scenario"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    components = relationship(
        "CombinedScenarioComponent",
        back_populates="combined_scenario",
        cascade="all, delete-orphan"
    )


class CombinedScenarioComponent(Base):
    __tablename__ = "combined_scenario_component"
    combined_scenario_id = Column(Integer, ForeignKey("combined_scenario.id"), primary_key=True)
    component_scenario_id = Column(Integer, ForeignKey("scenario.id"), primary_key=True)

    combined_scenario = relationship("CombinedScenario", back_populates="components")
    component_scenario = relationship("Scenario")


# ── Scenario Damage ──────────────────────────────────────────
class ScenarioDamage(Base):
    __tablename__ = "scenario_damage"
    __table_args__ = (
        UniqueConstraint("scenario_id", "block_id", name="uq_scenario_damage"),
    )
    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(Integer, ForeignKey("scenario.id"), nullable=False)
    block_id = Column(Integer, ForeignKey("block.id"), nullable=False)
    damage_pct = Column(Float, default=0.0, nullable=False)
    notes = Column(Text)

    scenario = relationship("Scenario", back_populates="damages")
    block = relationship("Block")


# ── Mitigation ───────────────────────────────────────────────
class Mitigation(Base):
    __tablename__ = "mitigation"
    __table_args__ = (
        CheckConstraint(
            "(target_block_id IS NOT NULL AND target_dependency_id IS NULL) OR "
            "(target_block_id IS NULL AND target_dependency_id IS NOT NULL)",
            name="mitigation_target_check"
        ),
        CheckConstraint(
            "category IN ('redundancy', 'hardening', 'buffering', 'rapid_recovery', 'free_form')",
            name="mitigation_category_check"
        ),
    )
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String, nullable=False)
    target_block_id = Column(Integer, ForeignKey("block.id"))
    target_dependency_id = Column(Integer, ForeignKey("dependency.id"))
    cost = Column(Float, default=0.0, nullable=False)
    effect_factor = Column(Float, default=0.0, nullable=False)
    buffer_floor = Column(Float)
    free_form_desc = Column(Text)
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    target_block = relationship("Block", back_populates="mitigations")
    scenario_links = relationship(
        "MitigationScenario",
        back_populates="mitigation",
        cascade="all, delete-orphan"
    )


class MitigationScenario(Base):
    __tablename__ = "mitigation_scenario"
    mitigation_id = Column(Integer, ForeignKey("mitigation.id"), primary_key=True)
    scenario_id = Column(Integer, ForeignKey("scenario.id"), primary_key=True)

    mitigation = relationship("Mitigation", back_populates="scenario_links")
    scenario = relationship("Scenario")


# ── User ──────────────────────────────────────────────────────
class AppUser(Base):
    __tablename__ = "app_user"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'expert' or 'manager'
    created_at = Column(DateTime, default=datetime.utcnow)