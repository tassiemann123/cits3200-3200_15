"""Separate project storage for the desktop app's bone-owned endpoint schema."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/desktop/workspaces", tags=["desktop workspaces"])
MAX_PROJECT_BYTES = 5 * 1024 * 1024


def checked_project(project: dict) -> tuple[str, dict]:
    if project.get("version") != 1:
        raise HTTPException(status_code=422, detail="Unsupported desktop project version")
    name = project.get("name")
    people = project.get("individuals")
    graveyards = project.get("graveyards")
    if not isinstance(name, str) or not name.strip() or len(name) > 255:
        raise HTTPException(status_code=422, detail="Invalid desktop workspace name")
    if not isinstance(people, list) or not 1 <= len(people) <= 100:
        raise HTTPException(status_code=422, detail="Desktop workspace must contain 1–100 individuals")
    if not isinstance(graveyards, list) or not graveyards:
        raise HTTPException(status_code=422, detail="Desktop workspace must contain graveyards")
    try:
        project_bytes = len(json.dumps(project, allow_nan=False).encode("utf-8"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Desktop workspace contains invalid values")
    if project_bytes > MAX_PROJECT_BYTES:
        raise HTTPException(status_code=413, detail="Desktop workspace exceeds 5 MB")
    return name.strip(), project


def result(workspace: models.DesktopWorkspace) -> schemas.DesktopWorkspaceOut:
    return schemas.DesktopWorkspaceOut(
        workspace_id=workspace.workspace_id,
        name=workspace.name,
        revision=workspace.revision,
        updated_at=workspace.updated_at,
        project=workspace.project_data,
    )


@router.get("/", response_model=list[schemas.DesktopWorkspaceSummary])
def list_workspaces(db: Session = Depends(get_db)):
    return db.query(models.DesktopWorkspace).order_by(models.DesktopWorkspace.updated_at.desc()).all()


@router.post("/", response_model=schemas.DesktopWorkspaceOut, status_code=201)
def create_workspace(payload: schemas.DesktopWorkspaceCreate, db: Session = Depends(get_db)):
    name, project = checked_project(payload.project)
    workspace = models.DesktopWorkspace(name=name, project_data=project)
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return result(workspace)


@router.get("/{workspace_id}", response_model=schemas.DesktopWorkspaceOut)
def get_workspace(workspace_id: uuid.UUID, db: Session = Depends(get_db)):
    workspace = db.get(models.DesktopWorkspace, str(workspace_id))
    if workspace is None:
        raise HTTPException(status_code=404, detail="Desktop workspace not found")
    return result(workspace)


@router.put("/{workspace_id}", response_model=schemas.DesktopWorkspaceOut)
def update_workspace(
    workspace_id: uuid.UUID,
    payload: schemas.DesktopWorkspaceUpdate,
    db: Session = Depends(get_db),
):
    name, project = checked_project(payload.project)
    if payload.expected_revision < 1:
        raise HTTPException(status_code=422, detail="Invalid workspace revision")
    changed = db.execute(
        update(models.DesktopWorkspace)
        .where(models.DesktopWorkspace.workspace_id == str(workspace_id))
        .where(models.DesktopWorkspace.revision == payload.expected_revision)
        .values(
            name=name,
            project_data=project,
            revision=models.DesktopWorkspace.revision + 1,
        )
    )
    if changed.rowcount == 0:
        db.rollback()
        if db.get(models.DesktopWorkspace, str(workspace_id)) is None:
            raise HTTPException(status_code=404, detail="Desktop workspace not found")
        raise HTTPException(status_code=409, detail="Desktop workspace changed on another device; reload it before saving")
    db.commit()
    return get_workspace(workspace_id, db)
