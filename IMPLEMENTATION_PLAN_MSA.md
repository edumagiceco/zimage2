# Z-Image 마케팅 플랫폼 - MSA 기반 세부 구현 계획

## 현재 시스템 사양

| 구성 | 사양 | 비고 |
|------|------|------|
| **CPU** | AMD Ryzen 9 5950X (16코어/32스레드) | 고성능 멀티스레드 |
| **RAM** | 64GB | 충분한 메모리 |
| **GPU** | NVIDIA RTX 3090 (24GB VRAM) | Z-Image 권장 사양 충족 |
| **Storage** | 1.8TB NVMe SSD (1.2TB 가용) | 충분한 저장 공간 |
| **Docker** | v28.4.0 + Compose v2.39.4 | 최신 버전 |
| **OS** | Linux (Ubuntu 계열) | 안정적 서버 환경 |

> **평가**: Z-Image-Turbo 운영에 최적화된 환경. 동시 2~3건 이미지 생성 가능.

---

## 1. MSA 서비스 아키텍처

### 1.1 서비스 구성도

```
                                    ┌─────────────────┐
                                    │   Traefik       │
                                    │   (API Gateway) │
                                    │   :80, :443     │
                                    └────────┬────────┘
                                             │
        ┌────────────────────────────────────┼────────────────────────────────────┐
        │                                    │                                    │
        ▼                                    ▼                                    ▼
┌───────────────┐                 ┌───────────────────┐                 ┌─────────────────┐
│   Frontend    │                 │   API Gateway     │                 │   Admin UI      │
│   Service     │                 │   Service         │                 │   Service       │
│   (Next.js)   │                 │   (FastAPI)       │                 │   (Next.js)     │
│   :3000       │                 │   :8000           │                 │   :3001         │
└───────────────┘                 └─────────┬─────────┘                 └─────────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
                    ▼                       ▼                       ▼
          ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
          │   Auth Service  │    │   Image Service │    │  Gallery Service│
          │   (FastAPI)     │    │   (FastAPI)     │    │   (FastAPI)     │
          │   :8001         │    │   :8002         │    │   :8003         │
          └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
                   │                      │                      │
                   │                      ▼                      │
                   │             ┌─────────────────┐             │
                   │             │  ML Worker      │             │
                   │             │  Service        │             │
                   │             │  (Celery+GPU)   │             │
                   │             │  :5555 (Flower) │             │
                   │             └────────┬────────┘             │
                   │                      │                      │
        ┌──────────┴──────────────────────┴──────────────────────┴──────────┐
        │                                                                    │
        ▼                           ▼                           ▼            ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐ ┌─────────┐
│  PostgreSQL   │          │    Redis      │          │    MinIO      │ │Prometheus│
│  :5432        │          │    :6379      │          │    :9000      │ │  :9090  │
└───────────────┘          └───────────────┘          └───────────────┘ └─────────┘
```

### 1.2 서비스 목록 및 역할

| 서비스 | 포트 | 역할 | 기술 스택 |
|--------|------|------|-----------|
| **traefik** | 80, 443, 8080 | API Gateway, 로드밸런서, SSL | Traefik v3 |
| **frontend** | 3000 | 사용자 웹 인터페이스 | Next.js 14 |
| **admin-ui** | 3001 | 관리자 대시보드 | Next.js 14 |
| **api-gateway** | 8000 | API 라우팅, 인증 검증 | FastAPI |
| **auth-service** | 8001 | 인증/인가 처리 | FastAPI |
| **image-service** | 8002 | 이미지 생성 요청 관리 | FastAPI |
| **gallery-service** | 8003 | 갤러리/템플릿 관리 | FastAPI |
| **ml-worker** | - | GPU 이미지 생성 작업 | Celery + PyTorch |
| **postgres** | 5432 | 메인 데이터베이스 | PostgreSQL 16 |
| **redis** | 6379 | 캐시, 세션, 메시지 브로커 | Redis 7 |
| **minio** | 9000, 9001 | 오브젝트 스토리지 | MinIO |
| **prometheus** | 9090 | 메트릭 수집 | Prometheus |
| **grafana** | 3002 | 모니터링 대시보드 | Grafana |

---

## 2. 프로젝트 디렉토리 구조

