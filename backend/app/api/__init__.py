"""API router initialization and route includes."""
from fastapi import APIRouter
from app.api import bodies, blocks, dependencies, missions, contributions, scenarios, mitigations, compute, auth

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/api/auth", tags=["auth"])
api_router.include_router(bodies.router, prefix="/api/bodies", tags=["bodies"])
api_router.include_router(blocks.router, prefix="/api/blocks", tags=["blocks"])
api_router.include_router(dependencies.router, prefix="/api/dependencies", tags=["dependencies"])
api_router.include_router(missions.router, prefix="/api/missions", tags=["missions"])
api_router.include_router(contributions.router, prefix="/api/contributions", tags=["contributions"])
api_router.include_router(scenarios.router, prefix="/api/scenarios", tags=["scenarios"])
api_router.include_router(scenarios.router_combined, prefix="/api/combined-scenarios", tags=["combined-scenarios"])
api_router.include_router(mitigations.router, prefix="/api/mitigations", tags=["mitigations"])
api_router.include_router(compute.router, prefix="/api/compute", tags=["compute"])