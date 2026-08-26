import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/skeletons", tags=["skeletons"])


@router.post("/", response_model=schemas.SkeletonOut)
def create_skeleton(payload: schemas.SkeletonCreate, db: Session = Depends(get_db)):
    graveyard = db.query(models.Graveyard).filter(
        models.Graveyard.graveyard_id == payload.graveyard_id
    ).first()
    if not graveyard:
        raise HTTPException(status_code=404, detail="Graveyard not found")

    skeleton = models.Skeleton(**payload.model_dump())
    db.add(skeleton)
    db.commit()
    db.refresh(skeleton)
    return skeleton


@router.get("/{skeleton_id}", response_model=schemas.SkeletonWithCoordinates)
def get_skeleton(skeleton_id: uuid.UUID, db: Session = Depends(get_db)):
    skeleton = (
        db.query(models.Skeleton)
        .options(joinedload(models.Skeleton.coordinates))
        .filter(models.Skeleton.skeleton_id == skeleton_id)
        .first()
    )
    if not skeleton:
        raise HTTPException(status_code=404, detail="Skeleton not found")
    return skeleton


@router.put("/{skeleton_id}", response_model=schemas.SkeletonOut)
def update_skeleton(skeleton_id: uuid.UUID, payload: schemas.SkeletonUpdate, db: Session = Depends(get_db)):
    skeleton = db.query(models.Skeleton).filter(models.Skeleton.skeleton_id == skeleton_id).first()
    if not skeleton:
        raise HTTPException(status_code=404, detail="Skeleton not found")

    # graveyard_id is intentionally excluded from SkeletonUpdate — reassigning a
    # skeleton to a different graveyard isn't allowed via this endpoint.
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(skeleton, key, value)

    db.commit()
    db.refresh(skeleton)
    return skeleton


@router.delete("/{skeleton_id}")
def delete_skeleton(skeleton_id: uuid.UUID, db: Session = Depends(get_db)):
    skeleton = db.query(models.Skeleton).filter(models.Skeleton.skeleton_id == skeleton_id).first()
    if not skeleton:
        raise HTTPException(status_code=404, detail="Skeleton not found")
    db.delete(skeleton)
    db.commit()
    return {"status": "deleted"}


@router.post("/{skeleton_id}/coordinates", response_model=schemas.CoordinateOut)
def add_coordinate(skeleton_id: uuid.UUID, payload: schemas.CoordinateCreate, db: Session = Depends(get_db)):
    skeleton = db.query(models.Skeleton).filter(models.Skeleton.skeleton_id == skeleton_id).first()
    if not skeleton:
        raise HTTPException(status_code=404, detail="Skeleton not found")

    coordinate = models.Coordinate(skeleton_id=skeleton_id, **payload.model_dump())
    db.add(coordinate)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"Coordinate for joint '{payload.joint_name}' already exists on this skeleton",
        )
    db.refresh(coordinate)
    return coordinate


@router.post("/{skeleton_id}/coordinates/bulk", response_model=list[schemas.CoordinateOut])
def add_coordinates_bulk(skeleton_id: uuid.UUID, payload: list[schemas.CoordinateCreate], db: Session = Depends(get_db)):
    skeleton = db.query(models.Skeleton).filter(models.Skeleton.skeleton_id == skeleton_id).first()
    if not skeleton:
        raise HTTPException(status_code=404, detail="Skeleton not found")

    joint_names = [item.joint_name for item in payload]
    if len(joint_names) != len(set(joint_names)):
        raise HTTPException(status_code=400, detail="Duplicate joint_name values in request body")

    coordinates = [models.Coordinate(skeleton_id=skeleton_id, **item.model_dump()) for item in payload]
    db.add_all(coordinates)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="One or more joints already have coordinates for this skeleton",
        )
    for c in coordinates:
        db.refresh(c)
    return coordinates


@router.put("/{skeleton_id}/coordinates/{coordinate_id}", response_model=schemas.CoordinateOut)
def update_coordinate(
    skeleton_id: uuid.UUID,
    coordinate_id: uuid.UUID,
    payload: schemas.CoordinateCreate,
    db: Session = Depends(get_db),
):
    coordinate = (
        db.query(models.Coordinate)
        .filter(
            models.Coordinate.coordinate_id == coordinate_id,
            models.Coordinate.skeleton_id == skeleton_id,
        )
        .first()
    )
    if not coordinate:
        raise HTTPException(status_code=404, detail="Coordinate not found")

    for key, value in payload.model_dump().items():
        setattr(coordinate, key, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"Coordinate for joint '{payload.joint_name}' already exists on this skeleton",
        )
    db.refresh(coordinate)
    return coordinate


@router.delete("/{skeleton_id}/coordinates/{coordinate_id}")
def delete_coordinate(skeleton_id: uuid.UUID, coordinate_id: uuid.UUID, db: Session = Depends(get_db)):
    coordinate = (
        db.query(models.Coordinate)
        .filter(
            models.Coordinate.coordinate_id == coordinate_id,
            models.Coordinate.skeleton_id == skeleton_id,
        )
        .first()
    )
    if not coordinate:
        raise HTTPException(status_code=404, detail="Coordinate not found")

    db.delete(coordinate)
    db.commit()
    return {"status": "deleted"}