```
zimage-platform/
│
├── docker-compose.yml              # 개발 환경
├── docker-compose.prod.yml         # 프로덕션 환경
├── .env.example                    # 환경 변수 템플릿
├── .env                            # 환경 변수 (git 제외)
├── Makefile                        # 빌드/배포 명령어
│
├── traefik/                        # API Gateway
│   ├── traefik.yml                 # 정적 설정
│   ├── dynamic/                    # 동적 설정
│   │   └── middlewares.yml
│   └── certs/                      # SSL 인증서
│
├── services/                       # 마이크로서비스
│   │
│   ├── frontend/                   # 프론트엔드 서비스
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   ├── app/                    # Next.js App Router
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   ├── generate/
│   │   │   │   └── page.tsx
│   │   │   ├── gallery/
│   │   │   │   └── page.tsx
│   │   │   └── templates/
│   │   │       └── page.tsx
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn/ui 컴포넌트
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Footer.tsx
│   │   │   └── features/
│   │   │       ├── ImageGenerator.tsx
│   │   │       ├── PromptInput.tsx
│   │   │       ├── ImageGrid.tsx
│   │   │       └── TemplateCard.tsx
│   │   ├── lib/
│   │   │   ├── api.ts              # API 클라이언트
│   │   │   └── utils.ts
│   │   ├── stores/
│   │   │   ├── authStore.ts
│   │   │   └── imageStore.ts
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── admin-ui/                   # 관리자 UI
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── app/
│   │       ├── dashboard/
│   │       ├── users/
│   │       └── monitoring/
│   │
│   ├── api-gateway/                # API Gateway 서비스
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── middleware/
│   │   │   │   ├── auth.py
│   │   │   │   ├── rate_limit.py
│   │   │   │   └── logging.py
│   │   │   └── routes/
│   │   │       ├── __init__.py
│   │   │       └── proxy.py
│   │   └── tests/
│   │
│   ├── auth-service/               # 인증 서비스
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── alembic/                # DB 마이그레이션
│   │   │   └── versions/
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── models/
│   │   │   │   ├── __init__.py
│   │   │   │   └── user.py
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py
│   │   │   │   └── user.py
│   │   │   ├── api/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py
│   │   │   │   └── users.py
│   │   │   ├── services/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py
│   │   │   │   └── jwt.py
│   │   │   └── db/
│   │   │       ├── __init__.py
│   │   │       └── session.py
│   │   └── tests/
│   │
│   ├── image-service/              # 이미지 생성 서비스
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── alembic/
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── models/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── image.py
│   │   │   │   └── task.py
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── image.py
│   │   │   │   └── task.py
│   │   │   ├── api/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── generate.py
│   │   │   │   └── tasks.py
│   │   │   ├── services/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── image.py
│   │   │   │   └── storage.py
│   │   │   └── tasks/              # Celery 태스크 정의
│   │   │       ├── __init__.py
│   │   │       └── generate.py
│   │   └── tests/
│   │
│   ├── gallery-service/            # 갤러리 서비스
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── alembic/
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── models/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── folder.py
│   │   │   │   ├── tag.py
│   │   │   │   └── template.py
│   │   │   ├── schemas/
│   │   │   ├── api/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── gallery.py
│   │   │   │   ├── folders.py
│   │   │   │   ├── tags.py
│   │   │   │   └── templates.py
│   │   │   └── services/
│   │   └── tests/
│   │
│   └── ml-worker/                  # ML Worker 서비스
│       ├── Dockerfile.gpu          # GPU 지원 Dockerfile
│       ├── requirements.txt
│       ├── app/
│       │   ├── __init__.py
│       │   ├── celery_app.py       # Celery 설정
│       │   ├── config.py
│       │   ├── tasks/
│       │   │   ├── __init__.py
│       │   │   └── image_generation.py
│       │   └── ml/
│       │       ├── __init__.py
│       │       ├── pipeline.py     # Z-Image 파이프라인
│       │       └── utils.py
│       └── models/                 # 모델 가중치 (볼륨 마운트)
│
├── shared/                         # 공유 라이브러리
│   ├── python/
│   │   ├── common/
│   │   │   ├── __init__.py
│   │   │   ├── exceptions.py
│   │   │   ├── responses.py
│   │   │   └── validators.py
│   │   └── setup.py
│   └── types/                      # 공유 타입 정의
│       └── api.ts
│
├── scripts/                        # 유틸리티 스크립트
│   ├── init-db.sh                  # DB 초기화
│   ├── download-model.sh           # 모델 다운로드
│   ├── backup.sh                   # 백업 스크립트
│   └── health-check.sh             # 헬스체크
│
├── monitoring/                     # 모니터링 설정
│   ├── prometheus/
│   │   └── prometheus.yml
│   ├── grafana/
│   │   ├── provisioning/
│   │   │   ├── dashboards/
│   │   │   └── datasources/
│   │   └── dashboards/
│   │       ├── overview.json
│   │       └── gpu-metrics.json
│   └── alertmanager/
│       └── alertmanager.yml
│
└── docs/                           # 문서
    ├── api/                        # API 문서
    ├── deployment/                 # 배포 가이드
    └── development/                # 개발 가이드
```

