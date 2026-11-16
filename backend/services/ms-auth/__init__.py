"""Auth microservice entry point."""
from services.ms_auth.main import create_app
from services.ms_auth.app import app as auth_app

# Export the FastAPI app
app = auth_app