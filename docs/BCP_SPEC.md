# BCP Tool — Software Specification (v0.2)

## 1. Purpose

A general-purpose software tool for mapping organizational structure, dependencies, and mission sensitivity under disruption scenarios, and for evaluating cost-effective investments to reduce that sensitivity.

Designed for large, diverse organizations composed of semi-autonomous bodies with complex intra- and inter-organizational dependencies spanning all domains — IT, logistics, physical infrastructure, personnel, supply chain, and external providers.

## 2. Conceptual Model

### 2.1 Entities

#### Organization
- The top-level entity. Contains one or more **Bodies**.
- Has one or more **Missions** (the organization's overarching objectives).

#### Body
- A semi-autonomous unit within the organization (division, agency, subsidiary, department).
- Has a hierarchical internal structure (tree of blocks).
- Has its own **Missions**, which may:
  - Map to (or contribute to) organization-level missions.
  - Be unique to the body.
  - Converge across bodies and the organization (multiple bodies contribute to the same org-level mission, each through their own blocks).
- Can depend on other bodies, blocks within other bodies, and **External Blocks**.

#### Block
- The lowest-level unit of analysis. Defined by the expert during mapping.
- Can represent anything the expert decides is the right granularity: a critical asset (server, facility, vehicle fleet), a business unit, a process, a team, a supplier relationship.
- Belongs to exactly one Body (or is External).
- **Contributes to** one or more Missions **within its own Body** at a defined **contribution strength** (1–5).
  - > **Future consideration:** Allow blocks to contribute directly to missions in other bodies. Currently, cross-body influence on missions happens *only* through dependencies. A block in Body 2 that depends on a block in Body 1 will have its effective capacity reduced when Body 1's block is damaged, which in turn reduces Body 2's mission capacity. This covers the cross-body case through the dependency graph rather than direct contribution links.
- Has **dependencies** on other Blocks at a defined **dependency strength** (1–5).
- Blocks are established through expert interviews/survey and refined continuously.

#### External Block
- A block outside the organization entirely (e.g., a third-party supplier, a public utility, a cloud provider, a government service).
- Modeled identically to internal blocks but flagged as external.
- The organization has no control over its internal structure, only over the dependency link.

#### Mission
- The key metric: "what must keep working."
- Has an **importance weight** (1–5).
- Belongs to a Body or to the Organization.
- One or more Blocks **contribute to** each Mission at a **contribution strength** (1–5).
- The Mission's capacity to function = weighted average of contributing blocks' effective capacities, weighted by contribution strength.
- Missions can converge: multiple bodies' blocks can contribute to the same organization-level mission (each through their own body's blocks).

#### Dependency
- A directed relationship from Block A → Block B, meaning "A depends on B" (A needs B to function).
- Has a **dependency strength** (1–5), graded:
  - 1 = minor/weak dependency
  - 5 = critical — A cannot function without B
- Can be **bidirectional** (A→B and B→A with separate strengths) — models mutual interdependency (e.g., power plant needs water treatment, water treatment needs electricity).
- Dependencies exist between:
  - Blocks within the same Body
  - Blocks in different Bodies
  - Blocks and External Blocks

#### Scenario
- A hypothetical disruption event (earthquake, ransomware, supplier failure, pandemic, cyberattack, flood, etc.).
- Defined by the expert.
- For each Scenario, the expert assigns **direct damage** to each Block:
  - **Damage severity** (0–100%): how much the scenario directly degrades the block's capacity.
  - 0% = no impact (scenario does not touch this block).
  - 100% = total destruction / complete loss of function.
