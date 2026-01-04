-- Migration: Create edit_history table
-- Created: 2026-01-04
-- Description: Add table for tracking image edit history

CREATE TABLE IF NOT EXISTS edit_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- Image references
    original_image_id UUID NOT NULL,
    edited_image_id UUID NOT NULL,
    inpaint_task_id UUID,

    -- Edit parameters
    edit_type VARCHAR(50) NOT NULL DEFAULT 'inpaint',
    prompt TEXT,
    negative_prompt TEXT,
    strength FLOAT,

    -- Mask storage reference
    mask_object_name VARCHAR(500),

    -- Thumbnail URLs for quick preview
    original_thumbnail_url VARCHAR(500),
    edited_thumbnail_url VARCHAR(500),

    -- Metadata (JSONB)
    edit_metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fk_edit_history_inpaint_task
        FOREIGN KEY (inpaint_task_id)
        REFERENCES inpaint_tasks(id)
        ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_edit_history_user_id ON edit_history(user_id);
CREATE INDEX IF NOT EXISTS idx_edit_history_original_image ON edit_history(original_image_id);
CREATE INDEX IF NOT EXISTS idx_edit_history_edited_image ON edit_history(edited_image_id);
CREATE INDEX IF NOT EXISTS idx_edit_history_edit_type ON edit_history(edit_type);
CREATE INDEX IF NOT EXISTS idx_edit_history_created_at ON edit_history(created_at DESC);

-- Comment
COMMENT ON TABLE edit_history IS 'Stores image edit history for tracking changes between versions';
