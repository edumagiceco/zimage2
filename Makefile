.PHONY: help dev dev-build prod down down-v logs ps shell db-migrate db-reset download-model test lint clean gpu-status health

# Colors
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
CYAN   := $(shell tput -Txterm setaf 6)
RESET  := $(shell tput -Txterm sgr0)

# Default target
.DEFAULT_GOAL := help

## Help
help: ## Show this help
	@echo ''
	@echo '${CYAN}Z-Image Platform - Development Commands${RESET}'
	@echo ''
	@echo 'Usage:'
	@echo '  ${YELLOW}make${RESET} ${GREEN}<target>${RESET}'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  ${YELLOW}%-20s${RESET} %s\n", $$1, $$2}' $(MAKEFILE_LIST)

## Development
dev: ## Start development environment
	@echo "${GREEN}Starting development environment...${RESET}"
	docker compose up -d
	@echo ""
	@echo "${GREEN}Development environment started!${RESET}"
	@echo ""
	@echo "${CYAN}Available services (Local):${RESET}"
	@echo "  Frontend:    http://localhost:8090"
	@echo "  Admin:       http://localhost:8091"
	@echo "  API:         http://localhost:8100"
	@echo "  API Docs:    http://localhost:8100/docs"
	@echo ""
	@echo "${CYAN}Available services (External - 192.168.1.81):${RESET}"
	@echo "  Frontend:    http://192.168.1.81:8090"
	@echo "  Admin:       http://192.168.1.81:8091"
	@echo "  API:         http://192.168.1.81:8100"
	@echo ""
	@echo "${CYAN}Monitoring:${RESET}"
	@echo "  Flower:      http://192.168.1.81:5555 (admin/admin123)"
	@echo "  Grafana:     http://192.168.1.81:3002 (admin/admin123)"
	@echo "  Traefik:     http://192.168.1.81:8888"
	@echo "  MinIO:       http://192.168.1.81:9001 (minioadmin/minioadmin123)"
	@echo ""

dev-build: ## Start development with fresh build
	@echo "${GREEN}Building and starting development environment...${RESET}"
	docker compose up -d --build

dev-infra: ## Start only infrastructure services
	@echo "${GREEN}Starting infrastructure services...${RESET}"
	docker compose up -d postgres redis minio minio-init traefik prometheus grafana nvidia-exporter
	@echo "${GREEN}Infrastructure services started!${RESET}"

## Production
prod: ## Start production environment
	docker compose -f docker-compose.prod.yml up -d

prod-build: ## Start production with fresh build
	docker compose -f docker-compose.prod.yml up -d --build

## Stop
down: ## Stop all containers
	@echo "${YELLOW}Stopping all containers...${RESET}"
	docker compose down
	@echo "${GREEN}All containers stopped.${RESET}"

down-v: ## Stop all containers and remove volumes
	@echo "${YELLOW}Stopping all containers and removing volumes...${RESET}"
	docker compose down -v
	@echo "${GREEN}All containers and volumes removed.${RESET}"

## Logs
logs: ## View all logs
	docker compose logs -f

logs-api: ## View API gateway logs
	docker compose logs -f api-gateway

logs-ml: ## View ML worker logs
	docker compose logs -f ml-worker

logs-frontend: ## View frontend logs
	docker compose logs -f frontend

logs-auth: ## View auth service logs
	docker compose logs -f auth-service

logs-image: ## View image service logs
	docker compose logs -f image-service

## Status
ps: ## Show container status
	docker compose ps

## Shell Access
shell-frontend: ## Enter frontend container shell
	docker compose exec frontend sh

shell-api: ## Enter API gateway container shell
	docker compose exec api-gateway bash

shell-auth: ## Enter auth service container shell
	docker compose exec auth-service bash

shell-image: ## Enter image service container shell
	docker compose exec image-service bash

shell-gallery: ## Enter gallery service container shell
	docker compose exec gallery-service bash

shell-ml: ## Enter ML worker container shell
	docker compose exec ml-worker bash

shell-db: ## Enter PostgreSQL shell
	docker compose exec postgres psql -U zimage

shell-redis: ## Enter Redis CLI
	docker compose exec redis redis-cli

