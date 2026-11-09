"""Entregas microservice entry point."""
from services.ms_entregas.app import app as ms_entregas_app

# Export the FastAPI app
app = ms_entregas_app