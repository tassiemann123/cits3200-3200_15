# OsteoPlot Desktop — Quick Start

Choose the instructions for your computer. Windows users can open the team's packaged ZIP. Mac users can run the app from source; the Windows `.exe` does not run on macOS.

## Open the Windows app

1. Download the Windows ZIP provided by the team.
2. Right-click the ZIP and select **Extract All**.
3. Open the extracted folder and double-click **OsteoPlot.exe**.

Keep the whole extracted folder together. Do not move the `.exe` out of it or run it from inside the ZIP. You do not need a terminal, Node.js or a separate web server to open the packaged app.

## Start recording

1. Select or create a graveyard.
2. Add a skeleton, or use **Import** to load a CSV file. You can select several CSV files together.
3. Enter the X, Y and Z coordinates for the landmarks you want to record.
4. Use the view buttons, zoom and rotation controls to inspect the skeleton.

The skeleton is displayed from the coordinates you record. A new blank record does not show a complete skeleton.

## Save your work

The app saves changes locally as you work. In the packaged Windows version, local data is stored in the **data** folder beside `OsteoPlot.exe`. Keep this folder when moving the app.

Use **Export** to save a separate copy of your work. JSON is the workspace backup format; CSV is useful for opening coordinate data in Excel or sharing it with others. Export a backup before replacing or updating the app folder.

Local recording and file import/export are intended to work offline in the Windows package. Saving to or opening from the backend requires a connection to the backend server.

## Run from source on macOS or Windows

Install Node.js 24 and npm, and use the latest project source. The anatomical model must be available at `mobile/public/models/skeleton_pre-cut.glb` or `desktop/public/models/skeleton_pre-cut.glb`. Ask the team for the model file if it is missing.

### macOS

Open **Terminal** in the repository folder and run:

```sh
cd desktop
npm install
npm run dev
```

### Windows

If you are using the ZIP, skip this section. To run the source code, open **PowerShell** in the repository folder and run:

```powershell
cd desktop
npm install
npm run dev
```

### Open and close the preview (both systems)

Open the address shown in the terminal, normally **http://127.0.0.1:5174/**. Keep the terminal running while using this preview. Press **Ctrl+C** to stop it when finished. Next time, run `npm run dev` from `desktop`; you do not need to reinstall dependencies unless they have changed.

To open the Electron version from the latest source instead, stop the preview and run:

```sh
npm run electron
```

The browser preview and Electron app store their local records separately. Export a JSON workspace backup and import it if you want to move your work between them.

## Set up the backend

The backend stores a separate server copy of your workspace. You can record coordinates and export files without it. You only need it for **Save workspace** to sync online and **Open from backend** to load a server copy.

The steps below run the backend on the same computer as the desktop app. You need the project source folder, **Python 3.12** and **Docker Desktop**. Open Docker Desktop and wait until it is running.

### macOS: first-time setup

Open a separate **Terminal** window in the repository folder. Run:

```sh
cd backend
docker compose up -d
python3.12 -m venv venv
./venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
```

Skip the last command if `.env` already exists. Then follow **Backend settings** below.

### Windows: first-time setup

Open PowerShell in the project folder and run these commands one at a time:

```powershell
cd backend
docker compose up -d
py -3.12 -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

The Docker command starts the database. The next two commands prepare Python and install the backend packages. The last command creates the settings file; skip it if you already have a `.env` file.

### Backend settings (both systems)

Open `backend/.env` in a text editor. For the default local setup, it should contain:

```dotenv
DATABASE_URL=postgresql://postgres:password@localhost:5432/graveyard_db
CORS_ORIGINS=app://osteoplot
```

The second line allows the Electron app on either system to connect. If `CORS_ORIGINS` already contains other addresses, add `app://osteoplot` to that list, separated by a comma.

### Start the backend

From the `backend` folder, run:

**macOS — Terminal:**

```sh
./venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Windows — PowerShell:**

```powershell
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Keep this terminal open. Visit **http://127.0.0.1:8000/docs** in a browser. If the API documentation page opens, the backend has started. The database tables are created automatically on startup.

## Use the backend in desktop (both systems)

The desktop app uses **http://127.0.0.1:8000** by default, so no address change is needed when both run on the same computer.

- Click **Save workspace** to save locally and send the full desktop workspace to the backend. Wait for **Backend saved**.
- Click **Open from backend** to choose a saved workspace. Opening it replaces the current local workspace, so export a backup first if you want to keep both.
- If the app shows **Local only**, your work has not synced to the server. Check that Docker and the backend are running, then save again.
- If it shows **Backend conflict**, export your local work before opening the server copy to compare the changes.

Desktop and mobile use the same backend software, but their stored records are separate. Mobile skeletons will not appear in the desktop workspace list.

## Next time and shutdown

Next time, open Docker Desktop, open a terminal in `backend`, and run:

**macOS:**

```sh
docker compose up -d
./venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Windows:**

```powershell
docker compose up -d
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

You do not need to repeat the installation steps.

When finished, press **Ctrl+C** in the backend terminal, then run:

```powershell
docker compose stop
```

This stops the database without deleting its saved data. Close the desktop window too. If you also started the browser preview, press **Ctrl+C** in that terminal.

## If it will not connect

- **Docker command fails:** check that Docker Desktop is open and running.
- **Database connection error:** run `docker compose up -d` from `backend` and check the `DATABASE_URL` line in `.env`.
- **The `/docs` page opens, but Electron cannot connect:** check `CORS_ORIGINS=app://osteoplot` and restart the backend after changing `.env`.
- **Using a server on another computer:** ask the teammate managing it for the server address. For a source build, set `VITE_API_URL` in `desktop/.env.local` and restart the preview or rebuild the app. An existing Windows ZIP needs to be rebuilt with the correct address.

For further backend details, see [the backend README](../backend/README.md).
