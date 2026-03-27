package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"brainmap-backend/database"
	"brainmap-backend/models"

	"github.com/google/generative-ai-go/genai"
	"github.com/google/uuid"
	"google.golang.org/api/option"
)

type AskRequest struct {
	Question string `json:"question"`
}

func HandleAsk(w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid URL path", http.StatusBadRequest)
		return
	}
	targetNodeIDStr := pathParts[3]
	targetNodeID, _ := uuid.Parse(targetNodeIDStr)

	var req AskRequest
	json.NewDecoder(r.Body).Decode(&req)

	ctx := context.Background()

	query := `
		WITH RECURSIVE branch_path AS (
			SELECT id, map_id, type, query_text, response_text, 1 as depth
			FROM nodes WHERE id = $1
			UNION ALL
			SELECT n.id, n.map_id, n.type, n.query_text, n.response_text, bp.depth + 1
			FROM nodes n
			JOIN edges e ON n.id = e.source_node_id
			JOIN branch_path bp ON e.target_node_id = bp.id
			WHERE bp.depth < 5
		)
		SELECT type, query_text, response_text, map_id FROM branch_path ORDER BY depth DESC;
	`
	
	rows, _ := database.Conn.Query(ctx, query, targetNodeID)
	defer rows.Close()

	var mapID uuid.UUID
	promptBuilder := strings.Builder{}
	for rows.Next() {
		var nodeType string
		var queryText *string
		var responseText string
		rows.Scan(&nodeType, &queryText, &responseText, &mapID)
		if queryText != nil {
			promptBuilder.WriteString(fmt.Sprintf("User: %s\n", *queryText))
		}
		promptBuilder.WriteString(fmt.Sprintf("AI: %s\n\n", responseText))
	}

	var coreMaterial string
	database.Conn.QueryRow(ctx, "SELECT core_material FROM brainmaps WHERE id = $1", mapID).Scan(&coreMaterial)

	fullPrompt := fmt.Sprintf("Core Material: %s\n\nHistory:\n%s\nNew Question: %s", coreMaterial, promptBuilder.String(), req.Question)

	client, err := genai.NewClient(ctx, option.WithAPIKey(os.Getenv("GEMINI_API_KEY")))
	if err != nil {
		fmt.Printf("GEMINI CLIENT ERROR: %v\n", err)
		http.Error(w, "Failed to initialize AI client", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	model := client.GenerativeModel("gemini-2.5-flash")	
	
	// STOP IGNORING THE ERROR HERE
	resp, err := model.GenerateContent(ctx, genai.Text(fullPrompt))
	if err != nil {
		fmt.Printf("GEMINI API ERROR: %v\n", err) // This will tell us exactly what's wrong!
		http.Error(w, "Failed to get response from AI", http.StatusInternalServerError)
		return
	}

	// Make sure the AI actually sent something back before trying to read it
	if len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil {
		fmt.Println("GEMINI API ERROR: AI returned an empty response")
		http.Error(w, "AI returned an empty response", http.StatusInternalServerError)
		return
	}

	aiAnswer := ""
	for _, part := range resp.Candidates[0].Content.Parts {
		if txt, ok := part.(genai.Text); ok {
			aiAnswer += string(txt)
		}
	}

	tx, _ := database.Conn.Begin(ctx)
	defer tx.Rollback(ctx)

	newNodeID := uuid.New()
	tx.Exec(ctx, "INSERT INTO nodes (id, map_id, type, query_text, response_text) VALUES ($1, $2, 'q_and_a', $3, $4)", newNodeID, mapID, req.Question, aiAnswer)
	tx.Exec(ctx, "INSERT INTO edges (id, source_node_id, target_node_id) VALUES ($1, $2, $3)", uuid.New(), targetNodeID, newNodeID)
	tx.Commit(ctx)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.Node{ID: newNodeID, MapID: mapID, Type: "q_and_a", ResponseText: aiAnswer})
}