package models

import (
	"time"
	"github.com/google/uuid"
)

// User represents the account owner
type User struct {
	ID           uuid.UUID `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"` // Never send the hash back in JSON
}

// BrainMap is the container for a study session
type BrainMap struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	Title        string    `json:"title"`
	CoreMaterial string    `json:"core_material"`
}

// Node represents a point on the map (Question/Answer or Summary)
type Node struct {
	ID           uuid.UUID `json:"id"`
	MapID        uuid.UUID `json:"map_id"`
	Type         string    `json:"type"` // "core", "q_and_a", "summary"
	QueryText    *string   `json:"query_text"`
	ResponseText string    `json:"response_text"`
	IsCollapsed  bool      `json:"is_collapsed"`
	CreatedAt    time.Time `json:"created_at"`
}

// Edge represents the connection between nodes
type Edge struct {
	ID           uuid.UUID `json:"id"`
	SourceNodeID uuid.UUID `json:"source_node_id"`
	TargetNodeID uuid.UUID `json:"target_node_id"`
}
