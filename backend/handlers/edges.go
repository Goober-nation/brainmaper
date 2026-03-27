package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"brainmap-backend/database"

	"github.com/google/uuid"
)

type CreateEdgeRequest struct {
	SourceNodeID uuid.UUID `json:"source_node_id"`
	TargetNodeID uuid.UUID `json:"target_node_id"`
}

func HandleCreateEdge(w http.ResponseWriter, r *http.Request) {
	var req CreateEdgeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	edgeID := uuid.New()
	_, err := database.Conn.Exec(context.Background(),
		"INSERT INTO edges (id, source_node_id, target_node_id) VALUES ($1, $2, $3)",
		edgeID, req.SourceNodeID, req.TargetNodeID)

	if err != nil {
		fmt.Printf("DB ERROR (create edge): %v\n", err)
		http.Error(w, "Failed to create edge", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func HandleDeleteEdge(w http.ResponseWriter, r *http.Request) {
	// Extract the Edge ID from /api/edges/{id}
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid URL path", http.StatusBadRequest)
		return
	}
	edgeID := pathParts[3]

	_, err := database.Conn.Exec(context.Background(), "DELETE FROM edges WHERE id = $1", edgeID)
	
	if err != nil {
		fmt.Printf("DB ERROR (delete edge): %v\n", err)
		http.Error(w, "Failed to delete edge", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}