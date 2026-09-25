# Skeleton Visualisation — Backend

## Run it

```bash
cd backend

# start the database
docker compose up -d

# install dependencies
python3.12 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env

# run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The web frontend connects to `http://127.0.0.1:8000`. The Android emulator connects to the host Mac through `http://10.0.2.2:8000`.

## Desktop workspace API

The desktop app connects to this same FastAPI server at `VITE_API_URL` (default `http://127.0.0.1:8000`). Its projects use `GET/POST /desktop/workspaces/` and `GET/PUT /desktop/workspaces/{workspace_id}`. On startup, `create_all` creates the separate `desktop_workspace` table if needed. A project is stored whole so its two bone-owned coordinates per joint, bone inventory, graveyards, and multiple individuals survive a round trip. The mobile `/graveyards` and `/skeletons` tables and routes are unchanged; neither app lists or edits the other's records.

Updates require the last known revision. A stale revision returns HTTP 409 so another desktop computer's changes are not silently overwritten. The desktop app keeps local copies offline and syncs when the user presses Save while the API is reachable. The backend currently has no user accounts or access control, consistent with the existing mobile routes; anyone who can reach the API can list desktop workspaces. For a hosted desktop PWA, serve the API over HTTPS and add the PWA origin to `CORS_ORIGINS` in `.env`.
