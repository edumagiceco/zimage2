#!/bin/bash

# Z-Image Platform - Health Check Script

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Z-Image Platform - Health Check"
echo "=========================================="
echo ""

check_service() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}

    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

    if [ "$response" = "$expected_code" ]; then
        echo -e "  ${GREEN}✓${NC} $name: OK (HTTP $response)"
        return 0
    else
        echo -e "  ${RED}✗${NC} $name: FAILED (HTTP $response)"
        return 1
    fi
}

check_container() {
    local name=$1

    status=$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || echo "not found")

    if [ "$status" = "running" ]; then
        echo -e "  ${GREEN}✓${NC} $name: running"
        return 0
    else
        echo -e "  ${RED}✗${NC} $name: $status"
        return 1
    fi
}

echo "Container Status:"
echo "------------------------------------------"
check_container "zimage-traefik"
check_container "zimage-postgres"
check_container "zimage-redis"
check_container "zimage-minio"
check_container "zimage-frontend"
check_container "zimage-api-gateway"
check_container "zimage-auth-service"
check_container "zimage-image-service"
check_container "zimage-gallery-service"
check_container "zimage-ml-worker"
check_container "zimage-flower"
check_container "zimage-prometheus"
check_container "zimage-grafana"

echo ""
echo "Service Endpoints:"
echo "------------------------------------------"
check_service "Frontend" "http://localhost" 200
check_service "API Gateway" "http://localhost:8000/health" 200
check_service "Auth Service" "http://localhost:8001/health" 200
check_service "Image Service" "http://localhost:8002/health" 200
check_service "Gallery Service" "http://localhost:8003/health" 200
check_service "Traefik Dashboard" "http://localhost:8080/api/overview" 200
check_service "MinIO" "http://localhost:9000/minio/health/live" 200
check_service "Prometheus" "http://localhost:9090/-/healthy" 200
check_service "Grafana" "http://localhost:3002/api/health" 200
check_service "Flower" "http://localhost:5555" 200

echo ""
echo "Database Connections:"
echo "------------------------------------------"

# PostgreSQL
if docker exec zimage-postgres pg_isready -U zimage > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL: accepting connections"
else
    echo -e "  ${RED}✗${NC} PostgreSQL: not ready"
fi

# Redis
if docker exec zimage-redis redis-cli ping > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Redis: PONG"
else
    echo -e "  ${RED}✗${NC} Redis: not responding"
fi

echo ""
echo "GPU Status:"
echo "------------------------------------------"
if command -v nvidia-smi &> /dev/null; then
    gpu_name=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null || echo "Unknown")
    gpu_memory=$(nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader 2>/dev/null || echo "Unknown")
    echo -e "  ${GREEN}✓${NC} GPU: $gpu_name"
    echo -e "  ${GREEN}✓${NC} Memory: $gpu_memory"
else
    echo -e "  ${YELLOW}!${NC} nvidia-smi not available"
fi

echo ""
echo "=========================================="
echo "Health check completed!"
echo "=========================================="
