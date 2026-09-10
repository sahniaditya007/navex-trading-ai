"""
NAVEX Trading AI - Backend Application Entrypoint.
FastAPI server serving the REST API endpoints and mounting the dashboard UI.
"""

import sys
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Ensure backend package is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core.config import settings
from api.routes.trading import router as trading_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("navex")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Simulated AI-Assisted Trading Prototype for NAVEX Capital Technical Evaluation",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # No browser credentials are used; wildcard CORS stays safe for this public prototype API.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount REST API router
app.include_router(trading_router)

# Mount Frontend static files
frontend_dir = PROJECT_ROOT / "frontend"
if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")

    @app.get("/")
    async def serve_index():
        """Serves the NAVEX interactive dashboard."""
        return FileResponse(frontend_dir / "index.html")


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "mode": "simulated_paper_trading",
        "llm_provider": settings.LLM_PROVIDER,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