---

## 3. Docker Compose 설정

### 3.1 개발 환경 (docker-compose.yml)

```yaml
version: '3.8'

name: zimage-platform

services:
  # ============================================
  # Infrastructure Services
  # ============================================

  traefik:
    image: traefik:v3.0
    container_name: zimage-traefik
    command:
      - "--api.dashboard=true"
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--log.level=INFO"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - ./traefik/dynamic:/etc/traefik/dynamic:ro
    networks:
      - zimage-network
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    container_name: zimage-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-zimage}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-zimage_secret}
      POSTGRES_DB: ${POSTGRES_DB:-zimage}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    networks:
      - zimage-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-zimage}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: zimage-redis
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - zimage-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    container_name: zimage-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin123}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    networks:
      - zimage-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    restart: unless-stopped

  # ============================================
  # Application Services
  # ============================================

  frontend:
    build:
      context: ./services/frontend
      dockerfile: Dockerfile
      target: development
    container_name: zimage-frontend
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_API_URL=http://localhost/api
    volumes:
      - ./services/frontend:/app
      - /app/node_modules
      - /app/.next
    ports:
      - "3000:3000"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`localhost`)"
      - "traefik.http.routers.frontend.entrypoints=web"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"
    networks:
      - zimage-network
    depends_on:
      - api-gateway
    restart: unless-stopped

  admin-ui:
    build:
      context: ./services/admin-ui
      dockerfile: Dockerfile
      target: development
    container_name: zimage-admin
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_API_URL=http://localhost/api
    volumes:
      - ./services/admin-ui:/app
      - /app/node_modules
      - /app/.next
    ports:
      - "3001:3000"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.admin.rule=Host(`admin.localhost`)"
      - "traefik.http.routers.admin.entrypoints=web"
      - "traefik.http.services.admin.loadbalancer.server.port=3000"
    networks:
      - zimage-network
    depends_on:
      - api-gateway
    restart: unless-stopped

  api-gateway:
    build:
      context: ./services/api-gateway
      dockerfile: Dockerfile
    container_name: zimage-api-gateway
    environment:
      - ENV=development
      - AUTH_SERVICE_URL=http://auth-service:8001
      - IMAGE_SERVICE_URL=http://image-service:8002
      - GALLERY_SERVICE_URL=http://gallery-service:8003
      - REDIS_URL=redis://redis:6379/0
      - JWT_SECRET=${JWT_SECRET:-your-super-secret-jwt-key}
    volumes:
      - ./services/api-gateway:/app
    ports:
      - "8000:8000"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`localhost`) && PathPrefix(`/api`)"
      - "traefik.http.routers.api.entrypoints=web"
      - "traefik.http.services.api.loadbalancer.server.port=8000"
      - "traefik.http.middlewares.api-strip.stripprefix.prefixes=/api"
      - "traefik.http.routers.api.middlewares=api-strip"
    networks:
      - zimage-network
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  auth-service:
    build:
      context: ./services/auth-service
      dockerfile: Dockerfile
    container_name: zimage-auth-service
    environment:
      - ENV=development
      - DATABASE_URL=postgresql://${POSTGRES_USER:-zimage}:${POSTGRES_PASSWORD:-zimage_secret}@postgres:5432/${POSTGRES_DB:-zimage}
      - REDIS_URL=redis://redis:6379/1
      - JWT_SECRET=${JWT_SECRET:-your-super-secret-jwt-key}
      - JWT_ALGORITHM=HS256
      - ACCESS_TOKEN_EXPIRE_MINUTES=30
      - REFRESH_TOKEN_EXPIRE_DAYS=7
    volumes:
      - ./services/auth-service:/app
    ports:
      - "8001:8001"
    networks:
      - zimage-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  image-service:
    build:
      context: ./services/image-service
      dockerfile: Dockerfile
    container_name: zimage-image-service
    environment:
      - ENV=development
      - DATABASE_URL=postgresql://${POSTGRES_USER:-zimage}:${POSTGRES_PASSWORD:-zimage_secret}@postgres:5432/${POSTGRES_DB:-zimage}
      - REDIS_URL=redis://redis:6379/2
      - CELERY_BROKER_URL=redis://redis:6379/3
      - CELERY_RESULT_BACKEND=redis://redis:6379/4
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ROOT_USER:-minioadmin}
      - MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD:-minioadmin123}
      - MINIO_BUCKET=zimage-images
    volumes:
      - ./services/image-service:/app
    ports:
      - "8002:8002"
    networks:
      - zimage-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    restart: unless-stopped

  gallery-service:
    build:
      context: ./services/gallery-service
      dockerfile: Dockerfile
    container_name: zimage-gallery-service
    environment:
      - ENV=development
      - DATABASE_URL=postgresql://${POSTGRES_USER:-zimage}:${POSTGRES_PASSWORD:-zimage_secret}@postgres:5432/${POSTGRES_DB:-zimage}
      - REDIS_URL=redis://redis:6379/5
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ROOT_USER:-minioadmin}
      - MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD:-minioadmin123}
      - MINIO_BUCKET=zimage-images
    volumes:
      - ./services/gallery-service:/app
    ports:
      - "8003:8003"
    networks:
      - zimage-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  # ============================================
  # ML Worker Service (GPU)
  # ============================================

  ml-worker:
    build:
      context: ./services/ml-worker
      dockerfile: Dockerfile.gpu
    container_name: zimage-ml-worker
    environment:
      - ENV=development
      - CELERY_BROKER_URL=redis://redis:6379/3
      - CELERY_RESULT_BACKEND=redis://redis:6379/4
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ROOT_USER:-minioadmin}
      - MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD:-minioadmin123}
      - MINIO_BUCKET=zimage-images
      - MODEL_PATH=/models
      - CUDA_VISIBLE_DEVICES=0
      - PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
    volumes:
      - ./services/ml-worker:/app
      - ml_models:/models
      - huggingface_cache:/root/.cache/huggingface
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    networks:
      - zimage-network
    depends_on:
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    restart: unless-stopped

  flower:
    image: mher/flower:2.0
    container_name: zimage-flower
    command: celery --broker=redis://redis:6379/3 flower --port=5555
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/3
      - FLOWER_BASIC_AUTH=${FLOWER_USER:-admin}:${FLOWER_PASSWORD:-admin123}
    ports:
      - "5555:5555"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.flower.rule=Host(`flower.localhost`)"
      - "traefik.http.routers.flower.entrypoints=web"
      - "traefik.http.services.flower.loadbalancer.server.port=5555"
    networks:
      - zimage-network
    depends_on:
      - redis
      - ml-worker
    restart: unless-stopped

  # ============================================
  # Monitoring Services
  # ============================================

  prometheus:
    image: prom/prometheus:v2.47.0
    container_name: zimage-prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=15d'
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - zimage-network
    restart: unless-stopped

  grafana:
    image: grafana/grafana:10.1.0
    container_name: zimage-grafana
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_USER:-admin}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin123}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - grafana_data:/var/lib/grafana
    ports:
      - "3002:3000"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.grafana.rule=Host(`grafana.localhost`)"
      - "traefik.http.routers.grafana.entrypoints=web"
      - "traefik.http.services.grafana.loadbalancer.server.port=3000"
    networks:
      - zimage-network
    depends_on:
      - prometheus
    restart: unless-stopped

  # GPU Metrics Exporter
  nvidia-exporter:
    image: utkuozdemir/nvidia_gpu_exporter:1.2.0
    container_name: zimage-nvidia-exporter
    ports:
      - "9835:9835"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    networks:
      - zimage-network
    restart: unless-stopped

# ============================================
# Networks
# ============================================

networks:
  zimage-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16

# ============================================
# Volumes
# ============================================

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  minio_data:
    driver: local
  ml_models:
    driver: local
  huggingface_cache:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local
```

