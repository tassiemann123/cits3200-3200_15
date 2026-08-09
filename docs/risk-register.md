# Risk Register

**3D Skeleton Plotter — CITS3200 Professional Computing**

> Working draft, populated from our internal team discussion and Client meeting. Edit, add, or reprioritise as a team. Likelihood/Impact scored 1 (low) to 5 (high).

| # | Risk | Likelihood | Impact | Exposure (L×I) | Mitigation | Owner |
|---|------|:---:|:---:|:---:|------|-------|
| 1 | Dual-platform requirement (Android + desktop) exceeds available time given team's current skillset | 4 | 5 | 20 | Confirm shared-codebase approach (e.g. Capacitor) early to avoid building two separate apps; prioritise P1/P2 features first | |
| 2 | No prior Android/mobile development experience within the team | 4 | 4 | 16 | Capacitor + React/TS prototype already started, leveraging existing web/JS skills rather than native Android; allocate learning time in Weeks 3–4 | |
| 3 | Team split on tech stack direction (Python/pandas desktop path vs. Capacitor/React shared path) not yet formally resolved | 3 | 4 | 12 | Decide as a team this week; document decision and rationale in Scope of Work | |
| 4 | Open-source-only constraint limits available libraries/tools for 3D rendering and skeleton rigging | 3 | 3 | 9 | Research and shortlist open-source 3D libraries early; validate feasibility before committing | |
| 5 | Coordinate/CSV import format not finalised until Client provides sample data and reference files | 3 | 3 | 9 | Draft format proposed already (skeleton, joint, X, Y, Z); adjust once sample data received; keep parser modular | |
| 6 | Missing/incomplete skeletal data (common in real excavation — Client confirmed bodies are often found with missing limbs) breaks rigid parent-child rig assumptions | 3 | 4 | 12 | Build missing-data flagging early; test rig against intentionally incomplete datasets | |
| 7 | Team time constraints — most members concurrently taking 3–4 other units, several in heavy statistics/data-science loads | 4 | 3 | 12 | Track Booked Hours weekly; PM monitors against ~60hr/person budget; flag early if falling behind | |
| 8 | Scope creep from evolving Client requirements (Agile assumes changing scope, but time is tight) | 3 | 3 | 9 | All scope changes discussed and agreed with Client before implementation; changes logged in Scope of Work | |
| 9 | Uneven team contribution / one person doing disproportionate work | 2 | 4 | 8 | Weekly Booked Hours review by PM; roles rotated per unit requirements; PM has flagged this openly with the team already | |
| 10 | Client's email correspondence going astray (already happened once — sample files failed to send/receive) | 2 | 2 | 4 | Confirm receipt of key files promptly; use alternative transfer method (e.g. shared drive) if email issues recur | |
| 11 | [Add further risks identified as development progresses] | | | | | |

---
*Draft — review and assign Owners as a team before Sprint 1 submission.*
