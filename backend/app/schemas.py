import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class GraveyardCreate(BaseModel):
    name: str
    location: Optional[str] = None
    description: Optional[str] = None


class GraveyardUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None


class GraveyardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    graveyard_id: uuid.UUID
    name: str
    location: Optional[str]
    description: Optional[str]
    created_at: datetime


class SkeletonCreate(BaseModel):
    graveyard_id: uuid.UUID
    name: Optional[str] = None
    description: Optional[str] = None
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None
    pos_z: Optional[float] = None


class SkeletonUpdate(BaseModel):
    # graveyard_id is intentionally excluded — reassigning a skeleton to a
    # different graveyard isn't allowed via the generic update endpoint.
    name: Optional[str] = None
    description: Optional[str] = None
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None
    pos_z: Optional[float] = None


class SkeletonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    skeleton_id: uuid.UUID
    graveyard_id: uuid.UUID
    name: Optional[str]
    description: Optional[str]
    pos_x: Optional[float]
    pos_y: Optional[float]
    pos_z: Optional[float]
    created_at: datetime
    updated_at: datetime


class CoordinateCreate(BaseModel):
    joint_name: str
    x: float
    y: float
    z: float


class CoordinateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    coordinate_id: uuid.UUID
    skeleton_id: uuid.UUID
    joint_name: str
    x: float
    y: float
    z: float


class SkeletonWithCoordinates(SkeletonOut):
    coordinates: List[CoordinateOut] = []