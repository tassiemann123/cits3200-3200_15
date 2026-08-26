from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import graveyards, skeletons

app = FastAPI(title="Skeleton Visualisation API")

# Capacitor apps make requests from origins like capacitor://localhost (iOS)
# and http://localhost (Android), not a normal web origin — so these need to
# be explicitly allowed rather than relying on a wildcard-friendly default.
ALLOWED_ORIGINS = [
    "capacitor://localhost",
    "http://localhost",
    "https://localhost",
    "http://localhost:5173",   # Vite dev server, if you're testing in a browser
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


app.include_router(graveyards.router)
app.include_router(skeletons.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}