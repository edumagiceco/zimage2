# 이미지 편집 (Inpainting) 기능 설계서

## 1. 개요

### 1.1 목적
생성된 이미지의 특정 영역만 선택하여 수정하고, 나머지 부분과의 일관성을 유지하면서 새로운 이미지를 생성하는 기능

### 1.2 핵심 기술
- **Inpainting**: 마스크 기반 이미지 재생성
- **Stable Diffusion XL Inpainting**: 고품질 인페인팅 모델

---

## 2. 사용자 플로우

```
1. 갤러리/생성 결과에서 이미지 선택 → "편집" 버튼 클릭
2. 이미지 편집 페이지 (/edit/[imageId]) 이동
3. 브러시 도구로 수정할 영역 마스킹 (빨간색 오버레이)
4. 수정 프롬프트 입력 (예: "파란색 셔츠를 빨간색으로 변경")
5. "이미지 수정" 버튼 클릭
6. 생성 진행률 표시
7. 결과 비교 (원본 vs 수정본) 및 저장
```

---

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ ImageEditor  │  │ MaskCanvas   │  │ BrushTools   │              │
│  │  Component   │──│  (fabric.js) │──│  Component   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│         │                                                            │
│         ▼ POST /api/images/inpaint                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API Gateway                                   │
│                    (라우팅, 인증 검증)                                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Image Service                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ /api/inpaint │──│ InpaintTask  │──│   Celery     │              │
│  │   Endpoint   │  │    Model     │  │   Producer   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Celery Queue
┌─────────────────────────────────────────────────────────────────────┐
│                         ML Worker                                    │
│  ┌──────────────────────────────────────────────────────┐          │
│  │              Inpainting Pipeline                      │          │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │          │
│  │  │ Load Image │─▶│Apply Mask  │─▶│ SDXL       │     │          │
│  │  │ from MinIO │  │            │  │ Inpaint    │     │          │
│  │  └────────────┘  └────────────┘  └────────────┘     │          │
│  └──────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. API 설계

### 4.1 인페인팅 요청

```http
POST /api/images/inpaint
Content-Type: application/json
Authorization: Bearer {token}
```

**Request Body:**
```json
{
    "original_image_id": "550e8400-e29b-41d4-a716-446655440000",
    "mask_data": "data:image/png;base64,iVBORw0KGgo...",
    "prompt": "빨간색 드레스를 입은 여성",
    "negative_prompt": "blurry, low quality",
    "strength": 0.85,
    "guidance_scale": 7.5,
    "num_inference_steps": 30,
    "num_images": 1,
    "seed": null
}
```

**Response:**
```json
{
    "task_id": "660e8400-e29b-41d4-a716-446655440001",
    "status": "pending",
    "estimated_time": 15.0
}
```

### 4.2 작업 상태 조회

```http
GET /api/inpaint/tasks/{task_id}
```

**Response:**
```json
{
    "task_id": "660e8400-e29b-41d4-a716-446655440001",
    "status": "completed",
    "original_image": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "url": "https://..."
    },
    "result_images": [
        {
            "id": "770e8400-e29b-41d4-a716-446655440002",
            "url": "https://...",
            "width": 1024,
            "height": 1024
        }
    ],
    "created_at": "2026-01-04T12:00:00Z",
    "completed_at": "2026-01-04T12:00:15Z"
}
```

---

## 5. 파일 구조

### 5.1 Frontend

```
services/frontend/
├── app/
│   └── edit/
│       └── [imageId]/
│           └── page.tsx              # 편집 페이지
│
├── components/
│   └── features/
│       └── editor/
│           ├── ImageEditor.tsx       # 메인 편집 컴포넌트
│           ├── MaskCanvas.tsx        # 마스크 캔버스 (fabric.js)
│           ├── BrushToolbar.tsx      # 브러시 도구 모음
│           ├── PromptPanel.tsx       # 프롬프트 입력 패널
│           ├── ResultComparison.tsx  # 원본/수정본 비교
│           └── EditHistory.tsx       # 편집 히스토리
│
└── lib/
    └── canvas-utils.ts               # 캔버스 유틸리티 함수
```

### 5.2 Backend (image-service)

```
services/image-service/app/
├── api/
│   └── inpaint.py                    # 인페인팅 API 엔드포인트
├── schemas/
│   └── inpaint.py                    # 요청/응답 스키마
└── models/
    └── inpaint_task.py               # 편집 작업 모델
```

### 5.3 ML Worker

```
services/ml-worker/app/
├── tasks/
│   └── inpainting.py                 # Celery 인페인팅 태스크
└── ml/
    └── inpaint_pipeline.py           # 인페인팅 파이프라인
```

---

