# BCP Tool — Software Specification (v0.3)

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
- A unit of analysis. Defined by the expert during mapping.
- Can represent anything the expert decides is the right granularity: a critical asset (server, facility, vehicle fleet), a business unit, a process, a team, a supplier relationship.
- Belongs to exactly one Body (or is External).
- **Hierarchical:** Blocks form a tree within their Body. A block may have a `parent_block_id` pointing to another block in the same body. This lets the expert build a multi-level decomposition:
  - Top-level blocks under a body (e.g., "IT Infrastructure", "Facilities", "Staff & Processes").
  - Sub-blocks under each (e.g., "Datacenter", "Network", "Servers" under "IT Infrastructure").
  - Leaf blocks at the bottom (e.g., "Rack 12", "UPS", "Cooling System" under "Datacenter").
  - Depth is unlimited in the data model; the GUI should handle reasonable depth (4–6 levels typical).
  - **Rationale:** Different scenarios affect different levels. A fire damages a specific rack; a power outage affects the whole datacenter; a cyberattack affects all IT. Hierarchy lets the expert assign damage at the right level and have it make sense structurally.
- **Hierarchy vs. dependencies:** The parent-child tree is *structural decomposition* (is-a-part-of), not a dependency. Dependencies (A needs B) are a separate, explicit graph that can connect any two blocks regardless of tree position.
- **Contributes to** one or more Missions **within its own Body** at a defined **contribution strength** (1–5).
  - Both leaf blocks and intermediate (non-leaf) blocks can contribute to missions. The expert decides which level of granularity is meaningful for each mission.
  - > **Future consideration:** Allow blocks to contribute directly to missions in other bodies. Currently, cross-body influence on missions happens *only* through dependencies.
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
│   ├── has → Blocks (hierarchical tree, unlimited depth)
│   │   ├── has → child Blocks (parent_block_id, same body)
│   │   ├── contributes to → Missions in SAME body (strength 1–5)
│   │   ├── depends on → other Blocks (strength 1–5, bidirectional)
│   │   └── has → Mitigations
│   └── depends on → Blocks in other Bodies / External Blocks
└── references → External Blocks
    └── (same properties as internal blocks, but org has no internal control)

Note: The parent-child tree (parent_block_id) is structural decomposition
("is-a-part-of"). Dependencies are a separate explicit graph ("needs-to-function").
Both can connect any two blocks regardless of tree position.

Scenario
├── applies → direct damage (0–100%) to each Block (any level of the tree)
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

## 7. GUI Requirements

**Design principle:** The GUI is the primary interface for the tool. All creation, editing, and management of bodies, blocks, dependencies, missions, scenarios, and mitigations happens through the GUI — not through direct API calls or database edits. The GUI must be usable by a domain expert with no technical background.

### 7.1 Expert View

**7.1.1 Organization & Block Tree Builder**

This is the primary building interface — a hierarchical tree editor where the expert constructs the organizational structure.

**Layout:**
- Left panel: Organization tree (collapsible/expandable).
  - Level 0: Organization (root)
  - Level 1: Bodies (divisions, departments)
  - Level 2+: Blocks in a tree under each body (unlimited depth, typically 3–5 levels)
  - External blocks shown in a separate, clearly labeled section at the bottom
- Right panel: Details/properties of the selected node (form fields: name, description, type, etc.)
- Top toolbar: Add Body, Add Block, Add External Block, Delete, Move (reparent)

**Tree operations:**
- **Add Body:** Creates a new top-level body under the organization. Fields: name, description.
- **Add Block (child):** Right-click a body or block → "Add child block". The new block's `parent_block_id` is set to the clicked node (or to the body if clicked on a body). Fields: name, description, block_type (free-form text or dropdown of common types: facility, server, process, team, supplier, etc.), is_external (auto-set based on where it's created).
- **Add External Block:** Created in the external section. Same fields but `is_external=true`, no parent body.
- **Reparent:** Drag-and-drop a block to a new parent (body or another block). The GUI enforces: cannot reparent to its own descendant (no cycles in the tree). Cannot move a block between bodies (a block belongs to exactly one body). External blocks stay external.
- **Delete:** Delete a block → also deletes its descendants (cascade). Confirmation dialog showing what will be deleted. Delete a body → deletes all blocks within it.
- **Expand/Collapse:** All nodes expandable/collapsible. "Expand all" / "Collapse all" buttons. Remember expansion state per session.
- **Search/filter:** Text search across block names. Highlights matching nodes and auto-expands their ancestors.
- **Block count badges:** Each body shows total block count. Each parent block shows child count.

**Visual cues:**
- Different icons for: body, internal block, external block, leaf block vs. parent block.
- Color or badge for block type (facility, server, process, etc.) — optional, user-configurable.
- External blocks visually distinct (different background color, dashed border).
- Nodes with unsaved changes show an indicator.

**7.1.2 Dependency Graph Editor**

This is a separate view/tab from the tree builder. It shows blocks as nodes and dependencies as edges, using **react-flow**.