- **Combined scenarios:** Two or more scenarios can be combined. The combined damage uses residual multiplication:
  - `combined_damage = 1 - (1 - d₁) × (1 - d₂) × ... × (1 - dₙ)`
  - Example: 50% + 50% → 1 - (0.5 × 0.5) = 75% (the second scenario damages what's left).
  - Combined scenarios are first-class objects: they reference component scenarios and can be saved, edited, and run like any other scenario.

#### Mitigation
- An investable control attached to a Block (or a Dependency) that reduces the impact of one or more Scenarios.
- **Categories** (predefined):
  1. **Redundancy** — add backup/alternative capacity (e.g., second supplier, redundant server, spare parts). Reduces effective damage by providing an alternative path.
  2. **Hardening / Protection** — reinforce the block against specific threats (e.g., seismic retrofit, cybersecurity upgrade, physical security). Reduces direct damage severity for relevant scenarios.
  3. **Buffering / Stockpiling** — maintain reserve inventory, capacity, or time lag (e.g., 30-day stockpile, reserve fuel). Delays propagation — the block can sustain its output for a defined period even if its inputs are cut.
  4. **Rapid Recovery** — pre-positioned resources for faster restoration (e.g., repair crews, spare parts, failover procedures, DR runbooks). Reduces the effective duration of degradation.
  5. **Free-form** — expert-defined mitigation with custom effect description and parameters. Covers anything not captured above.
- Each Mitigation has:
  - A **cost** (monetary or relative units).
  - A **target** (which Block or Dependency it applies to).
  - A **scope** (which Scenarios it affects).
  - An **effect** (how it changes the damage/propagation math — see §3.3).

### 2.2 Entity Relationship Summary

```
Organization
├── has → Missions (org-level, importance 1–5)
├── contains → Bodies
│   ├── has → Missions (body-level, importance 1–5)
│   ├── has → Blocks (hierarchical tree)
│   │   ├── contributes to → Missions in SAME body (strength 1–5)
│   │   ├── depends on → other Blocks (strength 1–5, bidirectional)
│   │   └── has → Mitigations
│   └── depends on → Blocks in other Bodies / External Blocks
└── references → External Blocks
    └── (same properties as internal blocks, but org has no internal control)

Scenario
├── applies → direct damage (0–100%) to each Block
├── can be combined → CombinedScenario (residual multiplication)
└── can be combined with other Scenarios

Mitigation
├── attaches to → Block or Dependency
├── costs → $ (or relative units)
├── affects → one or more Scenarios
└── has type → Redundancy | Hardening | Buffering | Rapid Recovery | Free-form
```

## 3. Computation Model

### 3.1 Mission Capacity (Baseline, No Scenario)

At baseline, all blocks are at 100% capacity. A mission's baseline capacity = 100% (all contributors at full strength).

### 3.2 Scenario Impact Propagation (Linear Cascade)

Given a Scenario S (or combined scenario):

**Step 1 — Direct Damage:**
For each Block B, the expert assigns `direct_damage(S, B)` ∈ [0, 100%].
This is the immediate, direct effect of the scenario on that block.
For combined scenarios: `combined_damage = 1 - Π(1 - dᵢ)` over component scenarios.

**Step 2 — Effective Block Capacity (pre-mitigation):**
`effective_capacity(B) = 100% - direct_damage(S, B)`

Apply any mitigations attached to B that are active for scenario S:
- Hardening reduces `direct_damage` (e.g., from 80% to 30%).
- Redundancy provides an alternative path — modeled as reducing the effective damage by the fraction of capacity that is backed up (e.g., if 60% of capacity is redundant, effective damage = 40% of direct damage).
- Buffering adds a grace period — for the initial period, the block can sustain output at a defined level (e.g., 100%) despite damaged inputs. After the buffer period, propagation resumes normally. (In v1, buffering is simplified as a flat capacity floor.)
- Rapid Recovery reduces the effective duration of damage — modeled as a recovery curve that restores capacity over time. (In v1, simplified as a reduced effective damage proportional to faster recovery.)
- Free-form: expert defines the effect as a reduction factor on direct damage or on incoming propagation.

**Step 3 — Propagated Impact (Linear Cascade):**
For each Block A that depends on Block B at strength `dep(A→B)` ∈ {1,2,3,4,5}:

`propagated_loss(A from B) = (100% - effective_capacity(B)) × (dep(A→B) / 5)`

If A depends on multiple blocks B₁, B₂, ..., Bₙ:
- Total incoming loss to A = sum of propagated losses from all dependencies.
- Capped at 100% (A cannot lose more than 100% capacity).
- `effective_capacity(A) = max(0, 100% - direct_damage(S, A) - total_propagated_loss(A))`

Note: For bidirectional dependencies (A→B and B→A), propagation is computed iteratively. In v1, use a fixed number of iterations (3 passes) to approximate convergence without infinite loops.

**Step 4 — Mission Impact:**
For each Mission M, with contributing blocks B₁ (contribution c₁), B₂ (contribution c₂), ...:

`mission_capacity(M) = Σ (effective_capacity(Bᵢ) × cᵢ / 5) / Σ (cᵢ / 5)`

In words: weighted average of contributing blocks' effective capacities, weighted by their contribution strength.

For organization-level missions: the mission capacity is computed from all blocks across all bodies that contribute to it (through their body-level contribution chains + cross-body dependencies).

**Step 5 — Mission Sensitivity Score:**
`mission_sensitivity(M) = mission_importance(M) × (100% - mission_capacity(M))`

This gives a single number per mission per scenario — higher = worse. Missions with high importance and high degradation score worst.

### 3.3 Effect of Mitigations on the Math

| Mitigation Type | Where it acts | Effect on computation |
|---|---|---|
| Redundancy | Block | Reduces effective direct damage by fraction of capacity that is redundant. `effective_damage = direct_damage × (1 - redundancy_fraction)` |
| Hardening | Block | Reduces direct damage for specific scenarios. `effective_damage = direct_damage × (1 - hardening_factor)` |
| Buffering | Block | Sets a temporary floor on effective_capacity during the buffer period. `effective_capacity = max(effective_capacity, buffer_floor)` |
| Rapid Recovery | Block | Reduces effective damage by accelerating restoration. Modeled as `effective_damage × recovery_reduction_factor` |
| Free-form | Block or Dependency | Expert-defined reduction factor applied to direct damage or to incoming propagated loss |

### 3.4 Investment Optimization (Phase 5 — Later)

Given a budget B, select the set of mitigations that minimizes total mission-weighted sensitivity across all scenarios:

`minimize Σ_scenarios Σ_missions [mission_sensitivity(M, S)]`

Subject to:
- `Σ cost(selected_mitigations) ≤ B`
- Each mitigation can be selected at most once (binary)
- (Optional) Each block can have at most N mitigations

In v1, this can be solved by brute-force enumeration for small portfolios, greedy heuristic (rank by sensitivity-reduction per dollar), or a simple optimization solver.

## 4. Users & Roles

### 4.1 Expert (Builder)
- Full access to all data model entities.
- Can create, edit, delete: Bodies, Blocks, Dependencies, Missions, Scenarios, Combined Scenarios, Mitigations.
- Conducts the mapping process (interviews, surveys) and inputs results.
- Defines scenario damage profiles.
- Configures mitigations and their effects.
- Can run scenarios and view all results.

### 4.2 Manager (Viewer)
- Read-only access to results.
- Sees high-level dashboards:
  - Mission sensitivity scores per scenario (heatmap or ranked list).
  - Organization-level mission status (green/yellow/red).
  - Top affected bodies and blocks.
- Can drill down (click through) from mission → contributing blocks → dependencies → details.
- Can view investment scenarios (what-if analysis) when available.
- Cannot edit the model.

## 5. Technology Stack

### 5.1 Architecture

```
┌─────────────────────────────────────────────┐
│                  Frontend                     │
│         React + vis.js/react-flow             │
│         (graph editor, dashboards)            │
└──────────────────┬──────────────────────────┘
                   │ HTTP / WebSocket
┌──────────────────┴──────────────────────────┐
│                  Backend                      │
│         Python + FastAPI                      │
│    (REST API, computation engine)            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│               Database                        │
│         SQLite (v1) → PostgreSQL (later)      │
└─────────────────────────────────────────────┘
```

### 5.2 Backend
- **Language:** Python 3.10+
- **Framework:** FastAPI (async, auto-documents API via Swagger/OpenAPI)
- **Database:** SQLite for v1 (zero-install, single file). Schema designed to migrate to PostgreSQL later if needed.
- **ORM:** SQLAlchemy (works with both SQLite and PostgreSQL)
- **Computation engine:** Pure Python (numpy/scipy for optimization in Phase 5)
- **Validation:** Pydantic models (built into FastAPI)

### 5.3 Frontend
- **Framework:** React (with Vite for build tooling)
- **Graph editor:** react-flow (interactive node/edge editor — drag, connect, label)
- **Charts/dashboards:** Recharts or Plotly.js
- **UI components:** Material-UI (MUI) or Ant Design
- **State management:** React Query (for API state) + Zustand (for local UI state)
- **Why React:** Largest contributor pool, most graph libraries, best for open-source project

### 5.4 Getting Started with React (for a Python-native developer)

The good news: you don't need to write much React yourself if the API is clean. The workflow:

1. **Backend first:** Build the FastAPI API + computation engine in Python. This is where 80% of the logic lives.
2. **Frontend scaffold:** Use `npm create vite@latest` to generate a starter project. Vite handles the build — you run `npm run dev` and it hot-reloads.
3. **Graph editor:** react-flow has excellent examples and copy-paste components. You'll mostly configure nodes/edges from API responses.
4. **Dashboards:** Recharts components are declarative XML-like tags (`<BarChart data={...} />`). Very learnable.
5. **Deployment:** Run FastAPI on the Linux machine, serve the built React frontend from FastAPI (single process), users access via browser on any OS.

**Key learning resources:**
- FastAPI docs: https://fastapi.tiangolo.com (the best Python framework docs)
- react-flow examples: https://reactflow.dev/examples
- The React part you'll need is mostly: fetch from API → render components. Modern React with hooks is quite approachable.

## 6. Database Schema

### 6.1 Tables

```sql
-- Organization (singleton — one row for v1, but designed for multi-tenant later)
CREATE TABLE organization (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT
);

-- Bodies
CREATE TABLE body (
    id              INTEGER PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organization(id),
    name            TEXT NOT NULL,
    description     TEXT,
    parent_body_id  INTEGER REFERENCES body(id),  -- bodies can be nested
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Missions (both org-level and body-level)
CREATE TABLE mission (
    id              INTEGER PRIMARY KEY,
    organization_id INTEGER REFERENCES organization(id),  -- set if org-level mission
    body_id         INTEGER REFERENCES body(id),          -- set if body-level mission
    name            TEXT NOT NULL,
    description     TEXT,
    importance      INTEGER NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Exactly one of organization_id / body_id must be set
    CHECK (
        (organization_id IS NOT NULL AND body_id IS NULL) OR
        (organization_id IS NULL AND body_id IS NOT NULL)
    )
);

-- Blocks (including external blocks)
CREATE TABLE block (
    id              INTEGER PRIMARY KEY,
    body_id         INTEGER REFERENCES body(id),  -- NULL for external blocks
    parent_block_id INTEGER REFERENCES block(id), -- hierarchical tree within body
    name            TEXT NOT NULL,
    description     TEXT,
    is_external     BOOLEAN NOT NULL DEFAULT FALSE,
    block_type      TEXT,  -- free-form: "facility", "server", "process", "team", "supplier", etc.
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dependencies (A depends on B)
CREATE TABLE dependency (
    id                INTEGER PRIMARY KEY,
    dependent_block_id  INTEGER NOT NULL REFERENCES block(id),  -- Block A (who depends)
    dependency_block_id INTEGER NOT NULL REFERENCES block(id),  -- Block B (depended on)
    strength          INTEGER NOT NULL DEFAULT 3 CHECK (strength BETWEEN 1 AND 5),
    description       TEXT,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Prevent duplicate edges (same A→B). Bidirectional = two rows: A→B and B→A.
    UNIQUE (dependent_block_id, dependency_block_id)
);

-- Contributions (Block contributes to Mission)
CREATE TABLE contribution (
    id          INTEGER PRIMARY KEY,
    block_id    INTEGER NOT NULL REFERENCES block(id),
    mission_id  INTEGER NOT NULL REFERENCES mission(id),
    strength    INTEGER NOT NULL DEFAULT 3 CHECK (strength BETWEEN 1 AND 5),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (block_id, mission_id)
);

-- Scenarios
CREATE TABLE scenario (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Combined scenarios (references component scenarios)
CREATE TABLE combined_scenario (
    id                  INTEGER PRIMARY KEY,
    name                TEXT NOT NULL,
    description         TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE combined_scenario_component (
    combined_scenario_id INTEGER NOT NULL REFERENCES combined_scenario(id),
    component_scenario_id INTEGER NOT NULL REFERENCES scenario(id),
    PRIMARY KEY (combined_scenario_id, component_scenario_id)
);

-- Direct damage: per scenario, per block
CREATE TABLE scenario_damage (
    id          INTEGER PRIMARY KEY,
    scenario_id INTEGER NOT NULL REFERENCES scenario(id),
    block_id    INTEGER NOT NULL REFERENCES block(id),
    damage_pct  REAL NOT NULL DEFAULT 0.0 CHECK (damage_pct BETWEEN 0.0 AND 100.0),
    notes       TEXT,
    UNIQUE (scenario_id, block_id)
);

-- Mitigations
CREATE TABLE mitigation (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    category        TEXT NOT NULL CHECK (category IN (
        'redundancy', 'hardening', 'buffering', 'rapid_recovery', 'free_form'
    )),
    target_block_id INTEGER REFERENCES block(id),
    target_dependency_id INTEGER REFERENCES dependency(id),
    cost            REAL NOT NULL DEFAULT 0.0,
    -- Effect parameters (interpretation depends on category)
    effect_factor   REAL NOT NULL DEFAULT 0.0,  -- reduction factor (0 = no effect, 1 = eliminates damage)
    buffer_floor    REAL,    -- for buffering: capacity floor (e.g., 80%)
    free_form_desc  TEXT,    -- for free_form: expert description of effect
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Exactly one target must be set
    CHECK (
        (target_block_id IS NOT NULL AND target_dependency_id IS NULL) OR
        (target_block_id IS NULL AND target_dependency_id IS NOT NULL)
    )
);

-- Mitigation → Scenario scope (which scenarios a mitigation applies to)
CREATE TABLE mitigation_scenario (
    mitigation_id INTEGER NOT NULL REFERENCES mitigation(id),
    scenario_id   INTEGER NOT NULL REFERENCES scenario(id),
    PRIMARY KEY (mitigation_id, scenario_id)
);

-- Users (simple auth for v1)
CREATE TABLE app_user (
    id          INTEGER PRIMARY KEY,
    username    TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role        TEXT NOT NULL CHECK (role IN ('expert', 'manager')),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.2 Indexes

```sql
CREATE INDEX idx_block_body ON block(body_id);
CREATE INDEX idx_block_parent ON block(parent_block_id);
CREATE INDEX idx_dependency_dependent ON dependency(dependent_block_id);
CREATE INDEX idx_dependency_target ON dependency(dependency_block_id);
CREATE INDEX idx_contribution_block ON contribution(block_id);
CREATE INDEX idx_contribution_mission ON contribution(mission_id);
CREATE INDEX idx_scenario_damage_scenario ON scenario_damage(scenario_id);
CREATE INDEX idx_scenario_damage_block ON scenario_damage(block_id);
CREATE INDEX idx_mitigation_target_block ON mitigation(target_block_id);
CREATE INDEX idx_mission_body ON mission(body_id);
CREATE INDEX idx_mission_org ON mission(organization_id);
```

### 6.3 Design Notes

- **SQLite → PostgreSQL migration:** The schema is standard SQL with no SQLite-specific features. To migrate: change the SQLAlchemy connection string. No schema changes needed.
- **Bidirectional dependencies:** Stored as two rows in `dependency` (A→B and B→A). Each has its own strength. This is simpler than a single row with two strength columns and queries better (no need to check both directions).
- **Combined scenarios:** A `combined_scenario` references component scenarios via `combined_scenario_component`. When running a combined scenario, the engine fetches all component damages and applies residual multiplication.
- **Mitigation targets:** A mitigation targets either a block or a dependency. The CHECK constraint enforces exactly one.
- **Audit trail:** `created_at` / `updated_at` on all tables. For a future version, a full audit log table.
- **Scale:** SQLite handles thousands of rows and concurrent reads fine. The graph (few thousand blocks/edges) is trivial for SQLite. The main constraint is single-writer, which is fine for v1 (one expert at a time).

## 7. GUI Requirements (High-Level)

### 7.1 Expert View

**7.1.1 Organization Builder**
- Tree view of the organization: Bodies → Blocks (hierarchical).
- Add/edit/delete bodies and blocks.
- Drag-and-drop or form-based block creation.
- External blocks shown in a separate panel.

**7.1.2 Dependency Map**
- Visual graph (nodes = blocks, edges = dependencies).
- Edge thickness/label = dependency strength (1–5).
- Bidirectional edges shown as double-headed.
- Click on edge to edit strength.
- Highlight: click a block to see all its dependencies (upstream and downstream).
- Filter: show only blocks within a body, or show cross-body dependencies.
- Built with **react-flow** (https://reactflow.dev).

**7.1.3 Mission Mapper**
- List of all missions (org-level + per body).
- For each mission: assign importance weight (1–5).
- For each mission: show which blocks contribute, with contribution strength (1–5).
- Add/remove contributing blocks per mission.
- Note: blocks can only contribute to missions within their own body.

**7.1.4 Scenario Editor**
- Create/edit scenarios.
- For each scenario: table of blocks × damage severity (0–100%).
- Quick-fill: "set all to 0" then fill in affected blocks.
- Copy scenario → modify (e.g., "earthquake moderate" → "earthquake severe").
- Create combined scenarios: select 2+ existing scenarios → combined damage auto-calculated via residual multiplication.

**7.1.5 Mitigation Editor**
- Create mitigations, assign to blocks or dependencies.
- Select category (redundancy, hardening, buffering, rapid_recovery, free_form).
- Define cost, scope (which scenarios), effect parameters.
- Toggle mitigations on/off to compare baseline vs. mitigated state.

**7.1.6 Run & Results**
- "Run scenario" button → computes propagation → shows results.
- Per-mission sensitivity table.
- Per-block effective capacity table.
- Propagation path visualization (which dependencies caused the cascade).

### 7.2 Manager View

**7.2.1 Dashboard**
- Scenario selector (includes combined scenarios).
- Mission sensitivity summary: ranked list or heatmap of missions × scenarios.
- Color coding: green (0–20% sensitivity), yellow (20–50%), red (50%+).
- Organization-level mission status at top.

**7.2.2 Drill-Down**
- Click a mission → see contributing blocks and their effective capacity.
- Click a block → see its dependencies and which are degraded.
- Click a dependency → see strength and whether it's the propagation path causing the problem.

**7.2.3 Investment View (Phase 5)**
- Budget slider.
- Shows: with budget $X, top recommended mitigations, expected sensitivity reduction per mission.
- Compare: baseline vs. mitigated (side-by-side bars or before/after heatmap).

## 8. API Design (High-Level)

### 8.1 REST Endpoints (FastAPI)

```
# Organization
GET    /api/organization
PUT    /api/organization

# Bodies
GET    /api/bodies
POST   /api/bodies
GET    /api/bodies/{id}
PUT    /api/bodies/{id}
DELETE /api/bodies/{id}

# Blocks
GET    /api/blocks?body_id={id}
POST   /api/blocks
GET    /api/blocks/{id}
PUT    /api/blocks/{id}
DELETE /api/blocks/{id}

# Dependencies
GET    /api/dependencies?block_id={id}
POST   /api/dependencies
PUT    /api/dependencies/{id}
DELETE /api/dependencies/{id}

# Missions
GET    /api/missions?body_id={id}&include_org=true
POST   /api/missions
PUT    /api/missions/{id}
DELETE /api/missions/{id}

# Contributions
GET    /api/contributions?mission_id={id}
POST   /api/contributions
DELETE /api/contributions/{id}

# Scenarios
GET    /api/scenarios
POST   /api/scenarios
GET    /api/scenarios/{id}
PUT    /api/scenarios/{id}
DELETE /api/scenarios/{id}

# Combined scenarios
POST   /api/combined-scenarios
GET    /api/combined-scenarios/{id}
DELETE /api/combined-scenarios/{id}

# Scenario damage
GET    /api/scenarios/{id}/damages
PUT    /api/scenarios/{id}/damages        # bulk upsert
DELETE /api/scenarios/{id}/damages/{block_id}

# Mitigations
GET    /api/mitigations?block_id={id}
POST   /api/mitigations
PUT    /api/mitigations/{id}
DELETE /api/mitigations/{id}
POST   /api/mitigations/{id}/toggle       # enable/disable

# Computation
POST   /api/compute                       # run scenario, return results
       # body: { scenario_id: int, mitigations_enabled: bool }
       # returns: { missions: [{id, name, capacity_pct, sensitivity}], 
       #            blocks: [{id, name, effective_capacity_pct}] }

# Auth
POST   /api/auth/login
GET    /api/auth/me
```

### 8.2 Computation API

The `/api/compute` endpoint:
- Input: scenario ID (or combined scenario ID), flag for mitigations on/off, optional list of enabled mitigation IDs.
- Output: JSON with per-mission results (capacity, sensitivity), per-block effective capacity, and propagation trace (for visualization).
- The computation is synchronous and fast (milliseconds for a few thousand blocks).

## 9. Phasing

| Phase | Deliverable | Status |
|---|---|---|
| 1 — Definitions | This spec document — data model, computation model, GUI requirements, DB schema, API design | ✅ Complete |
| 2 — Prototype | Backend API + minimal frontend: org builder + dependency map + single scenario run | Not started |
| 3 — Scenarios & Results | Full scenario editor + combined scenarios + propagation computation + manager dashboard | Not started |
| 4 — Mitigations | Mitigation editor + effect computation + before/after comparison | Not started |
| 5 — Investment Optimization | Budget-based optimization + investment view | Not started |

## 10. Glossary

| Term | Definition |
|---|---|
| **Organization** | The top-level entity being analyzed |
| **Body** | A semi-autonomous unit within the organization |
| **Block** | The lowest-level unit of analysis (granularity defined by expert) |
| **External Block** | A block outside the organization (supplier, utility, etc.) |
| **Mission** | A key objective that must be maintained; the metric of "what matters" |
| **Dependency** | A directed, graded (1–5) relationship: "A needs B to function" |
| **Contribution** | A graded (1–5) relationship: "Block B serves mission M" (within same body only in v1) |
| **Scenario** | A hypothetical disruption with defined direct damage per block |
| **Combined Scenario** | Two or more scenarios combined via residual multiplication |
| **Mitigation** | An investable control that reduces scenario impact on a block |
| **Effective Capacity** | A block's functional capacity after direct damage + propagated impact + mitigations |
| **Mission Capacity** | Weighted average of contributing blocks' effective capacities |
| **Mission Sensitivity** | Mission importance × (100% − mission capacity) — the key output metric |
| **Propagation** | Cascading impact through the dependency graph from directly-damaged blocks to downstream blocks and missions |

## 11. Open Items for Future Discussion

1. **Problem ranking method:** How to rank/prioritize which problems (vulnerable blocks/dependencies) to address first — beyond the raw sensitivity score. To be discussed.
2. **Time dimension:** v1 is a single-frame snapshot. Future: add time evolution (recovery curves, T+1h, T+1day, T+1week).
3. **Cross-body contributions:** Currently blocks can only contribute to missions in their own body. Future: allow direct cross-body contribution links.
4. **Multi-tenant:** Schema supports it structurally, but v1 is single-organization.
5. **Advanced propagation models:** v1 uses linear cascade. Future: nonlinear thresholds, time-delayed propagation, Monte Carlo simulation.
6. **Export/import:** CSV, Excel, JSON export of the model and results for offline analysis.
7. **Versioning:** Model version history (snapshots of the org structure over time).