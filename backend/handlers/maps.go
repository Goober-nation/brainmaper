package handlers

import (
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"time"

	"brainmap-backend/models"
	"brainmap-backend/storage"

	"github.com/google/uuid"
)

type CreateMapRequest struct {
	Title        string `json:"title"`
	CoreMaterial string `json:"core_material"`
}

func HandleCreateMap(w http.ResponseWriter, r *http.Request) {
	var req CreateMapRequest
	json.NewDecoder(r.Body).Decode(&req)

	mapID := uuid.New().String()
	coreNodeID := uuid.New().String()

	coreNode := models.Node{
		ID:           coreNodeID,
		Type:         "core",
		ResponseText: "Core Material: " + req.Title,
		PosX:         250, PosY: 250, Width: 300, Height: 0, IsAutoHeight: true,
		CreatedAt: time.Now(),
	}

	newMap := models.BrainMap{
		ID:           mapID,
		UserID:       "admin",
		Title:        req.Title,
		CoreMaterial: req.CoreMaterial,
		Nodes:        []models.Node{coreNode},
		Edges:        []models.Edge{},
		CreatedAt:    time.Now(),
	}

	storage.SaveMap(newMap)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"map_id": mapID, "core_node_id": coreNodeID})
}

func HandleGetMap(w http.ResponseWriter, r *http.Request) {
	mapID := strings.Split(r.URL.Path, "/")[3]

	bMap, err := storage.GetMap(mapID)
	if err != nil {
		http.Error(w, "Map not found", 404)
		return
	}

	formattedNodes := make([]map[string]interface{}, 0)
	for _, n := range bMap.Nodes {
		formattedNodes = append(formattedNodes, map[string]interface{}{
			"id": n.ID, "type": n.Type, "pos_x": n.PosX, "pos_y": n.PosY,
			"width": n.Width, "height": n.Height, "is_collapsed": n.IsCollapsed,
			"data": map[string]interface{}{
				"question": n.QueryText, "answer": n.ResponseText,
				"media_base64": n.ImageData, "media_name": n.MediaName,
			},
		})
	}

	formattedEdges := make([]map[string]interface{}, 0)
	for _, e := range bMap.Edges {
		formattedEdges = append(formattedEdges, map[string]interface{}{
			"id": e.ID, "source": e.SourceNodeID, "target": e.TargetNodeID,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"nodes": formattedNodes, "edges": formattedEdges})
}

func HandleListMaps(w http.ResponseWriter, r *http.Request) {
	maps := storage.ListMaps()
	sort.Slice(maps, func(i, j int) bool {
		return maps[i].CreatedAt.After(maps[j].CreatedAt)
	})

	formatted := make([]map[string]string, 0)
	for _, m := range maps {
		formatted = append(formatted, map[string]string{"id": m.ID, "title": m.Title})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(formatted)
}

func HandleDeleteMap(w http.ResponseWriter, r *http.Request) {
	mapID := strings.Split(r.URL.Path, "/")[3]
	storage.DeleteMap(mapID)
	w.WriteHeader(http.StatusOK)
}
