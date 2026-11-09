"""Cozinha microservice entry point."""
from services.ms_cozinha.app import app as ms_cozinha_app

# Export the FastAPI app
app = ms_cozinha_app