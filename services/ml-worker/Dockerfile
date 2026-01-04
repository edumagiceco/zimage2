# Z-Image ML Worker - GPU Dockerfile for ARM64

# Use NVIDIA PyTorch image for ARM64 with CUDA support
FROM nvcr.io/nvidia/pytorch:24.08-py3

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install additional system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create models directory
RUN mkdir -p /models

# Expose Flower port (optional, for debugging)
EXPOSE 5555

# Run Celery worker with solo pool for GPU compatibility
CMD ["celery", "-A", "app.celery_app", "worker", "--loglevel=info", "--pool=solo", "-Q", "image_generation"]
