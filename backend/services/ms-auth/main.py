"""
Base FastAPI application for all microservices.
"""
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from shared.database import init_db, close_db, get_db
from shared.schemas import HealthResponse, ErrorResponse, ErrorDetail
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

SERVICE_NAME = os.getenv("SERVICE_NAME", "unknown")
SERVICE_VERSION = os.getenv("SERVICE_VERSION", "1.0.0")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info(f"Starting {SERVICE_NAME} v{SERVICE_VERSION}")
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

    yield

    logger.info(f"Shutting down {SERVICE_NAME}")
    try:
        await close_db()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error(f"Error closing database: {e}")


def create_app(service_name: str, service_version: str = "1.0.0") -> FastAPI:
    """Create a FastAPI app with common configuration."""

    global SERVICE_NAME, SERVICE_VERSION
    SERVICE_NAME = service_name
    SERVICE_VERSION = service_version

    app = FastAPI(
        title=f"Fraga Lanches - {service_name}",
        version=service_version,
        description=f"Microservice: {service_name}",
        lifespan=lifespan,
        docs_url="/docs" if os.getenv("ENVIRONMENT") != "production" else None,
        redoc_url="/redoc" if os.getenv("ENVIRONMENT") != "production" else None,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handlers
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(
                error=exc.__class__.__name__,
                message=exc.detail,
                details=[ErrorDetail(message=str(exc.detail), code=str(exc.status_code))],
                timestamp=datetime.utcnow()
            ).model_dump()
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(
                error="ValidationError",
                message="Validation failed",
                details=[
                    ErrorDetail(field=".".join(str(x) for x in e["loc"]), message=e["msg"], code=e["type"])
                    for e in exc.errors()
                ],
                timestamp=datetime.utcnow()
            ).model_dump()
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error="InternalServerError",
                message="Internal server error" if os.getenv("ENVIRONMENT") == "production" else str(exc),
                timestamp=datetime.utcnow()
            ).model_dump()
        )

    # Health check endpoint
    @app.get("/health", response_model=HealthResponse, tags=["health"])
    async def health_check():
        return HealthResponse(
            status="healthy",
            service=service_name,
            version=service_version,
            timestamp=datetime.utcnow(),
            database="connected",
            rabbitmq="connected"
        )

    return app