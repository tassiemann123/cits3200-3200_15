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
