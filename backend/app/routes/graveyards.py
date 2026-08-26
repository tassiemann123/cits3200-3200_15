import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/graveyards", tags=["graveyards"])


@router.post("/", response_model=schemas.GraveyardOut)
def create_graveyard(payload: schemas.GraveyardCreate, db: Session = Depends(get_db)):
    graveyard = models.Graveyard(**payload.model_dump())
    db.add(graveyard)
    db.commit()
    db.refresh(graveyard)
    return graveyard


@router.get("/", response_model=list[schemas.GraveyardOut])
def list_graveyards(db: Session = Depends(get_db)):
    return db.query(models.Graveyard).all()


@router.get("/{graveyard_id}", response_model=schemas.GraveyardOut)
def get_graveyard(graveyard_id: uuid.UUID, db: Session = Depends(get_db)):
    graveyard = db.query(models.Graveyard).filter(models.Graveyard.graveyard_id == graveyard_id).first()
    if not graveyard:
        raise HTTPException(status_code=404, detail="Graveyard not found")
    return graveyard


@router.put("/{graveyard_id}", response_model=schemas.GraveyardOut)
def update_graveyard(graveyard_id: uuid.UUID, payload: schemas.GraveyardUpdate, db: Session = Depends(get_db)):
    graveyard = db.query(models.Graveyard).filter(models.Graveyard.graveyard_id == graveyard_id).first()
    if not graveyard:
        raise HTTPException(status_code=404, detail="Graveyard not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(graveyard, key, value)

    db.commit()
    db.refresh(graveyard)
    return graveyard


@router.get("/{graveyard_id}/skeletons", response_model=list[schemas.SkeletonOut])
def get_graveyard_skeletons(graveyard_id: uuid.UUID, db: Session = Depends(get_db)):
    graveyard = db.query(models.Graveyard).filter(models.Graveyard.graveyard_id == graveyard_id).first()
    if not graveyard:
        raise HTTPException(status_code=404, detail="Graveyard not found")

    return db.query(models.Skeleton).filter(models.Skeleton.graveyard_id == graveyard_id).all()


@router.delete("/{graveyard_id}")
def delete_graveyard(graveyard_id: uuid.UUID, db: Session = Depends(get_db)):
    graveyard = db.query(models.Graveyard).filter(models.Graveyard.graveyard_id == graveyard_id).first()
    if not graveyard:
        raise HTTPException(status_code=404, detail="Graveyard not found")
    db.delete(graveyard)
    db.commit()
    return {"status": "deleted"}