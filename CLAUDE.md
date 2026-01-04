# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Z-Image Platform is an AI-powered marketing image generation platform using the Z-Image-Turbo model. It's built as a microservices architecture using Docker Compose with GPU support for ML inference.

## Common Commands

```bash
# Development
make dev              # Start all services
make dev-build        # Rebuild and start
make dev-infra        # Start infrastructure only (postgres, redis, minio, etc.)
make down             # Stop all services
make down-v           # Stop and remove volumes

# Logs
make logs             # View all logs
make logs-ml          # ML worker logs
make logs-api         # API gateway logs
make logs-frontend    # Frontend logs

# Database
make db-migrate       # Run migrations for all services
make db-reset         # Reset database (WARNING: deletes data)
make shell-db         # PostgreSQL shell

# Model
make download-model   # Download Z-Image-Turbo (~12GB)
make model-test       # Test model loading

# Testing
make test             # Run all tests
make test-auth        # Run auth service tests only
make lint             # Run linters with auto-fix
make format           # Format code

# GPU
make gpu-status       # Check GPU status via nvidia-smi

# Single service tests (inside container)
docker compose exec auth-service pytest -v
docker compose exec image-service pytest -v -k "test_name"
```

## Architecture

```
┌─────────────────┐     ┌───────────────────────────────────────────┐
│  Frontend/Admin │────▶│           API Gateway (8100)              │
│  (Next.js)      │     │  Routes, auth validation, rate limiting   │
└─────────────────┘     └───────────────────────────────────────────┘
                                            │
        ┌───────────────────────────────────┼───────────────────────────────────┐
        ▼                                   ▼                                   ▼
┌───────────────┐                 ┌─────────────────┐                 ┌─────────────────┐
│ Auth Service  │                 │  Image Service  │                 │ Gallery Service │
│    (8001)     │                 │     (8002)      │                 │     (8003)      │
│  JWT, Users   │                 │ Generation API  │                 │ Folders, Tags   │
└───────────────┘                 └────────┬────────┘                 └─────────────────┘
                                           │ Celery
                                           ▼
                                  ┌─────────────────┐
                                  │    ML Worker    │
                                  │  (GPU + Celery) │
                                  │  Z-Image-Turbo  │
                                  └─────────────────┘
                                           │
    ┌──────────────────┬───────────────────┼───────────────────┐
    ▼                  ▼                   ▼                   ▼
┌────────┐      ┌─────────┐         ┌─────────┐         ┌─────────┐
│Postgres│      │  Redis  │         │  MinIO  │         │Prometheus│
│ (5450) │      │ (6390)  │         │ (9020)  │         │ (9090)  │
└────────┘      └─────────┘         └─────────┘         └─────────┘
```

### Service Directory Structure

```
services/
├── frontend/          # Next.js 14 (port 8090)
├── admin-ui/          # Next.js 14 admin dashboard (port 8091)
├── api-gateway/       # FastAPI routing & auth middleware (port 8100)
├── auth-service/      # FastAPI JWT auth (port 8001)
├── image-service/     # FastAPI image generation API (port 8002)
├── gallery-service/   # FastAPI gallery/template management (port 8003)
└── ml-worker/         # Celery worker with Z-Image-Turbo (GPU)
```

## Tech Stack

**Backend Services (Python):**
- FastAPI with async SQLAlchemy (asyncpg)
- Celery for GPU task queue
- Pydantic v2 for validation
- JWT authentication (python-jose)

**Frontend (TypeScript):**
- Next.js 14 with App Router
- TanStack Query for data fetching
- Zustand for state management
- Tailwind CSS + shadcn/ui components

**ML:**
- PyTorch with CUDA
- Diffusers library for Z-Image-Turbo pipeline
- Celery worker with GPU access

**Infrastructure:**
- PostgreSQL 16, Redis 7, MinIO
- Traefik v3 as reverse proxy
- Prometheus + Grafana for monitoring

## Service Ports (Development)

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 8090 | User web interface |
| Admin UI | 8091 | Admin dashboard |
| API Gateway | 8100 | Main API endpoint |
| Auth Service | 8201 | Internal auth API |
| Image Service | 8202 | Internal image API |
| Gallery Service | 8203 | Internal gallery API |
| Flower | 5555 | Celery task monitor |
| PostgreSQL | 5450 | Database |
| Redis | 6390 | Cache/broker |
| MinIO | 9020/9021 | Object storage |
| Grafana | 3002 | Monitoring dashboard |
| Traefik | 8889 | Reverse proxy dashboard |

## Redis Database Allocation

- DB 0: API Gateway cache
- DB 1: Auth service sessions
- DB 2: Image service cache
- DB 3: Celery broker
- DB 4: Celery results
- DB 5: Gallery service cache

## Key Files

- `docker-compose.yml` - Development environment configuration
- `Makefile` - All development commands
- `.env.example` - Environment variable template
- `services/ml-worker/app/ml/pipeline.py` - Z-Image model pipeline
- `services/ml-worker/app/tasks/image_generation.py` - Celery GPU tasks
