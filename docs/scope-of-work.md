# Scope of Work

**3D Skeleton Plotter — CITS3200 Professional Computing**
**Client:** Dr Ambika Flavel, Centre for Forensic Anthropology, UWA
**Date:** [insert date]

> Working draft, populated from our internal team discussion and the Client meeting. Edit directly — nothing here is locked in.

## 1. Purpose

This document defines the agreed scope of work for the 3D Skeleton Plotter project, undertaken by our CITS3200 team on behalf of Dr Ambika Flavel. It reflects requirements confirmed in our Client meeting and is intended to guide development across Sprints 1–3.

## 2. Background

Forensic anthropologists and bioarchaeologists currently record the spatial position of skeletal remains manually — on paper during excavation, then typed up back at the office using error-prone, unstandardised files. Ambika described spending "ages trying to figure out why this file is not opening" with her team's current tooling. This project replaces that process with a tool that accepts joint coordinate data and produces an accurate, inspectable 3D reconstruction of one or more skeletons within a shared site/grave environment.

## 3. Objective

Develop an application that accepts XYZ joint coordinate data (manual entry or file import) and renders it as a positioned, colour-coded, exportable skeleton model — supporting both on-site fieldwork and full multi-skeleton site reconstruction.

## 4. Platform Approach

- **Mobile (Android, preferred):** on-site fieldwork use — single-skeleton coordinate entry and a simplified visual check, so researchers can catch a bad measurement before leaving the site rather than discovering it back at the office.
- **Desktop/laptop:** full multi-skeleton site reconstruction, layering, and detailed 3D inspection once field data is collected.

Ambika's own framing: capture one skeleton on-site via phone, bring the data back, then build the whole site on a laptop. The two platforms serve different stages of the same workflow, not duplicate feature sets.

### Tech stack — open discussion
- Team skillset is predominantly **Python** (pandas for CSV handling raised as a natural fit for desktop), with data-science-heavy backgrounds (R, some C, SQL) but **no prior Android/mobile development experience** going in.
- A **Capacitor + React/TypeScript** prototype (`skeletal-annotation-android_draft/`) has already been started in the repo — this wraps a web app into an Android build, which may be a practical route given the team's stronger web/JS-adjacent skills versus native Android (Kotlin/Java).
- A parallel research note on **Python desktop technologies** also exists in `docs/research/`.
- **Open question for the team:** confirm whether we commit to the Capacitor/React path for both platforms (one shared codebase), or split desktop (Python) and mobile (Capacitor) — trade-off is one-codebase simplicity vs. playing to different platform strengths. Needs deciding before Sprint 1 closes.

## 5. In Scope — Core Features

| Priority | Feature | Description | Platform |
|---|---|---|---|
| P1 | Coordinate input | Manual XYZ entry via sidebar (mobile); CSV/Excel import (desktop) | Both |
| P1 | Skeleton rigging | Parent-child rig, ~24 joints (head, neck, shoulders, elbows, wrists, fingertips, hips, knees, etc.) | Both |
| P2 | Multi-skeleton layering | Multiple skeletons within a user-defined shared site area; area size set first, environment scales as skeletons are added | Desktop |
| P3 | Colour-coding | Default unique colour per skeleton; manual override; duplicate colours allowed (skeleton ID shown on click); black-and-white mode | Both |
| P3 | Export | Visual export (PNG/JPG/screenshot — exact format TBD with Client); CSV coordinate export | Both |
| P4 | 3D viewport | Orbit, pan, zoom; bone-like but not fully anatomically accurate — Ambika was explicit this isn't a priority | Desktop |
| Support | Missing data flagging | Notify user when a joint/bone is missing from input data; user can dismiss once reviewed | Both |
| Support | Proportional scaling | Bone lengths scale from input coordinates directly — no separate male/female/child template models needed | Both |

## 6. Out of Scope (Sprint 1)

- Fully anatomically accurate skeleton rendering (explicitly deprioritised by Client)
- Realistic joint articulation / inverse kinematics — bones don't need to move like real joints, just must not visually overlap
- Gendered or age-specific base skeleton models
- Any licensed or paid software, libraries, or assets (open-source only, per Client's requirement to avoid ongoing licensing costs)

## 7. Constraints

- Open-source technologies only
- Team time budget: ~60 hours per person across the semester, alongside other units (several team members are also taking 3 statistics/data-science units concurrently)
- Supporting two platforms (mobile + desktop) within the available timeframe — flagged in team discussion as a real risk given ~9 remaining weeks
- No prior Android development experience within the team going in

## 8. Assumptions

- Client will provide sample data and reference files (stick-figure example, "rotate" program file) to guide the import format
- Client will adapt her own Excel-based workflow to export directly to our proposed CSV structure (columns: skeleton, joint, X, Y, Z)
- Any scope changes will be discussed and agreed with the Client before implementation, given limited time available

## 9. Communication

- Weekly email updates for minor progress items
- Ad-hoc calls/short meetings for anything needing discussion — Client has offered to do quick morning chats when needed

---
*Draft — review and finalise as a team before Sprint 1 submission.*
