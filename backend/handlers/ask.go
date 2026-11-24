package handlers

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
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
	r.Body = http.MaxBytesReader(w, r.Body, 16<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
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

	bMap, err := storage.GetMap(mapID)
	if err != nil {
		http.Error(w, "Map not found", http.StatusNotFound)
		return
	}
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

	var attachment *attachmentData
	if req.MediaBase64 != "" {
		attachment, err = parseAttachment(req.MediaBase64, req.MediaName)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		parts = append(parts, genai.Blob{MIMEType: attachment.mimeType, Data: attachment.data})
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

	mediaURL := ""
	if attachment != nil {
		mediaURL, err = saveAttachment(mapID, attachment)
		if err != nil {
			http.Error(w, "Cannot save attachment", http.StatusInternalServerError)
			return
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

	if err := storage.SaveMap(bMap); err != nil {
		http.Error(w, "Cannot save map", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": newNode.ID})
}

type attachmentData struct {
	mimeType string
	data     []byte
	name     string
}

func parseAttachment(raw, name string) (*attachmentData, error) {
	parts := strings.SplitN(raw, ",", 2)
	if len(parts) != 2 || !strings.HasPrefix(parts[0], "data:") || !strings.HasSuffix(parts[0], ";base64") {
		return nil, errors.New("Invalid attachment")
	}
	mime := strings.TrimSuffix(strings.TrimPrefix(parts[0], "data:"), ";base64")
	switch mime {
	case "image/jpeg", "image/png", "image/webp", "application/pdf":
	default:
		return nil, errors.New("Unsupported attachment type")
	}
	data, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil || len(data) == 0 {
		return nil, errors.New("Invalid attachment data")
	}
	name = filepath.Base(strings.ReplaceAll(name, "\\", "/"))
	if name == "." || name == "/" || name == "" {
		name = "attachment"
	}
	return &attachmentData{mimeType: mime, data: data, name: name}, nil
}

func saveAttachment(mapID string, a *attachmentData) (string, error) {
	if mapID == "" || filepath.Base(mapID) != mapID {
		return "", errors.New("Invalid map ID")
	}
	dir := filepath.Join(storage.BaseDir, mapID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	name := uuid.New().String() + "_" + a.name
	if err := os.WriteFile(filepath.Join(dir, name), a.data, 0644); err != nil {
		return "", err
	}
	return "/api/media/admin/" + url.PathEscape(mapID) + "/" + url.PathEscape(name), nil
}