### 3.2 환경 변수 파일 (.env.example)

```bash
# ============================================
# Database
# ============================================
POSTGRES_USER=zimage
POSTGRES_PASSWORD=zimage_secure_password_123
POSTGRES_DB=zimage

# ============================================
# Redis
# ============================================
REDIS_PASSWORD=redis_secure_password_123

# ============================================
# MinIO (Object Storage)
# ============================================
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minio_secure_password_123

# ============================================
# JWT Authentication
# ============================================
JWT_SECRET=your-256-bit-secret-key-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# ============================================
# Flower (Celery Monitoring)
# ============================================
FLOWER_USER=admin
FLOWER_PASSWORD=flower_admin_123

# ============================================
# Grafana
# ============================================
GRAFANA_USER=admin
GRAFANA_PASSWORD=grafana_admin_123

# ============================================
# Application
# ============================================
APP_ENV=development
APP_DEBUG=true
APP_SECRET_KEY=your-app-secret-key

# ============================================
# GPU Settings
# ============================================
CUDA_VISIBLE_DEVICES=0
PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
```

---

## 4. 서비스별 세부 구현

### 4.1 ML Worker 서비스 (핵심)

#### Dockerfile.gpu

```dockerfile
# services/ml-worker/Dockerfile.gpu
FROM nvidia/cuda:12.1-runtime-ubuntu22.04

# 시스템 패키지
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    python3.11-venv \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 가상환경
ENV VIRTUAL_ENV=/opt/venv
RUN python3.11 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu121 && \
    pip install --no-cache-dir -r requirements.txt

# 애플리케이션 복사
COPY . .

# Celery Worker 실행
CMD ["celery", "-A", "app.celery_app", "worker", "--loglevel=info", "--concurrency=1", "-Q", "image_generation"]
```

