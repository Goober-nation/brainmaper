package handlers

import (
	"context"
	"encoding/json"
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"strings"
	"strconv"

	"brainmap-backend/database"

	"github.com/google/generative-ai-go/genai"
	"github.com/google/uuid"
	"google.golang.org/api/option"
)

type AskRequest struct {
	ParentNodeID *string  `json:"parent_node_id"`
	Question     string   `json:"question"`
	PosX         float64  `json:"pos_x"`
	PosY         float64  `json:"pos_y"`
	IsUnplaced   bool     `json:"is_unplaced"`
	MediaBase64  string   `json:"media_base64"`
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

	modelName := os.Getenv("GEMINI_MODEL")
	if modelName == "" {
		modelName = "gemini-3.1-flash-lite-preview" // Fallback safety
	}

	maxDepth := 3 // Default fallback
	if depthStr := os.Getenv("CONTEXT_DEPTH"); depthStr != "" {
		if d, err := strconv.Atoi(depthStr); err == nil && d > 0 {
			maxDepth = d
		}
	}

	// --- 1. Fetch the Map's core context ---
	var mapTitle, mapMaterial string
	database.Conn.QueryRow(ctx, "SELECT title, core_material FROM brainmaps WHERE id = $1", mapID).Scan(&mapTitle, &mapMaterial)

	fullPrompt := fmt.Sprintf("You are an AI assistant helping a user brainstorm via a mind-map. The current map subject is: '%s'. Context: %s\n\n", mapTitle, mapMaterial)

	// --- 2. Recursive Context Aggregation ---
	if req.ParentNodeID != nil && *req.ParentNodeID != "" {
		// Postgres Recursive CTE to walk UP the tree
		query := `
		WITH RECURSIVE ancestor_path AS (
			-- Base case: the immediate parent node
			SELECT n.id, n.query_text, n.response_text, e.source_node_id as next_parent, 1 as depth
			FROM nodes n
			LEFT JOIN edges e ON n.id = e.target_node_id
			WHERE n.id = $1

			UNION ALL

			-- Recursive step: get the parent's parent
			SELECT n.id, n.query_text, n.response_text, e.source_node_id, ap.depth + 1
			FROM nodes n
			JOIN ancestor_path ap ON n.id = ap.next_parent
			LEFT JOIN edges e ON n.id = e.target_node_id
			WHERE ap.depth < $2
		)
		SELECT COALESCE(query_text, ''), response_text FROM ancestor_path ORDER BY depth DESC;
		`
		
		rows, err := database.Conn.Query(ctx, query, *req.ParentNodeID, maxDepth)
		if err == nil {
			defer rows.Close()
			contextChain := ""
			
			// Because of ORDER BY depth DESC, this builds the string from oldest thought -> newest thought
			for rows.Next() {
				var q, a string
				if err := rows.Scan(&q, &a); err == nil {
					contextChain += fmt.Sprintf("User asked: '%s'\nYou answered: '%s'\n\n", q, a)
				}
			}
			
			if contextChain != "" {
				fullPrompt += "Conversation History leading up to this point:\n" + contextChain
			}
		} else {
			fmt.Printf("Error fetching context tree: %v\n", err)
		}
	}

	fullPrompt += fmt.Sprintf("New User Question: %s\nKeep your answer concise and informative.", req.Question)

	// --- 3. Ask Gemini ---
	client, err := genai.NewClient(ctx, option.WithAPIKey(os.Getenv("GEMINI_API_KEY")))
	if err != nil {
		http.Error(w, "AI Client Error", 500)
		return
	}
	defer client.Close()

	model := client.GenerativeModel(modelName)

	// Create a slice of "Parts" (Multimodal payload)
	parts := []genai.Part{genai.Text(fullPrompt)}

	// Dynamically handle Images OR PDFs
	if req.MediaBase64 != "" {
		b64Parts := strings.SplitN(req.MediaBase64, ",", 2)
		if len(b64Parts) == 2 {
			mimePart := b64Parts[0] // e.g., "data:application/pdf;base64"
			
			// Determine the exact MIME type
			mimeType := "image/jpeg" // default
			if strings.Contains(mimePart, "image/png") { mimeType = "image/png" }
			if strings.Contains(mimePart, "image/webp") { mimeType = "image/webp" }
			if strings.Contains(mimePart, "application/pdf") { mimeType = "application/pdf" }

			fileData, _ := base64.StdEncoding.DecodeString(b64Parts[1])
			
			// genai.Blob allows us to pass raw files dynamically
			parts = append(parts, genai.Blob{
				MIMEType: mimeType,
				Data:     fileData,
			})
		}
	}

	// Pass the multi-part slice to Gemini
	resp, err := model.GenerateContent(ctx, parts...)
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