"""Catalogo microservice entry point."""
from services.ms_catalogo.app import app as ms_catalogo_app

# Export the FastAPI app
app = ms_catalogo_app