# Z-Image Platform

마케팅 부서를 위한 AI 기반 이미지 생성 플랫폼

## Overview

Z-Image Platform은 [Tongyi-MAI/Z-Image](https://github.com/Tongyi-MAI/Z-Image) 모델을 활용한 마케팅 이미지 생성 솔루션입니다.

### Features

- **AI 이미지 생성**: Z-Image-Turbo 모델 기반 1초 이하 고품질 이미지 생성
- **마케팅 최적화**: SNS, 배너, 이커머스 등 용도별 템플릿
- **갤러리 관리**: 생성 이미지 저장, 검색, 폴더/태그 관리
- **팀 협업**: 이미지 공유 및 템플릿 공유

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 8 cores | 16+ cores |
| RAM | 32GB | 64GB |
| GPU | RTX 3080 (10GB) | RTX 3090/4090 (24GB) |
| Storage | 500GB SSD | 1TB NVMe |
| Docker | 24.0+ | Latest |

## Quick Start

### 1. Clone and Setup

```bash
cd /home/magic/work/zimage
cp .env.example .env
# Edit .env with your settings
```

### 2. Start Services

```bash
# Start all services
make dev

# Or start infrastructure only
make dev-infra
```

### 3. Download Model

```bash
make download-model
```

### 4. Access Services

서버 IP: `192.168.1.81` (다른 컴퓨터에서 접속 가능)

| Service | Local URL | External URL |
|---------|-----------|--------------|
| Frontend | http://localhost:8090 | http://192.168.1.81:8090 |
| Admin | http://localhost:8091 | http://192.168.1.81:8091 |
| API | http://localhost:8100 | http://192.168.1.81:8100 |
| API Docs | http://localhost:8100/docs | http://192.168.1.81:8100/docs |
| Flower | http://localhost:5555 | http://192.168.1.81:5555 |
| Grafana | http://localhost:3002 | http://192.168.1.81:3002 |
| MinIO | http://localhost:9021 | http://192.168.1.81:9021 |
| Traefik | http://localhost:8888 | http://192.168.1.81:8888 |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Traefik (API Gateway)                    │
└─────────────────────────────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
   ┌────┴────┐              ┌──────┴──────┐            ┌──────┴──────┐
   │Frontend │              │ API Gateway │            │  Admin UI   │
   │(Next.js)│              │  (FastAPI)  │            │  (Next.js)  │
   └─────────┘              └──────┬──────┘            └─────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
       ┌──────┴──────┐     ┌───────┴───────┐    ┌──────┴──────┐
       │Auth Service │     │ Image Service │    │Gallery Svc  │
       │  (FastAPI)  │     │   (FastAPI)   │    │  (FastAPI)  │
       └─────────────┘     └───────┬───────┘    └─────────────┘
                                   │
                           ┌───────┴───────┐
                           │   ML Worker   │
                           │ (Celery+GPU)  │
                           └───────────────┘
                                   │
     ┌─────────────────────────────┼─────────────────────────────┐
     │                             │                             │
┌────┴────┐                 ┌──────┴──────┐               ┌──────┴──────┐
│PostgreSQL│                │    Redis    │               │    MinIO    │
└──────────┘                └─────────────┘               └─────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| traefik | 80, 443, 8080 | API Gateway / Load Balancer |
| frontend | 3000 | User Web Interface |
| admin-ui | 3001 | Admin Dashboard |
| api-gateway | 8000 | API Routing |
| auth-service | 8001 | Authentication |
| image-service | 8002 | Image Generation |
| gallery-service | 8003 | Gallery Management |
| ml-worker | - | GPU Image Generation |
| postgres | 5432 | Database |
| redis | 6379 | Cache / Message Broker |
| minio | 9000, 9001 | Object Storage |
| prometheus | 9090 | Metrics |
| grafana | 3002 | Monitoring Dashboard |

## Development

### Project Structure

```
zimage-platform/
├── services/
│   ├── frontend/        # Next.js frontend
│   ├── admin-ui/        # Admin dashboard
│   ├── api-gateway/     # FastAPI gateway
│   ├── auth-service/    # Auth service
│   ├── image-service/   # Image generation service
│   ├── gallery-service/ # Gallery service
│   └── ml-worker/       # GPU worker
├── monitoring/          # Prometheus/Grafana configs
├── traefik/            # Traefik configs
├── scripts/            # Utility scripts
├── docker-compose.yml  # Development environment
└── Makefile           # Build commands
```

### Common Commands

```bash
# Development
make dev              # Start development environment
make dev-build        # Rebuild and start
make down             # Stop all services
make logs             # View logs

# Database
make db-migrate       # Run migrations
make db-reset         # Reset database

# Model
make download-model   # Download Z-Image model
make model-test       # Test model loading

# Testing
make test             # Run all tests
make lint             # Run linters

# Monitoring
make gpu-status       # Check GPU status
make health           # Health check all services
```

## Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `POSTGRES_PASSWORD`: Database password
- `JWT_SECRET`: JWT signing secret
- `MINIO_ROOT_PASSWORD`: MinIO admin password

## API Documentation

API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Example: Generate Image

```bash
curl -X POST http://localhost/api/v1/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Modern office with laptop, professional lighting",
    "width": 1024,
    "height": 1024,
    "num_images": 2
  }'
```

## Troubleshooting

### GPU Not Detected

```bash
# Check NVIDIA driver
nvidia-smi

# Check Docker GPU support
docker run --rm --gpus all nvidia/cuda:12.1-base-ubuntu22.04 nvidia-smi
```

### Model Download Issues

```bash
# Manual download
docker compose exec ml-worker python -c "
from huggingface_hub import snapshot_download
snapshot_download('Tongyi-MAI/Z-Image-Turbo', local_dir='/models/Z-Image-Turbo')
"
```

### Service Connection Issues

```bash
# Check service health
make health

# View specific service logs
make logs-ml
make logs-api
```

## License

This project uses Z-Image which is licensed under Apache-2.0.

## References

- [Z-Image GitHub](https://github.com/Tongyi-MAI/Z-Image)
- [Z-Image Hugging Face](https://huggingface.co/Tongyi-MAI/Z-Image-Turbo)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
