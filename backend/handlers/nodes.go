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

// PosRequest handles the X and Y coordinates from React Flow
type PosRequest struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// HandleUpdatePosition saves the visual location of a node so it persists on refresh
func HandleUpdatePosition(w http.ResponseWriter, r *http.Request) {
	// URL expected: /api/nodes/{id}/position
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid URL path", http.StatusBadRequest)
		return
	}
	nodeIDStr := pathParts[3]

	// Verify it's a valid UUID before hitting the DB
	_, err := uuid.Parse(nodeIDStr)
	if err != nil {
		http.Error(w, "Invalid Node UUID", http.StatusBadRequest)
		return
	}

	var req PosRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	// Update the database
	_, err = database.Conn.Exec(context.Background(),
		"UPDATE nodes SET pos_x = $1, pos_y = $2 WHERE id = $3",
		req.X, req.Y, nodeIDStr)

	if err != nil {
		fmt.Printf("DATABASE ERROR (Update Position): %v\n", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Success logging is handled by our main.go middleware
	w.WriteHeader(http.StatusOK)
}

// HandleDeleteNode removes a node and its associated edges (cascading)
func HandleDeleteNode(w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid URL path", http.StatusBadRequest)
		return
	}
	nodeID := pathParts[3]

	_, err := database.Conn.Exec(context.Background(), "DELETE FROM nodes WHERE id = $1", nodeID)
	if err != nil {
		fmt.Printf("DATABASE ERROR (Delete Node): %v\n", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}