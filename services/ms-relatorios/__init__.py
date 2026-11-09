"""Relatorios microservice entry point."""
from services.ms_relatorios.app import app as ms_relatorios_app

# Export the FastAPI app
app = ms_relatorios_app