#### requirements.txt

```
# ML/AI
torch>=2.1.0
torchvision>=0.16.0
diffusers>=0.25.0
transformers>=4.36.0
accelerate>=0.25.0
safetensors>=0.4.0
xformers>=0.0.23

# Celery
celery[redis]>=5.3.0
flower>=2.0.0

# Storage
minio>=7.2.0
Pillow>=10.0.0

# Utils
python-dotenv>=1.0.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
```

#### Z-Image 파이프라인 (app/ml/pipeline.py)

```python
# services/ml-worker/app/ml/pipeline.py
import torch
from diffusers import DiffusionPipeline
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)

class ZImagePipeline:
    """Z-Image-Turbo 파이프라인 래퍼"""

    _instance: Optional['ZImagePipeline'] = None
    _pipeline = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._pipeline is None:
            self._load_model()

    def _load_model(self):
        """모델 로드 (싱글톤)"""
        logger.info("Loading Z-Image-Turbo model...")

        self._pipeline = DiffusionPipeline.from_pretrained(
            "Tongyi-MAI/Z-Image-Turbo",
            torch_dtype=torch.float16,
            use_safetensors=True,
        )

        # GPU로 이동
        self._pipeline = self._pipeline.to("cuda")

        # 메모리 최적화
        self._pipeline.enable_attention_slicing()

        # torch.compile 적용 (PyTorch 2.0+)
        if hasattr(torch, 'compile'):
            self._pipeline.unet = torch.compile(
                self._pipeline.unet,
                mode="reduce-overhead",
                fullgraph=True
            )

        logger.info("Z-Image-Turbo model loaded successfully")

    def generate(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 1024,
        height: int = 1024,
        num_images: int = 1,
        num_inference_steps: int = 8,  # Turbo는 8 NFE
        guidance_scale: float = 3.5,
        seed: Optional[int] = None,
    ) -> List[bytes]:
        """이미지 생성"""

        # 시드 설정
        generator = None
        if seed is not None:
            generator = torch.Generator(device="cuda").manual_seed(seed)

        # 이미지 생성
        with torch.inference_mode():
            result = self._pipeline(
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                num_images_per_prompt=num_images,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                generator=generator,
            )

        # PIL Image를 bytes로 변환
        images_bytes = []
        for img in result.images:
            import io
            buffer = io.BytesIO()
            img.save(buffer, format="PNG", optimize=True)
            images_bytes.append(buffer.getvalue())

        return images_bytes

    def cleanup(self):
        """GPU 메모리 정리"""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


# 전역 인스턴스
def get_pipeline() -> ZImagePipeline:
    return ZImagePipeline()
```

#### Celery 태스크 (app/tasks/image_generation.py)

