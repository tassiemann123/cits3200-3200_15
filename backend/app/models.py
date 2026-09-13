import uuid
from sqlalchemy import Column, String, Text, Float, ForeignKey, TIMESTAMP, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


class Graveyard(Base):
    __tablename__ = "graveyard"

    graveyard_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    location = Column(String(255))
    description = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    skeletons = relationship(
        "Skeleton",
        back_populates="graveyard",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Skeleton(Base):
    __tablename__ = "skeleton"

    skeleton_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    graveyard_id = Column(UUID(as_uuid=True), ForeignKey("graveyard.graveyard_id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255))
    description = Column(Text)
    pos_x = Column(Float)
    pos_y = Column(Float)
    pos_z = Column(Float)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    graveyard = relationship("Graveyard", back_populates="skeletons")
    coordinates = relationship(
        "Coordinate",
        back_populates="skeleton",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Coordinate(Base):
    __tablename__ = "coordinate"

    coordinate_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skeleton_id = Column(UUID(as_uuid=True), ForeignKey("skeleton.skeleton_id", ondelete="CASCADE"), nullable=False)
    joint_name = Column(String(50), nullable=False)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    z = Column(Float, nullable=False)

    skeleton = relationship("Skeleton", back_populates="coordinates")

    __table_args__ = (
        UniqueConstraint("skeleton_id", "joint_name", name="uq_skeleton_joint"),
    )