## 6. 데이터베이스 스키마

### 6.1 InpaintTask 테이블

```sql
CREATE TABLE inpaint_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    original_image_id UUID NOT NULL REFERENCES images(id),

    -- 작업 파라미터
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    strength FLOAT DEFAULT 0.85,
    guidance_scale FLOAT DEFAULT 7.5,
    num_inference_steps INTEGER DEFAULT 30,
    seed INTEGER,

    -- 마스크 저장 (MinIO 경로)
    mask_object_name VARCHAR(500),

    -- 상태
    status VARCHAR(20) DEFAULT 'pending',
    celery_task_id VARCHAR(255),
    error TEXT,

    -- 결과 (JSONB로 여러 이미지 저장)
    result JSONB DEFAULT '[]',

    -- 타임스탬프
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_inpaint_user_id ON inpaint_tasks(user_id);
CREATE INDEX idx_inpaint_original_image ON inpaint_tasks(original_image_id);
CREATE INDEX idx_inpaint_status ON inpaint_tasks(status);
```

### 6.2 이미지 편집 히스토리 테이블 (선택적)

```sql
CREATE TABLE image_edit_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID REFERENCES images(id),
    parent_image_id UUID REFERENCES images(id),
    edit_type VARCHAR(50),  -- 'inpaint', 'upscale', 'variation'
    edit_params JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 7. ML 파이프라인

### 7.1 Inpainting 파이프라인 코드

```python
# services/ml-worker/app/ml/inpaint_pipeline.py

from diffusers import AutoPipelineForInpainting
import torch
from PIL import Image
from typing import Optional

class InpaintPipeline:
    def __init__(self):
        self._pipeline = None
        self._is_loaded = False

    def load(self):
        """SDXL Inpainting 모델 로드"""
        self._pipeline = AutoPipelineForInpainting.from_pretrained(
            "diffusers/stable-diffusion-xl-1.0-inpainting-0.1",
            torch_dtype=torch.float16,
            variant="fp16",
        )
        self._pipeline.enable_model_cpu_offload()
        self._is_loaded = True

    def inpaint(
        self,
        image: Image.Image,
        mask: Image.Image,
        prompt: str,
        negative_prompt: str = "",
        strength: float = 0.85,
        guidance_scale: float = 7.5,
        num_inference_steps: int = 30,
        seed: Optional[int] = None,
    ) -> Image.Image:
        """
        인페인팅 실행

        Args:
            image: 원본 이미지 (RGB)
            mask: 마스크 이미지 (흰색=수정영역, 검정=유지영역)
            prompt: 수정할 내용 설명
            strength: 수정 강도 (0.0~1.0)

        Returns:
            수정된 이미지
        """
        generator = None
        if seed is not None:
            generator = torch.Generator().manual_seed(seed)

        result = self._pipeline(
            prompt=prompt,
            negative_prompt=negative_prompt,
            image=image,
            mask_image=mask,
            strength=strength,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps,
            generator=generator,
        )

        return result.images[0]
```

### 7.2 Celery 태스크

```python
# services/ml-worker/app/tasks/inpainting.py

from celery import shared_task
from typing import Optional, Dict, Any
import base64
from io import BytesIO
from PIL import Image

@shared_task(
    name="inpaint_image",
    queue="image_generation",
    max_retries=2,
    soft_time_limit=180,
    time_limit=240,
)
def inpaint_image(
    task_id: str,
    original_image_url: str,
    mask_data: str,
    prompt: str,
    negative_prompt: str = "",
    strength: float = 0.85,
    guidance_scale: float = 7.5,
    num_inference_steps: int = 30,
    seed: Optional[int] = None,
    user_id: str = None,
) -> Dict[str, Any]:
    """인페인팅 Celery 태스크"""

    # 1. 원본 이미지 로드 (MinIO에서)
    original_image = load_image_from_url(original_image_url)

    # 2. 마스크 디코딩
    mask_image = decode_base64_image(mask_data)

    # 3. 파이프라인 로드 및 실행
    pipeline = get_inpaint_pipeline()
    result_image = pipeline.inpaint(
        image=original_image,
        mask=mask_image,
        prompt=prompt,
        negative_prompt=negative_prompt,
        strength=strength,
        guidance_scale=guidance_scale,
        num_inference_steps=num_inference_steps,
        seed=seed,
    )

    # 4. 결과 저장 (MinIO)
    result_url = upload_image_to_minio(result_image, user_id, task_id)

    return {
        "task_id": task_id,
        "status": "completed",
        "result_url": result_url,
    }


def decode_base64_image(data: str) -> Image.Image:
    """Base64 이미지 데이터를 PIL Image로 변환"""
    if data.startswith('data:'):
        data = data.split(',')[1]
    image_data = base64.b64decode(data)
    return Image.open(BytesIO(image_data))
