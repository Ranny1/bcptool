# BCPTool

**Business Continuity Planning Tool** — map organizational structure, dependencies, and mission sensitivity under disruption scenarios.

## Overview

BCPTool helps large, diverse organizations:

1. **Map** their structure — bodies, blocks, missions, and dependencies
2. **Model** disruption scenarios and their cascading impact through the dependency graph
3. **Assess** mission sensitivity — which critical functions are most vulnerable
4. **Plan** cost-effective mitigations (redundancy, hardening, buffering, rapid recovery)

## Tech Stack

- **Backend:** Python 3.10+, FastAPI, SQLAlchemy, SQLite (→ PostgreSQL later)
- **Frontend:** React (Vite), react-flow, Recharts
- **License:** MIT

## Project Structure

```
bcptool/
├── backend/           # FastAPI backend + computation engine
│   ├── app/
│   │   ├── api/       # REST endpoints
│   │   ├── models/    # SQLAlchemy ORM models
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── services/  # Business logic + computation engine
│   │   └── core/      # Config, database, auth
│   └── tests/
├── frontend/          # React + Vite frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── api/
│       ├── hooks/
│       └── store/
├── docs/              # Spec and documentation
│   └── BCP_SPEC.md
└── README.md
```

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs available at http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at http://localhost:5173

## Documentation

- [Full Specification](docs/BCP_SPEC.md)

## License

MIT — see [LICENSE](LICENSE)