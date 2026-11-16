"""Avaliacoes microservice entry point."""
from services.ms_avaliacoes.app import app as ms_avaliacoes_app

# Export the FastAPI app
app = ms_avaliacoes_app