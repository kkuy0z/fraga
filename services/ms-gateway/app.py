"""
API Gateway - Entry point for all external requests, routes to microservices.
"""
import os
import httpx
from typing import Optional
from fastapi import FastAPI, Request, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Service URLs
SERVICE_URLS = {
    "auth": os.getenv("AUTH_SERVICE_URL", "http://ms-auth:8000"),
    "catalogo": os.getenv("CATALOGO_SERVICE_URL", "http://ms-catalogo:8000"),
    "pedidos": os.getenv("PEDIDOS_SERVICE_URL", "http://ms-pedidos:8000"),
    "cozinha": os.getenv("COZINHA_SERVICE_URL", "http://ms-cozinha:8000"),
    "entregas": os.getenv("ENTREGAS_SERVICE_URL", "http://ms-entregas:8000"),
    "notificacoes": os.getenv("NOTIFICACOES_SERVICE_URL", "http://ms-notificacoes:8000"),
    "avaliacoes": os.getenv("AVALIACOES_SERVICE_URL", "http://ms-avaliacoes:8000"),
    "pagamentos": os.getenv("PAGAMENTOS_SERVICE_URL", "http://ms-pagamentos:8000"),
    "relatorios": os.getenv("RELATORIOS_SERVICE_URL", "http://ms-relatorios:8000"),
}

# Route mapping: path prefix -> service
ROUTE_MAP = {
    "/auth": "auth",
    "/usuarios": "auth",
    "/perfis": "auth",
    "/enderecos": "auth",
    "/categorias": "catalogo",
    "/produtos": "catalogo",
    "/opcoes": "catalogo",
    "/itens-opcao": "catalogo",
    "/horarios": "catalogo",
    "/configuracoes": "catalogo",
    "/taxas-entrega": "catalogo",
    "/pedidos": "pedidos",
    "/entregas": "entregas",
    "/notificacoes": "notificacoes",
    "/push": "notificacoes",
    "/avaliacoes": "avaliacoes",
    "/pagamentos": "pagamentos",
    "/relatorios": "relatorios",
    "/webhook": "pagamentos",  # Webhooks go to pagamentos
}

# HTTP client for service communication
http_client: Optional[httpx.AsyncClient] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient(timeout=30.0)
    logger.info("API Gateway started")
    yield
    await http_client.aclose()
    logger.info("API Gateway stopped")


app = FastAPI(
    title="Fraga Lanches - API Gateway",
    version="1.0.0",
    description="Gateway for Fraga Lanches microservices",
    lifespan=lifespan,
    docs_url="/docs" if os.getenv("ENVIRONMENT") != "production" else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_service_for_path(path: str) -> Optional[str]:
    """Determine which service handles a given path."""
    for prefix, service in ROUTE_MAP.items():
        if path.startswith(prefix):
            return service
    return None


async def proxy_request(
    request: Request,
    service_name: str,
    path: str
) -> JSONResponse:
    """Forward request to microservice."""
    service_url = SERVICE_URLS.get(service_name)
    if not service_url:
        raise HTTPException(status_code=503, detail=f"Service {service_name} not configured")

    url = f"{service_url}{path}"

    # Prepare headers
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)

    # Get request body
    body = await request.body()

    try:
        response = await http_client.request(
            method=request.method,
            url=url,
            headers=headers,
            content=body,
            params=request.query_params,
            follow_redirects=False
        )

        # Return response
        return JSONResponse(
            content=response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text,
            status_code=response.status_code,
            headers=dict(response.headers)
        )

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail=f"Service {service_name} timeout")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail=f"Service {service_name} unavailable")
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        raise HTTPException(status_code=500, detail="Gateway error")


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def gateway(request: Request, path: str):
    """Main gateway route - forwards to appropriate microservice."""
    # Reconstruct full path
    full_path = f"/{path}"
    if request.query_params:
        full_path += f"?{request.query_params}"

    # Find service
    service_name = get_service_for_path(full_path)
    if not service_name:
        raise HTTPException(status_code=404, detail="Route not found")

    return await proxy_request(request, service_name, full_path)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Gateway health check."""
    return {
        "status": "healthy",
        "service": "gateway",
        "version": "1.0.0",
        "services": list(SERVICE_URLS.keys())
    }


# Service health checks
@app.get("/health/services")
async def services_health():
    """Check health of all microservices."""
    results = {}
    for name, url in SERVICE_URLS.items():
        try:
            response = await http_client.get(f"{url}/health", timeout=5.0)
            results[name] = "healthy" if response.status_code == 200 else "unhealthy"
        except Exception:
            results[name] = "unreachable"
    return {"gateway": "healthy", "services": results}