```

---

## 8. 프론트엔드 컴포넌트

### 8.1 MaskCanvas 컴포넌트

```typescript
// services/frontend/components/features/editor/MaskCanvas.tsx

interface MaskCanvasProps {
  imageUrl: string;
  width: number;
  height: number;
  onMaskChange: (maskDataUrl: string) => void;
}

// 주요 기능
// - 브러시로 마스크 영역 그리기
// - 지우개로 마스크 제거
// - 브러시 크기 조절 (10px ~ 100px)
// - 브러시 경도 조절 (soft/hard edge)
// - 전체 선택 / 전체 해제
// - Undo / Redo 지원
// - 줌 인/아웃
// - 마스크 영역 반전
```

### 8.2 브러시 도구 옵션

| 도구 | 설명 |
|------|------|
| 브러시 | 마스크 영역 그리기 (빨간색) |
| 지우개 | 마스크 영역 제거 |
| 사각형 선택 | 사각형 영역 선택 |
| 자유 올가미 | 자유 형태 영역 선택 |
| 마술봉 | 유사 색상 영역 자동 선택 (선택적) |

### 8.3 UI 레이아웃

**Desktop (>1024px):**
```
┌─────────────────────────────────────────────────┐
│  [캔버스 영역 70%]     │  [도구 패널 30%]        │
└─────────────────────────────────────────────────┘
```

**Mobile (<768px):**
```
┌─────────────────────────────────────────────────┐
│                [캔버스 영역 100%]                │
├─────────────────────────────────────────────────┤
│              [도구 패널 (하단 고정)]              │
└─────────────────────────────────────────────────┘
```

---

## 9. 기술 고려사항

### 9.1 모델 선택

| 모델 | VRAM | 특징 |
|------|------|------|
| SD 1.5 Inpainting | ~4GB | 빠름, 품질 보통 |
| SD 2.0 Inpainting | ~5GB | 균형 잡힌 성능 |
| **SDXL Inpainting** | ~8GB | 최고 품질 (권장) |
| Kandinsky Inpainting | ~6GB | 대안 옵션 |

### 9.2 마스크 처리

```python
from PIL import ImageFilter

def preprocess_mask(mask_image: Image.Image) -> Image.Image:
    """
    프론트엔드에서 받은 마스크를 모델 입력용으로 변환
    - 빨간색(255,0,0) → 흰색(255,255,255) = 수정 영역
    - 투명/나머지 → 검정(0,0,0) = 유지 영역
    """
    mask = mask_image.convert('L')
    # 블러 처리로 경계 부드럽게
    mask = mask.filter(ImageFilter.GaussianBlur(radius=2))
    return mask
```

### 9.3 성능 최적화

| 방법 | 효과 |
|------|------|
| CPU Offload | VRAM 절약 |
| Attention Slicing | 메모리 효율 |
| VAE Tiling | 고해상도 지원 |
| 마스크 다운샘플링 | 전송 속도 향상 |

---

## 10. 예상 리소스

| 항목 | 요구사항 |
|------|----------|
| 추가 VRAM | ~8GB (SDXL Inpainting) |
| 추가 디스크 | ~7GB (모델 파일) |
| 생성 시간 | ~10-20초/이미지 |
| 프론트엔드 라이브러리 | fabric.js (~300KB) |

---

## 11. 구현 로드맵

### Phase 1: 기본 기능 (1주)
- [ ] 마스크 캔버스 컴포넌트 (브러시/지우개)
- [ ] 인페인팅 API 엔드포인트
- [ ] SDXL Inpainting 파이프라인
- [ ] 기본 결과 표시

### Phase 2: UX 개선 (1주)
- [ ] 브러시 크기/경도 조절
- [ ] Undo/Redo 기능
- [ ] 결과 비교 뷰 (슬라이더)
- [ ] 로딩 상태 및 진행률

### Phase 3: 고급 기능 (선택)
- [ ] 사각형/올가미 선택 도구
- [ ] 편집 히스토리 저장
- [ ] 다중 마스크 영역
- [ ] SAM 기반 자동 객체 선택

---

## 12. 테스트 계획

### 12.1 단위 테스트
- 마스크 전처리 함수
- Base64 인코딩/디코딩
- API 요청/응답 검증

### 12.2 통합 테스트
- 전체 인페인팅 플로우
- 에러 핸들링
- 대용량 이미지 처리

### 12.3 E2E 테스트
- 사용자 플로우 전체 테스트
- 다양한 디바이스/브라우저 호환성

---

*문서 작성일: 2026-01-04*
*버전: 1.0*
