CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE brainmaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    core_material TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE node_type AS ENUM ('core', 'q_and_a', 'summary');

CREATE TABLE nodes (
    id UUID PRIMARY KEY,
    map_id UUID REFERENCES brainmaps(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    query_text TEXT,
    response_text TEXT,
    pos_x FLOAT DEFAULT 250,        -- ADDED THIS
    pos_y FLOAT DEFAULT 250,        -- ADDED THIS
    is_unplaced BOOLEAN DEFAULT FALSE, -- ADDED THIS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_node_id UUID REFERENCES nodes(id) ON DELETE CASCADE NOT NULL,
    target_node_id UUID REFERENCES nodes(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_node_id, target_node_id) -- Prevent duplicate connections
);

-- Insert a default test user to make the bypassable auth easier later
INSERT INTO users (id, username, password_hash) 
VALUES ('00000000-0000-0000-0000-000000000000', 'test_user', 'no_hash_needed');