## Database
db-migrate: ## Run database migrations for all services
	@echo "${GREEN}Running database migrations...${RESET}"
	docker compose exec auth-service alembic upgrade head
	docker compose exec image-service alembic upgrade head
	docker compose exec gallery-service alembic upgrade head
	@echo "${GREEN}Migrations completed.${RESET}"

db-reset: ## Reset database (WARNING: Deletes all data)
	@echo "${YELLOW}WARNING: This will delete all data!${RESET}"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	docker compose exec postgres psql -U zimage -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	$(MAKE) db-migrate
	@echo "${GREEN}Database reset completed.${RESET}"

db-shell: ## Open database shell
	docker compose exec postgres psql -U zimage

## Model Management
download-model: ## Download Z-Image-Turbo model
	@echo "${GREEN}Downloading Z-Image-Turbo model...${RESET}"
	@echo "${YELLOW}This may take a while (~12GB)...${RESET}"
	docker compose exec ml-worker python -c "\
		from huggingface_hub import snapshot_download; \
		snapshot_download('Tongyi-MAI/Z-Image-Turbo', local_dir='/models/Z-Image-Turbo')"
	@echo "${GREEN}Model downloaded successfully!${RESET}"

model-test: ## Test model loading
	@echo "${GREEN}Testing model loading...${RESET}"
	docker compose exec ml-worker python -c "\
		from app.ml.pipeline import get_pipeline; \
		p = get_pipeline(); \
		print('Model loaded successfully!')"

## Testing
test: ## Run all tests
	@echo "${GREEN}Running tests...${RESET}"
	docker compose exec auth-service pytest -v
	docker compose exec image-service pytest -v
	docker compose exec gallery-service pytest -v

test-auth: ## Run auth service tests
	docker compose exec auth-service pytest -v

test-image: ## Run image service tests
	docker compose exec image-service pytest -v

test-gallery: ## Run gallery service tests
	docker compose exec gallery-service pytest -v

test-cov: ## Run tests with coverage
	docker compose exec auth-service pytest --cov=app --cov-report=html
	docker compose exec image-service pytest --cov=app --cov-report=html
	docker compose exec gallery-service pytest --cov=app --cov-report=html

## Linting
lint: ## Run linters on all services
	@echo "${GREEN}Running linters...${RESET}"
	docker compose exec auth-service ruff check . --fix
	docker compose exec image-service ruff check . --fix
	docker compose exec gallery-service ruff check . --fix
	docker compose exec ml-worker ruff check . --fix

format: ## Format code
	docker compose exec auth-service ruff format .
	docker compose exec image-service ruff format .
	docker compose exec gallery-service ruff format .
	docker compose exec ml-worker ruff format .

## Monitoring
gpu-status: ## Show GPU status
	@echo "${CYAN}GPU Status:${RESET}"
	nvidia-smi

health: ## Check health of all services
	@echo "${CYAN}Checking service health...${RESET}"
	@./scripts/health-check.sh

## Utilities
clean: ## Clean up Docker resources
	@echo "${YELLOW}Cleaning up Docker resources...${RESET}"
	docker system prune -f
	docker volume prune -f
	@echo "${GREEN}Cleanup completed.${RESET}"

clean-all: ## Clean up everything including volumes
	@echo "${YELLOW}WARNING: This will remove all containers, images, and volumes!${RESET}"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	docker compose down -v --rmi all
	docker system prune -af
	@echo "${GREEN}Full cleanup completed.${RESET}"

## Setup
setup: ## Initial setup (copy .env, create directories)
	@echo "${GREEN}Setting up project...${RESET}"
	@[ -f .env ] || cp .env.example .env
	@echo "${GREEN}Setup completed. Please edit .env file with your settings.${RESET}"

init: setup dev-infra db-migrate ## Full initialization
	@echo "${GREEN}Initialization completed!${RESET}"

## Backup
backup: ## Backup database and files
	@echo "${GREEN}Creating backup...${RESET}"
	@./scripts/backup.sh
	@echo "${GREEN}Backup completed.${RESET}"

## Quick commands
restart: down dev ## Restart development environment

rebuild: down dev-build ## Rebuild and restart

fresh: down-v dev-build db-migrate ## Fresh start with new volumes
