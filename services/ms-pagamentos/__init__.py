"""Pagamentos microservice entry point."""
from services.ms_pagamentos.app import app as ms_pagamentos_app

# Export the FastAPI app
app = ms_pagamentos_app