from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel

from app.db.session import get_db

router = APIRouter()


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    prompt: str
    negative_prompt: Optional[str] = None
    width: int = 1024
    height: int = 1024
    is_public: bool = False


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    is_public: Optional[bool] = None


def get_user_id_from_header(x_user_id: Optional[str] = Header(None)) -> Optional[str]:
    return x_user_id


# Pre-defined marketing templates
DEFAULT_TEMPLATES = [
    {
        "id": "template-1",
        "name": "Instagram 포스트",
        "description": "정사각형 인스타그램 포스트용 템플릿",
        "category": "social",
        "prompt": "Professional product photography, clean white background, soft lighting, minimalist style",
        "negative_prompt": "blurry, low quality, distorted",
        "width": 1080,
        "height": 1080,
        "is_public": True,
    },
    {
        "id": "template-2",
        "name": "페이스북 커버",
        "description": "페이스북 페이지 커버 이미지",
        "category": "social",
        "prompt": "Wide banner image, professional design, corporate style, modern aesthetic",
        "negative_prompt": "blurry, low quality, cluttered",
        "width": 820,
        "height": 312,
        "is_public": True,
    },
    {
        "id": "template-3",
        "name": "이커머스 상품",
        "description": "온라인 쇼핑몰 상품 이미지",
        "category": "ecommerce",
        "prompt": "E-commerce product photo, white background, studio lighting, high detail, commercial photography",
        "negative_prompt": "shadows, reflections, blurry, low resolution",
        "width": 1024,
        "height": 1024,
        "is_public": True,
    },
    {
        "id": "template-4",
        "name": "배너 광고",
        "description": "웹사이트 배너 광고용",
        "category": "advertising",
        "prompt": "Eye-catching banner design, vibrant colors, modern typography space, call to action friendly",
        "negative_prompt": "cluttered, too many elements, blurry text",
        "width": 1200,
        "height": 628,
        "is_public": True,
    },
    {
        "id": "template-5",
        "name": "럭셔리 브랜드",
        "description": "프리미엄 브랜드 이미지",
        "category": "branding",
        "prompt": "Luxury brand aesthetic, elegant, sophisticated, premium quality, gold accents, minimalist",
        "negative_prompt": "cheap looking, cluttered, low quality",
        "width": 1024,
        "height": 1024,
        "is_public": True,
    },
]


@router.get("/")
async def list_templates(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """List templates (public + user's own)"""
    templates = DEFAULT_TEMPLATES
    if category:
        templates = [t for t in templates if t["category"] == category]

    return {
        "templates": templates,
        "total": len(templates),
    }


@router.get("/categories")
async def list_categories():
    """List available template categories"""
    return {
        "categories": [
            {"id": "social", "name": "소셜 미디어"},
            {"id": "ecommerce", "name": "이커머스"},
            {"id": "advertising", "name": "광고"},
            {"id": "branding", "name": "브랜딩"},
            {"id": "email", "name": "이메일 마케팅"},
        ]
    }


@router.get("/{template_id}")
async def get_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get template details"""
    for template in DEFAULT_TEMPLATES:
        if template["id"] == template_id:
            return template

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Template not found",
    )


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_template(
    template: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Create a custom template"""
    # Placeholder - implement with actual database insert
    return {
        "id": "new-template-id",
        **template.model_dump(),
    }


@router.put("/{template_id}")
async def update_template(
    template_id: UUID,
    template: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Update a template"""
    return {"message": "Template updated"}


@router.delete("/{template_id}")
async def delete_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Delete a template"""
    return {"message": "Template deleted"}
