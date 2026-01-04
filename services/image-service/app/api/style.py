"""
Style transfer API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID, uuid4
from celery import Celery

from app.db.session import get_db
from app.config import settings
from app.models.image import Image
from app.schemas.advanced_edit import (
    StyleTransferRequest,
    StyleTransferResponse,
    StyleTaskStatusResponse,
    StylePresetsResponse,
    StylePreset,
)

router = APIRouter(prefix="/style", tags=["Style Transfer"])

# Celery client
celery_app = Celery(
    "image_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# Available style presets
STYLE_PRESETS = [
    StylePreset(id="oil_painting", name="유화", description="클래식한 유화 스타일 - 두꺼운 브러시 터치와 풍부한 질감"),
    StylePreset(id="watercolor", name="수채화", description="수채화 스타일 - 부드러운 색감과 투명한 느낌"),
    StylePreset(id="anime", name="애니메이션", description="일본 애니메이션 스타일 - 선명한 윤곽과 생동감 있는 색상"),
    StylePreset(id="manga", name="만화", description="일본 만화 스타일 - 흑백 톤과 스크린톤 효과"),
    StylePreset(id="sketch", name="스케치", description="연필 스케치 스타일 - 세밀한 선화 표현"),
    StylePreset(id="pop_art", name="팝아트", description="팝아트 스타일 - 대담한 색상과 하프톤 효과"),
    StylePreset(id="impressionist", name="인상파", description="인상파 스타일 - 빛과 색의 표현"),
    StylePreset(id="cyberpunk", name="사이버펑크", description="사이버펑크 스타일 - 네온 조명과 미래적 분위기"),
    StylePreset(id="vintage", name="빈티지", description="빈티지 스타일 - 세피아 톤과 필름 그레인"),
    StylePreset(id="minimalist", name="미니멀리스트", description="미니멀리스트 스타일 - 단순하고 깔끔한 디자인"),
    StylePreset(id="fantasy", name="판타지", description="판타지 스타일 - 마법적이고 몽환적인 분위기"),
    StylePreset(id="gothic", name="고딕", description="고딕 스타일 - 어둡고 신비로운 분위기"),
]

VALID_STYLES = {preset.id for preset in STYLE_PRESETS}


def get_user_id_from_header(x_user_id: Optional[str] = Header(None)) -> Optional[str]:
    """Get user ID from header."""
    return x_user_id or "00000000-0000-0000-0000-000000000001"


async def get_image_url(db: AsyncSession, image_id: UUID) -> str:
    """Get image URL by ID."""
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )
    return image.url


@router.get("/presets", response_model=StylePresetsResponse)
async def get_style_presets():
    """
    Get list of available style presets.

    Each preset includes id, name, and description.
    """
    return StylePresetsResponse(styles=STYLE_PRESETS)


@router.post("/apply", response_model=StyleTransferResponse, status_code=status.HTTP_202_ACCEPTED)
async def apply_style(
    request: StyleTransferRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """
    Apply artistic style to image.

    Choose from predefined style presets and optionally customize with:
    - Additional prompt for more specific styling
    - Strength override (0.0-1.0) - higher = more stylization
    - Seed for reproducible results
    """
    # Validate style
    if request.style not in VALID_STYLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid style. Available styles: {', '.join(VALID_STYLES)}"
        )

    # Validate strength if provided
    if request.strength is not None and not (0.0 <= request.strength <= 1.0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Strength must be between 0.0 and 1.0"
        )

    image_url = await get_image_url(db, request.image_id)

    task_id = uuid4()
    celery_app.send_task(
        "apply_style",
        kwargs={
            "task_id": str(task_id),
            "image_url": image_url,
            "style": request.style,
            "user_id": user_id,
            "prompt": request.prompt,
            "strength": request.strength,
            "seed": request.seed,
        },
        queue="image_generation",
    )

    return StyleTransferResponse(
        task_id=task_id,
        status="pending",
        estimated_time=10.0,
    )


@router.get("/tasks/{task_id}", response_model=StyleTaskStatusResponse)
async def get_style_task_status(
    task_id: UUID,
    user_id: str = Depends(get_user_id_from_header),
):
    """Get style transfer task status."""
    celery_result = celery_app.AsyncResult(str(task_id))

    if celery_result.ready():
        result_data = celery_result.result
        if isinstance(result_data, dict):
            return StyleTaskStatusResponse(
                task_id=task_id,
                status=result_data.get("status", "unknown"),
                style=result_data.get("style"),
                image=result_data.get("image"),
                error=result_data.get("error"),
            )

    return StyleTaskStatusResponse(
        task_id=task_id,
        status="processing" if celery_result.state == "STARTED" else "pending",
    )