```python
# services/ml-worker/app/tasks/image_generation.py
from celery import shared_task
from app.ml.pipeline import get_pipeline
from app.config import settings
from minio import Minio
import uuid
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# MinIO 클라이언트
minio_client = Minio(
    settings.MINIO_ENDPOINT,
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=False
)

@shared_task(
    bind=True,
    name="generate_image",
    queue="image_generation",
    max_retries=3,
    soft_time_limit=120,
    time_limit=180
)
def generate_image_task(
    self,
    task_id: str,
    prompt: str,
    negative_prompt: str = "",
    width: int = 1024,
    height: int = 1024,
    num_images: int = 1,
    seed: int = None,
    user_id: str = None,
) -> Dict[str, Any]:
    """이미지 생성 Celery 태스크"""

    try:
        logger.info(f"Starting image generation task: {task_id}")

        # 파이프라인 가져오기
        pipeline = get_pipeline()

        # 이미지 생성
        images_bytes = pipeline.generate(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            num_images=num_images,
            seed=seed,
        )

        # MinIO에 업로드
        image_urls = []
        for idx, img_bytes in enumerate(images_bytes):
            object_name = f"images/{user_id}/{task_id}/{uuid.uuid4()}.png"

            from io import BytesIO
            minio_client.put_object(
                settings.MINIO_BUCKET,
                object_name,
                BytesIO(img_bytes),
                length=len(img_bytes),
                content_type="image/png"
            )

            # URL 생성
            url = f"http://{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET}/{object_name}"
            image_urls.append({
                "url": url,
                "object_name": object_name,
                "width": width,
                "height": height,
                "seed": seed,
            })

        # GPU 메모리 정리
        pipeline.cleanup()

        logger.info(f"Task {task_id} completed. Generated {len(image_urls)} images.")

        return {
            "task_id": task_id,
            "status": "completed",
            "images": image_urls,
        }

    except Exception as e:
        logger.error(f"Task {task_id} failed: {str(e)}")

        # 재시도
        raise self.retry(exc=e, countdown=5)
```

### 4.2 Image Service API

```python
# services/image-service/app/api/generate.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from celery.result import AsyncResult
import uuid

from app.schemas.image import ImageGenerateRequest, ImageGenerateResponse, TaskStatusResponse
from app.models.task import GenerationTask
from app.db.session import get_db
from app.tasks.generate import generate_image_task

router = APIRouter()

@router.post("/generate", response_model=ImageGenerateResponse)
async def generate_image(
    request: ImageGenerateRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """이미지 생성 요청"""

    # 태스크 ID 생성
    task_id = str(uuid.uuid4())

    # DB에 태스크 저장
    db_task = GenerationTask(
        id=task_id,
        user_id=user_id,
        prompt=request.prompt,
        negative_prompt=request.negative_prompt,
        width=request.width,
        height=request.height,
        num_images=request.num_images,
        seed=request.seed,
        status="pending"
    )
    db.add(db_task)
    db.commit()

    # Celery 태스크 전송
    celery_task = generate_image_task.delay(
        task_id=task_id,
        prompt=request.prompt,
        negative_prompt=request.negative_prompt or "",
        width=request.width,
        height=request.height,
        num_images=request.num_images,
        seed=request.seed,
        user_id=user_id,
    )

    return ImageGenerateResponse(
        task_id=task_id,
        celery_task_id=celery_task.id,
        status="pending",
        estimated_time=request.num_images * 2.0  # 예상 시간
    )

@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    db: Session = Depends(get_db),
):
    """태스크 상태 조회"""

    db_task = db.query(GenerationTask).filter(GenerationTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Celery 결과 확인
    if db_task.celery_task_id:
        result = AsyncResult(db_task.celery_task_id)

        if result.ready():
            if result.successful():
                task_result = result.get()
                db_task.status = "completed"
                db_task.result = task_result
                db.commit()
            else:
                db_task.status = "failed"
                db_task.error = str(result.result)
                db.commit()
        elif result.state == "PENDING":
            db_task.status = "pending"
        else:
            db_task.status = "processing"

    return TaskStatusResponse(
        task_id=task_id,
        status=db_task.status,
        images=db_task.result.get("images", []) if db_task.result else [],
        error=db_task.error,
        created_at=db_task.created_at,
    )
```

### 4.3 Frontend 컴포넌트

#### ImageGenerator.tsx

