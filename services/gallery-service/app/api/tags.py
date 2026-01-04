from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel

from app.db.session import get_db

router = APIRouter()


class TagCreate(BaseModel):
    name: str


def get_user_id_from_header(x_user_id: Optional[str] = Header(None)) -> Optional[str]:
    return x_user_id


@router.get("/")
async def list_tags(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """List user's tags"""
    return {"tags": []}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_tag(
    tag: TagCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Create a new tag"""
    return {"id": "placeholder", "name": tag.name}


@router.delete("/{tag_id}")
async def delete_tag(
    tag_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Delete tag"""
    return {"message": "Tag deleted"}


@router.post("/images/{image_id}/tags/{tag_id}")
async def add_tag_to_image(
    image_id: UUID,
    tag_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Add tag to image"""
    return {"message": "Tag added to image"}


@router.delete("/images/{image_id}/tags/{tag_id}")
async def remove_tag_from_image(
    image_id: UUID,
    tag_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Remove tag from image"""
    return {"message": "Tag removed from image"}
