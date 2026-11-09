"""Gateway microservice entry point."""
from services.ms_gateway.app import app as ms_gateway_app

# Export the FastAPI app
app = ms_gateway_app