```tsx
// services/frontend/components/features/ImageGenerator.tsx
'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Download, Heart } from 'lucide-react';
import { generateImage, getTaskStatus } from '@/lib/api';
import { ImageGrid } from './ImageGrid';

const SIZE_PRESETS = [
  { label: '1:1 (1024x1024)', value: '1024x1024' },
  { label: '16:9 (1024x576)', value: '1024x576' },
  { label: '9:16 (576x1024)', value: '576x1024' },
  { label: '4:3 (1024x768)', value: '1024x768' },
  { label: 'Instagram (1080x1080)', value: '1080x1080' },
  { label: 'Facebook Cover (820x312)', value: '820x312' },
];

export function ImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [numImages, setNumImages] = useState(2);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<any[]>([]);

  // 이미지 생성 뮤테이션
  const generateMutation = useMutation({
    mutationFn: generateImage,
    onSuccess: (data) => {
      setTaskId(data.task_id);
    },
  });

  // 태스크 상태 폴링
  const { data: taskStatus } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTaskStatus(taskId!),
    enabled: !!taskId,
    refetchInterval: (data) => {
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 1000; // 1초마다 폴링
    },
    onSuccess: (data) => {
      if (data.status === 'completed') {
        setGeneratedImages(data.images);
        setTaskId(null);
      }
    },
  });

  const handleGenerate = () => {
    const [width, height] = size.split('x').map(Number);
    generateMutation.mutate({
      prompt,
      negative_prompt: negativePrompt,
      width,
      height,
      num_images: numImages,
    });
  };

  const isGenerating = generateMutation.isPending ||
    (taskStatus && !['completed', 'failed'].includes(taskStatus.status));

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 프롬프트 입력 */}
      <div className="space-y-4">
        <Textarea
          placeholder="생성하고 싶은 이미지를 설명해주세요... (예: 현대적인 사무실에서 노트북을 사용하는 비즈니스맨, 밝은 조명, 프로페셔널한 분위기)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[120px] text-lg"
          disabled={isGenerating}
        />

        <Textarea
          placeholder="네거티브 프롬프트 (선택사항): blurry, low quality, distorted..."
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          className="min-h-[60px]"
          disabled={isGenerating}
        />
      </div>

      {/* 옵션 */}
      <div className="flex flex-wrap gap-4">
        <Select value={size} onValueChange={setSize} disabled={isGenerating}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="이미지 크기" />
          </SelectTrigger>
          <SelectContent>
            {SIZE_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(numImages)}
          onValueChange={(v) => setNumImages(Number(v))}
          disabled={isGenerating}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="생성 개수" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}장
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 생성 버튼 */}
      <Button
        onClick={handleGenerate}
        disabled={!prompt.trim() || isGenerating}
        className="w-full h-12 text-lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            이미지 생성 중...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            이미지 생성
          </>
        )}
      </Button>

      {/* 진행 상태 */}
      {taskStatus && taskStatus.status === 'processing' && (
        <div className="text-center text-muted-foreground">
          이미지를 생성하고 있습니다... 잠시만 기다려주세요.
        </div>
      )}

      {/* 생성된 이미지 */}
      {generatedImages.length > 0 && (
        <ImageGrid images={generatedImages} />
      )}
    </div>
  );
}
```

---

## 5. 개발 단계별 체크리스트

### Phase 1: 인프라 및 MVP (2주)

#### Week 1: 인프라 구축
- [ ] 프로젝트 디렉토리 구조 생성
- [ ] Docker Compose 기본 설정
- [ ] PostgreSQL, Redis, MinIO 컨테이너 구성
- [ ] Traefik API Gateway 설정
- [ ] 개발 환경 네트워크 구성

#### Week 2: 핵심 서비스 개발
- [ ] Z-Image 모델 다운로드 및 테스트
- [ ] ML Worker 서비스 구현
- [ ] Image Service API 구현
- [ ] 기본 Frontend (이미지 생성 페이지)
- [ ] 전체 흐름 E2E 테스트

### Phase 2: 인증 및 갤러리 (2주)

#### Week 3: 인증 시스템
- [ ] Auth Service 구현
- [ ] JWT 토큰 발급/검증
- [ ] 로그인/회원가입 UI
- [ ] API Gateway 인증 미들웨어

#### Week 4: 갤러리 기능
- [ ] Gallery Service 구현
- [ ] 이미지 메타데이터 저장
- [ ] 갤러리 페이지 UI
- [ ] 폴더/태그 관리 기능

### Phase 3: 고급 기능 (2주)

#### Week 5: 템플릿 및 프롬프트
- [ ] 템플릿 CRUD API
- [ ] 기본 템플릿 10종 제작
- [ ] 템플릿 라이브러리 UI
- [ ] 프롬프트 프리셋 기능

