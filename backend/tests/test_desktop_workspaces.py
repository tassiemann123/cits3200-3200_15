import os
import unittest
import uuid

os.environ.setdefault("DATABASE_URL", "sqlite://")

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import models, schemas
from app.database import Base
from app.routes import desktop_workspaces


class DesktopWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.project = {
            "version": 1,
            "name": "Desktop field recording",
            "updatedAt": "2026-09-25T00:00:00Z",
            "graveyards": [{"id": "GY-001", "name": "Site A"}],
            "individuals": [{
                "id": "IND-001",
                "joints": [{
                    "id": "left_knee", "linked": False,
                    "endpoints": [
                        {"boneId": "left_femur", "coordinate": [1, 2, 3]},
                        {"boneId": "left_lower_leg", "coordinate": [4, 5, 6]},
                    ],
                }],
                "bones": [{"id": "left_femur", "status": "absent"}],
            }],
        }

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_round_trip_preserves_both_bone_endpoints_and_mobile_tables(self):
        created = desktop_workspaces.create_workspace(
            schemas.DesktopWorkspaceCreate(project=self.project), self.db
        )
        loaded = desktop_workspaces.get_workspace(uuid.UUID(created.workspace_id), self.db)
        self.assertEqual(loaded.project["individuals"][0]["joints"][0]["endpoints"],
                         self.project["individuals"][0]["joints"][0]["endpoints"])
        self.assertEqual(loaded.project["individuals"][0]["bones"][0]["status"], "absent")
        self.assertEqual(self.db.query(models.Skeleton).count(), 0)
        self.assertEqual(self.db.query(models.Graveyard).count(), 0)
        self.assertEqual(len(desktop_workspaces.list_workspaces(self.db)), 1)

    def test_revision_conflict_does_not_overwrite_remote_changes(self):
        created = desktop_workspaces.create_workspace(
            schemas.DesktopWorkspaceCreate(project=self.project), self.db
        )
        workspace_id = uuid.UUID(created.workspace_id)
        changed = {**self.project, "name": "Updated desktop recording"}
        saved = desktop_workspaces.update_workspace(
            workspace_id,
            schemas.DesktopWorkspaceUpdate(project=changed, expected_revision=1),
            self.db,
        )
        self.assertEqual(saved.revision, 2)
        with self.assertRaises(HTTPException) as context:
            desktop_workspaces.update_workspace(
                workspace_id,
                schemas.DesktopWorkspaceUpdate(project=self.project, expected_revision=1),
                self.db,
            )
        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(desktop_workspaces.get_workspace(workspace_id, self.db).project["name"], changed["name"])

    def test_rejects_invalid_project_without_creating_record(self):
        with self.assertRaises(HTTPException) as context:
            desktop_workspaces.create_workspace(
                schemas.DesktopWorkspaceCreate(project={**self.project, "individuals": []}), self.db
            )
        self.assertEqual(context.exception.status_code, 422)
        self.assertEqual(self.db.query(models.DesktopWorkspace).count(), 0)


if __name__ == "__main__":
    unittest.main()
