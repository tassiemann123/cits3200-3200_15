from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db_init import init_db
from .routes import graveyards, skeletons

app = FastAPI(title="Skeleton Visualisation API")

ALLOWED_ORIGINS = [
    "capacitor://localhost",
    "http://localhost",
    "https://localhost",
    "http://localhost:5173",
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