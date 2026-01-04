-- Migration: Create inpaint_tasks table
-- Created: 2026-01-04
-- Description: Add table for image inpainting tasks

CREATE TABLE IF NOT EXISTS inpaint_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    celery_task_id VARCHAR(255),

    -- Original image reference
    original_image_id UUID NOT NULL,

    -- Task status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error TEXT,

    -- Inpainting parameters
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    strength FLOAT DEFAULT 0.85,
    guidance_scale FLOAT DEFAULT 7.5,
    num_inference_steps INTEGER DEFAULT 30,
    seed INTEGER,

    -- Mask storage path in MinIO
    mask_object_name VARCHAR(500),

    -- Result (JSONB for multiple images)
    result JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Constraints
    CONSTRAINT fk_inpaint_original_image
        FOREIGN KEY (original_image_id)
        REFERENCES images(id)
        ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inpaint_tasks_user_id ON inpaint_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_inpaint_tasks_original_image ON inpaint_tasks(original_image_id);
CREATE INDEX IF NOT EXISTS idx_inpaint_tasks_status ON inpaint_tasks(status);
CREATE INDEX IF NOT EXISTS idx_inpaint_tasks_created_at ON inpaint_tasks(created_at DESC);

-- Comment
COMMENT ON TABLE inpaint_tasks IS 'Stores image inpainting (editing) task information';
