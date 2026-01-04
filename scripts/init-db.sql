-- Z-Image Platform - Database Initialization Script
-- This script runs on first PostgreSQL container start

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schemas for each service (optional, for isolation)
-- CREATE SCHEMA IF NOT EXISTS auth;
-- CREATE SCHEMA IF NOT EXISTS images;
-- CREATE SCHEMA IF NOT EXISTS gallery;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE zimage TO zimage;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Z-Image database initialized successfully!';
END $$;
