"""Notificacoes microservice entry point."""
from services.ms_notificacoes.app import app as ms_notificacoes_app

# Export the FastAPI app
app = ms_notificacoes_app