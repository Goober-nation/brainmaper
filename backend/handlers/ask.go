package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"brainmap-backend/models"
	"brainmap-backend/storage"

	"github.com/google/generative-ai-go/genai"
	"github.com/google/uuid"
	"google.golang.org/api/option"
)

type AskRequest struct {
	ParentNodeID *string `json:"parent_node_id"`
	Question     string  `json:"question"`
	PosX         float64 `json:"pos_x"`
	PosY         float64 `json:"pos_y"`
	MediaBase64  string  `json:"media_base64"`
	MediaName    string  `json:"media_name"`
}

func HandleAsk(w http.ResponseWriter, r *http.Request) {
	mapID := strings.Split(r.URL.Path, "/")[3]

	var req AskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	modelName := os.Getenv("GEMINI_MODEL")
	if modelName == "" {
		modelName = "gemini-3.1-flash-lite-preview"
	}

	maxDepth := 7
	if depthStr := os.Getenv("CONTEXT_DEPTH"); depthStr != "" {
		if d, err := strconv.Atoi(depthStr); err == nil && d > 0 {
			maxDepth = d
		}
	}

	bMap, _ := storage.GetMap(mapID)
	fullPrompt := fmt.Sprintf("You are an AI assistant helping a user brainstorm via a mind-map. The current map subject is: '%s'. Context: %s\n\n", bMap.Title, bMap.CoreMaterial)

	if req.ParentNodeID != nil && *req.ParentNodeID != "" {
		parentMap := make(map[string]string)
		for _, e := range bMap.Edges {
			parentMap[e.TargetNodeID] = e.SourceNodeID
		}

		curr := *req.ParentNodeID
		ancestorIDs := []string{curr}
		for i := 0; i < maxDepth; i++ {
			if p, ok := parentMap[curr]; ok {
				ancestorIDs = append([]string{p}, ancestorIDs...)
				curr = p
			} else {
				break
			}
		}

		nodeLookup := make(map[string]models.Node)
		for _, n := range bMap.Nodes {
			nodeLookup[n.ID] = n
		}

		contextChain := ""
		for _, id := range ancestorIDs {
			if n, exists := nodeLookup[id]; exists {
				if n.QueryText != "" {
					contextChain += fmt.Sprintf("User asked: '%s'\n", n.QueryText)
				}
				contextChain += fmt.Sprintf("You answered: '%s'\n\n", n.ResponseText)
			}
		}
		if contextChain != "" {
			fullPrompt += "Conversation History leading up to this point:\n" + contextChain
		}
	}

	fullPrompt += fmt.Sprintf("New User Question: %s\nKeep your answer concise and informative. Use markdown for code.", req.Question)

	client, err := genai.NewClient(ctx, option.WithAPIKey(os.Getenv("GEMINI_API_KEY")))
	if err != nil {
		http.Error(w, "AI Client Error", 500)
		return
	}
	defer client.Close()

	model := client.GenerativeModel(modelName)
	parts := []genai.Part{genai.Text(fullPrompt)}

	mediaURL := ""
	if req.MediaBase64 != "" {
		b64Parts := strings.SplitN(req.MediaBase64, ",", 2)
		if len(b64Parts) == 2 {
			mimePart := b64Parts[0]
			mimeType := "image/jpeg"
			if strings.Contains(mimePart, "image/png") {
				mimeType = "image/png"
			}
			if strings.Contains(mimePart, "image/webp") {
				mimeType = "image/webp"
			}
			if strings.Contains(mimePart, "application/pdf") {
				mimeType = "application/pdf"
			}

			fileData, _ := base64.StdEncoding.DecodeString(b64Parts[1])
			parts = append(parts, genai.Blob{MIMEType: mimeType, Data: fileData})

			cleanName := strings.ReplaceAll(req.MediaName, " ", "_")
			fileName := fmt.Sprintf("%d_%s", time.Now().Unix(), cleanName)
			filePath := filepath.Join(storage.BaseDir, mapID, fileName)

			os.WriteFile(filePath, fileData, 0644)
			mediaURL = fmt.Sprintf("http://localhost:8080/api/media/admin/%s/%s", mapID, fileName)
		}
	}

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

	newNode := models.Node{
		ID:           uuid.New().String(),
		Type:         "q_and_a",
		QueryText:    req.Question,
		ResponseText: aiAnswer,
		PosX:         req.PosX, PosY: req.PosY,
		Width: 350, Height: 0, IsAutoHeight: true,
		ImageData: mediaURL,
		MediaName: req.MediaName,
		CreatedAt: time.Now(),
	}

	bMap.Nodes = append(bMap.Nodes, newNode)
	if req.ParentNodeID != nil && *req.ParentNodeID != "" {
		edge := models.Edge{
			ID:           uuid.New().String(),
			SourceNodeID: *req.ParentNodeID,
			TargetNodeID: newNode.ID,
		}
		bMap.Edges = append(bMap.Edges, edge)
	}

	storage.SaveMap(bMap)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": newNode.ID})
}
