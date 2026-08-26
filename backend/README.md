# Skeleton Visualisation — Backend

## Run it

```bash
cd backend

# start the database
docker compose up -d

# install dependencies
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv pydantic

# make sure .env exists with:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/graveyard_db

# run the server
uvicorn app.main:app --reload
```