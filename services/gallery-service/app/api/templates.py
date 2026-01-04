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


# Pre-defined marketing templates with thumbnail images
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
        "thumbnail": "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400&h=400&fit=crop",
        "icon": "📸",
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
        "thumbnail": "https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=820&h=312&fit=crop",
        "icon": "👍",
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
        "thumbnail": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop",
        "icon": "🛍️",
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
        "thumbnail": "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&h=314&fit=crop",
        "icon": "🎯",
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
        "thumbnail": "https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&h=400&fit=crop",
        "icon": "✨",
    },
    {
        "id": "template-6",
        "name": "유튜브 썸네일",
        "description": "유튜브 영상 썸네일 이미지",
        "category": "social",
        "prompt": "YouTube thumbnail, bold colors, dramatic lighting, attention grabbing, 16:9 ratio, professional",
        "negative_prompt": "blurry, low quality, boring, plain",
        "width": 1280,
        "height": 720,
        "is_public": True,
        "thumbnail": "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=640&h=360&fit=crop",
        "icon": "▶️",
    },
    {
        "id": "template-7",
        "name": "인스타 스토리",
        "description": "인스타그램 스토리용 세로형 이미지",
        "category": "social",
        "prompt": "Vertical Instagram story, trendy design, vibrant colors, mobile optimized, engaging visual",
        "negative_prompt": "horizontal, landscape, blurry, low quality",
        "width": 1080,
        "height": 1920,
        "is_public": True,
        "thumbnail": "https://images.unsplash.com/photo-1616469829581-73993eb86b02?w=270&h=480&fit=crop",
        "icon": "📱",
    },
    {
        "id": "template-8",
        "name": "프로모션 배너",
        "description": "할인/이벤트 프로모션용 배너",
        "category": "advertising",
        "prompt": "Sale promotion banner, exciting colors, discount badge, attention grabbing, marketing material, festive",
        "negative_prompt": "boring, plain, low energy, cluttered",
        "width": 1200,
        "height": 624,
        "is_public": True,
        "thumbnail": "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=600&h=312&fit=crop",
        "icon": "🎉",
    },
    {
        "id": "template-9",
        "name": "패션 룩북",
        "description": "패션 브랜드 룩북 이미지",
        "category": "ecommerce",
        "prompt": "Fashion lookbook, model photography, trendy style, editorial, high fashion, professional lighting",
        "negative_prompt": "amateur, low quality, bad posture, unflattering",
        "width": 1024,
        "height": 1536,
        "is_public": True,
        "thumbnail": "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=340&h=510&fit=crop",
        "icon": "👗",
    },
    {
        "id": "template-10",
        "name": "음식 사진",
        "description": "레스토랑/카페 메뉴용 음식 사진",
        "category": "ecommerce",
        "prompt": "Food photography, appetizing, professional styling, warm lighting, restaurant quality, delicious looking",
        "negative_prompt": "unappetizing, messy, bad lighting, amateur",
        "width": 1080,
        "height": 1080,
        "is_public": True,
        "thumbnail": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop",
        "icon": "🍽️",
    },
    {
        "id": "template-11",
        "name": "부동산 광고",
        "description": "부동산 매물 홍보용 이미지",
        "category": "advertising",
        "prompt": "Real estate photography, interior design, bright and airy, professional architecture, inviting home",
        "negative_prompt": "dark, cluttered, messy, unappealing",
        "width": 1200,
        "height": 800,
        "is_public": True,
        "thumbnail": "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=400&fit=crop",
        "icon": "🏠",
    },
    {
        "id": "template-12",
        "name": "기업 브랜딩",
        "description": "기업 소개/브랜딩용 이미지",
        "category": "branding",
        "prompt": "Corporate branding, professional team, modern office, business aesthetic, trustworthy, clean design",
        "negative_prompt": "unprofessional, messy, casual, low quality",
        "width": 1920,
        "height": 1080,
        "is_public": True,
        "thumbnail": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=640&h=360&fit=crop",
        "icon": "🏢",
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
