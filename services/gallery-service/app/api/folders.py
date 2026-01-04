from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel

from app.db.session import get_db

router = APIRouter()


class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[UUID] = None


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[UUID] = None


def get_user_id_from_header(x_user_id: Optional[str] = Header(None)) -> Optional[str]:
    return x_user_id


@router.get("/")
async def list_folders(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """List user's folders"""
    # Placeholder
    return {"folders": []}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_folder(
    folder: FolderCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Create a new folder"""
    # Placeholder
    return {"id": "placeholder", "name": folder.name}


@router.get("/{folder_id}")
async def get_folder(
    folder_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Get folder details"""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Folder not found",
    )


@router.put("/{folder_id}")
async def update_folder(
    folder_id: UUID,
    folder: FolderUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Update folder"""
    return {"message": "Folder updated"}


@router.delete("/{folder_id}")
async def delete_folder(
    folder_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Delete folder"""
    return {"message": "Folder deleted"}
