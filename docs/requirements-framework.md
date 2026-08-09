# Requirements Framework

**Compiled from Client Meeting 1 with Dr Ambika Flavel**

> Reference document — feeds directly into Scope of Work and Acceptance Tests. Edit as requirements are clarified further.

| Feature area | Requirement | Platform | Priority | Key notes / constraints |
|---|---|---|---|---|
| Coordinate Input | Manual XYZ entry via sidebar (mobile, single skeleton); CSV/Excel import (desktop, multi-skeleton) | Both | High (P1) | CSV format: skeleton, joint, X, Y, Z. Client will build matching Excel-to-CSV export. |
| Skeleton Model & Rigging | Parent-child rig, ~24 joints (head, neck, shoulders, elbows, wrists, fingertips, hips, knees, etc.) | Both | High | Must tolerate missing limbs/bones. Bones must not overlap. No anatomical rotation realism required. |
| Multi-Skeleton Layering | Multiple skeletons placed within a shared, user-defined site/grave area | Desktop | High (P2) | Area size set by user first; environment scales as skeletons are added. |
| Colour-Coding | Default unique colour per skeleton; manual override; duplicate colours allowed (ID on click); black-and-white mode | Both | Medium (P3) | Confirmed as lower priority — simplify first if time-constrained. |
| Export | Visual export (PNG/JPG/screenshot, TBD); CSV coordinate export | Both | Medium (P3) | Team to propose concrete visual export format options to Client. |
| 3D Viewport | Orbit, pan, zoom; bone-like visual style, not fully anatomical | Desktop | Lower (P4) | Lowest priority of the five core features per Client's ranking. |
| Missing Data Handling | Flag/notify user when expected joint or bone data is missing; dismissible | Both | Supporting | Directly tied to rigging robustness. |
| Body Scaling | Bone lengths scale proportionally from input joint coordinates | Both | Supporting | No separate male/female/child template models needed. |
| Field Workflow | Mobile: single-skeleton entry + visual check on-site; Desktop: full multi-skeleton site reconstruction | Both | Foundational | Data flows from mobile capture into desktop build. |
| Client Communication | Weekly email for small updates; ad-hoc call/chat for larger items | N/A | Process | Ongoing throughout project. |

---
*Source: Client Meeting 1 minutes — see `minutes/` folder for full transcript-derived notes.*
