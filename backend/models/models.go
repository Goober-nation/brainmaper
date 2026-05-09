package models

import "time"

// We map ID to "id" instead of "_id" inside the arrays so Mongo's $pull and $set operators can find them easily.
type BrainMap struct {
	ID           string    `json:"id" bson:"_id"`
	UserID       string    `json:"user_id" bson:"user_id"`
	Title        string    `json:"title" bson:"title"`
	CoreMaterial string    `json:"core_material" bson:"core_material"`
	Nodes        []Node    `json:"nodes" bson:"nodes"`
	Edges        []Edge    `json:"edges" bson:"edges"`
	CreatedAt    time.Time `json:"created_at" bson:"created_at"`
}

type Node struct {
	ID           string      `json:"id" bson:"id"`
	Type         string      `json:"type" bson:"type"`
	QueryText    string      `json:"query_text" bson:"query_text"`
	ResponseText string      `json:"response_text" bson:"response_text"`
	PosX         float64     `json:"pos_x" bson:"pos_x"`
	PosY         float64     `json:"pos_y" bson:"pos_y"`
	Width        float64     `json:"width" bson:"width"`
	Height       interface{} `json:"height" bson:"height"` // Using interface{} to allow both float64 and "auto" string
	IsCollapsed  bool        `json:"is_collapsed" bson:"is_collapsed"`
	ImageData    string      `json:"media_base64" bson:"image_data"`
	MediaName    string      `json:"media_name" bson:"media_name"`
	CreatedAt    time.Time   `json:"created_at" bson:"created_at"`
}

type Edge struct {
	ID           string `json:"id" bson:"id"`
	SourceNodeID string `json:"source_node_id" bson:"source_node_id"`
	TargetNodeID string `json:"target_node_id" bson:"target_node_id"`
}
