"""FastAPI application entry point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables and seed default organization on startup."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if not db.query(__import__("app.models", fromlist=["Organization"]).Organization).first():
            org = __import__("app.models", fromlist=["Organization"]).Organization(
                name="Default Organization", description="Default organization"
            )
            db.add(org)
            db.commit()
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def root():
    return {"name": settings.APP_NAME, "version": settings.APP_VERSION, "docs": "/docs"}