"""Pedidos microservice entry point."""
from services.ms_pedidos.app import app as ms_pedidos_app

# Export the FastAPI app
app = ms_pedidos_app