**Layout:**
- Full-screen canvas with react-flow.
- Left panel (collapsible): filter controls (by body, by depth, show/hide external, show/hide cross-body).
- Top toolbar: Add Dependency, Delete Dependency, Run Layout (auto-arrange), Back to Tree.

**Node behavior:**
- Each block is a node. Node label = block name. Node color/type indicator matches block_type.
- Nodes are draggable. Position is saved per body (or per session — TBD).
- Grouping: blocks within the same body can be visually grouped (colored background region with body name label). This is important for cross-body dependency visualization.
- Double-click a node → opens the node detail panel (same as tree builder right panel).
- Tree hierarchy is NOT shown here (that's the tree builder's job). Dependencies are a separate graph. However, the node can show a small badge indicating it has children in the tree (e.g., "3 children" tooltip).

**Edge behavior:**
- To create a dependency: click "Add Dependency" then click source block (A, the dependent) then target block (B, the dependency). Or drag from a node's output handle to another node's input handle.
- Edge label = strength (1–5). Edge thickness scales with strength. Edge color: gradient from light (strength 1) to dark/red (strength 5).
- Bidirectional dependencies shown as two separate curved edges (A→B and B→A) to keep strengths distinct.
- Click an edge → edit strength in a popup or side panel. Delete edge from the popup.
- Hover over an edge → highlight the path from A to B in the tree (future enhancement).

**7.1.3 Mission Mapper**

**Layout:**
- Left panel: list of missions (grouped by body, with org-level missions at top). Each mission card shows: name, importance (1–5 stars), and number of contributing blocks.
- Right panel: mission detail — shows contributing blocks with their contribution strength.
- "Add Mission" button — creates a mission under a selected body or at the org level.
- For each mission: assign importance weight (1–5, star rating or slider).
- For each mission: add/remove contributing blocks. Only blocks within the same body are selectable (enforced by the GUI).
- Contribution strength slider (1–5) per block-mission pair.
- Visual: blocks shown as chips/tags with their strength. Remove with X.
- A block can contribute to multiple missions — show this as a badge on the block in the tree builder ("Contributes to 3 missions") — optional future enhancement.

**7.1.4 Scenario Editor**

- Create/edit scenarios.
- For each scenario: a table or grid of blocks × damage severity (0–100%).
- **Hierarchical damage assignment:** The expert can assign damage at any level of the block tree. Damage is always per-block (no automatic cascade to children). The GUI provides an "apply to all descendants" convenience button for quickly damaging a whole subtree, but the model stores each block's damage independently.
- Quick-fill: "set all to 0" then fill in affected blocks.
- Copy scenario → modify (e.g., "earthquake moderate" → "earthquake severe").
- Create combined scenarios: select 2+ existing scenarios → combined damage auto-calculated via residual multiplication.
- Damage input: slider (0–100%) per block. Only show blocks that are affected (others stay at 0% / hidden). Filter/search to find blocks quickly.

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

## 11. Decisions (v0.3)

1. **Hierarchical damage:** **No automatic cascade.** Each block is damaged independently in a scenario. The GUI provides an "apply to all descendants" convenience button, but the computation model treats every block individually. The tree is purely structural grouping.

2. **Capacity roll-up:** **Independent.** Each block has its own damage and its own effective capacity. There is no automatic roll-up from children to parent. Exception: if an explicit upward dependency exists (child depends on parent in the dependency graph), then the parent's capacity is affected through the normal dependency propagation mechanism. In other words: the tree structure alone never causes roll-up; only explicit dependencies do.

3. **Dependencies on non-leaf blocks:** **Yes, any block can have dependencies.** The expert can draw a dependency from a high-level block (e.g., "IT Infrastructure") to any other block (e.g., "Power Grid" external). The propagation math works identically regardless of tree position.

4. **Frontend tree component:** **react-complex-tree** for the structural tree builder, **react-flow** for the dependency graph. Two separate views, two purpose-built libraries. Choice prioritizes: drag-and-drop support, keyboard navigation, virtualization for large trees (1000+ nodes), and cross-platform browser compatibility (runs on any laptop with a modern browser, no install beyond the dev server).

5. **Problem ranking method:** Deferred. Will be discussed separately. The spec leaves room for it in the computation model and results view.

## 12. Open Items for Future Discussion

1. **Time dimension:** v1 is a single-frame snapshot. Future: add time evolution (recovery curves, T+1h, T+1day, T+1week).
2. **Cross-body contributions:** Currently blocks can only contribute to missions in their own body. Future: allow direct cross-body contribution links.
3. **Multi-tenant:** Schema supports it structurally, but v1 is single-organization.
4. **Advanced propagation models:** v1 uses linear cascade. Future: nonlinear thresholds, time-delayed propagation, Monte Carlo simulation.
5. **Export/import:** CSV, Excel, JSON export of the model and results for offline analysis.
6. **Versioning:** Model version history (snapshots of the org structure over time).
