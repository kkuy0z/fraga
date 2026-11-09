# Base Dockerfile for all microservices
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libmariadb-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set work directory
WORKDIR /app

# Copy shared modules first (for caching)
COPY shared/ /app/shared/

# Install shared dependencies
RUN pip install --no-cache-dir -e /app/shared

# Copy service-specific files
COPY services/ /app/services/

# Install service dependencies
RUN pip install --no-cache-dir -e /app/services/ms-auth \
    && pip install --no-cache-dir -e /app/services/ms-catalogo \
    && pip install --no-cache-dir -e /app/services/ms-pedidos \
    && pip install --no-cache-dir -e /app/services/ms-cozinha \
    && pip install --no-cache-dir -e /app/services/ms-entregas \
    && pip install --no-cache-dir -e /app/services/ms-notificacoes \
    && pip install --no-cache-dir -e /app/services/ms-avaliacoes \
    && pip install --no-cache-dir -e /app/services/ms-pagamentos \
    && pip install --no-cache-dir -e /app/services/ms-relatorios \
    && pip install --no-cache-dir -e /app/services/ms-gateway

# Change ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Default command (overridden by docker-compose)
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]