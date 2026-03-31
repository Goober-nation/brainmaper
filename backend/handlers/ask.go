package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"brainmap-backend/database"

	"github.com/google/generative-ai-go/genai"
	"github.com/google/uuid"
	"google.golang.org/api/option"
)

type AskRequest struct {
	ParentNodeID *uuid.UUID `json:"parent_node_id"` // Nullable
	Question     string     `json:"question"`
	PosX         float64    `json:"pos_x"`
	PosY         float64    `json:"pos_y"`
	IsUnplaced   bool       `json:"is_unplaced"`
}

func HandleAsk(w http.ResponseWriter, r *http.Request) {
	// Extract Map ID from /api/maps/{map_id}/ask
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}
	mapID := pathParts[3]

	var req AskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	fullPrompt := req.Question

	// 1. If there is a parent, fetch its text to give the AI context
	if req.ParentNodeID != nil {
		var parentText string
		err := database.Conn.QueryRow(ctx, "SELECT response_text FROM nodes WHERE id = $1", req.ParentNodeID).Scan(&parentText)
		if err == nil {
			fullPrompt = fmt.Sprintf("Context: %s\n\nUser Question: %s", parentText, req.Question)
		}
	}

	// 2. Ask Gemini
	client, err := genai.NewClient(ctx, option.WithAPIKey(os.Getenv("GEMINI_API_KEY")))
	if err != nil {
		http.Error(w, "AI Client Error", 500)
		return
	}
	defer client.Close()

	// model_name := os.Getenv("GEMINI_MODEL")
	// model := client.GenerativeModel(model_name)
	model := client.GenerativeModel("gemini-3.1-flash-lite-preview")
	resp, err := model.GenerateContent(ctx, genai.Text(fullPrompt))
	if err != nil || len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil {
		http.Error(w, "AI Generation Failed", 500)
		return
	}

	aiAnswer := ""
	for _, part := range resp.Candidates[0].Content.Parts {
		if txt, ok := part.(genai.Text); ok {
			aiAnswer += string(txt)
		}
	}

	// 3. Database Transaction
	tx, _ := database.Conn.Begin(ctx)
	defer tx.Rollback(ctx)

	newNodeID := uuid.New()
	
	// Insert Node
	_, err = tx.Exec(ctx,
		"INSERT INTO nodes (id, map_id, type, query_text, response_text, pos_x, pos_y, is_unplaced) VALUES ($1, $2, 'q_and_a', $3, $4, $5, $6, $7)",
		newNodeID, mapID, req.Question, aiAnswer, req.PosX, req.PosY, req.IsUnplaced)

	// If it has a parent AND it's placed on the canvas, draw the Edge
	if req.ParentNodeID != nil && !req.IsUnplaced {
		edgeID := uuid.New()
		tx.Exec(ctx, "INSERT INTO edges (id, source_node_id, target_node_id) VALUES ($1, $2, $3)", edgeID, req.ParentNodeID, newNodeID)
	}

	tx.Commit(ctx)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": newNodeID})
}