#### Week 6: 관리자 기능
- [ ] Admin UI 구현
- [ ] 사용자 관리
- [ ] 사용량 통계 대시보드
- [ ] 시스템 모니터링 연동

### Phase 4: 최적화 및 배포 (1주)

#### Week 7: 안정화
- [ ] 성능 최적화
- [ ] 보안 점검
- [ ] 프로덕션 Docker Compose
- [ ] 배포 문서 작성
- [ ] 사용자 가이드 작성

---

## 6. Makefile 명령어

```makefile
# Makefile

.PHONY: help dev prod down logs shell db-migrate test lint

help:
	@echo "Available commands:"
	@echo "  make dev          - Start development environment"
	@echo "  make prod         - Start production environment"
	@echo "  make down         - Stop all containers"
	@echo "  make logs         - View logs"
	@echo "  make shell        - Enter shell in a container"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make download-model - Download Z-Image model"
	@echo "  make test         - Run tests"
	@echo "  make lint         - Run linters"

# Development
dev:
	docker compose up -d
	@echo "Development environment started!"
	@echo "Frontend: http://localhost"
	@echo "API: http://localhost/api"
	@echo "Admin: http://admin.localhost"
	@echo "Flower: http://flower.localhost"
	@echo "Grafana: http://grafana.localhost"
	@echo "MinIO: http://localhost:9001"

dev-build:
	docker compose up -d --build

# Production
prod:
	docker compose -f docker-compose.prod.yml up -d

prod-build:
	docker compose -f docker-compose.prod.yml up -d --build

# Stop
down:
	docker compose down

down-volumes:
	docker compose down -v

# Logs
logs:
	docker compose logs -f

logs-service:
	docker compose logs -f $(SERVICE)

# Shell access
shell-frontend:
	docker compose exec frontend sh

shell-api:
	docker compose exec api-gateway bash

shell-ml:
	docker compose exec ml-worker bash

shell-db:
	docker compose exec postgres psql -U zimage

# Database
db-migrate:
	docker compose exec auth-service alembic upgrade head
	docker compose exec image-service alembic upgrade head
	docker compose exec gallery-service alembic upgrade head

db-reset:
	docker compose exec postgres psql -U zimage -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	make db-migrate

# Model
download-model:
	docker compose exec ml-worker python -c "from diffusers import DiffusionPipeline; DiffusionPipeline.from_pretrained('Tongyi-MAI/Z-Image-Turbo')"

# Testing
test:
	docker compose exec auth-service pytest
	docker compose exec image-service pytest
	docker compose exec gallery-service pytest

test-service:
	docker compose exec $(SERVICE) pytest

# Linting
lint:
	docker compose exec auth-service ruff check .
	docker compose exec image-service ruff check .
	docker compose exec gallery-service ruff check .

# Monitoring
gpu-status:
	nvidia-smi

check-health:
	./scripts/health-check.sh

# Backup
backup:
	./scripts/backup.sh

# Clean
clean:
	docker system prune -f
	docker volume prune -f
```

---

## 7. 리소스 할당 계획

현재 시스템 (Ryzen 9 5950X, 64GB RAM, RTX 3090 24GB) 기준:

| 서비스 | CPU | Memory | GPU |
|--------|-----|--------|-----|
| traefik | 0.5 | 256MB | - |
| postgres | 2 | 2GB | - |
| redis | 1 | 2GB | - |
| minio | 1 | 1GB | - |
| frontend | 2 | 1GB | - |
| admin-ui | 1 | 512MB | - |
| api-gateway | 2 | 1GB | - |
| auth-service | 1 | 512MB | - |
| image-service | 2 | 1GB | - |
| gallery-service | 1 | 512MB | - |
| **ml-worker** | 4 | 16GB | **RTX 3090** |
| prometheus | 1 | 512MB | - |
| grafana | 1 | 512MB | - |
| **Total** | ~19 | ~26GB | 1x GPU |

**여유 리소스**: CPU 13코어, RAM 36GB - 향후 확장 가능

---

## 8. 다음 단계

1. **즉시 시작 가능**: `make dev`로 개발 환경 구동
2. **모델 다운로드**: `make download-model`로 Z-Image 모델 설치 (~12GB)
3. **DB 초기화**: `make db-migrate`로 테이블 생성
4. **개발 시작**: 각 서비스별 코드 작성

추가 질문이나 특정 서비스의 더 상세한 구현이 필요하시면 말씀해 주세요!
