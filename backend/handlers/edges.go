package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"brainmap-backend/models"
	"brainmap-backend/storage"

	"github.com/google/uuid"
)

type CreateEdgeRequest struct {
	SourceNodeID string `json:"source_node_id"`
	TargetNodeID string `json:"target_node_id"`
	MapID        string `json:"map_id"`
}

func HandleCreateEdge(w http.ResponseWriter, r *http.Request) {
	var req CreateEdgeRequest
	json.NewDecoder(r.Body).Decode(&req)

	edge := models.Edge{
		ID:           uuid.New().String(),
		SourceNodeID: req.SourceNodeID,
		TargetNodeID: req.TargetNodeID,
	}

	bMap, err := storage.GetMap(req.MapID)
	if err == nil {
		bMap.Edges = append(bMap.Edges, edge)
		storage.SaveMap(bMap)
	}
	w.WriteHeader(http.StatusCreated)
}

func HandleDeleteEdge(w http.ResponseWriter, r *http.Request) {
	mapID := strings.Split(r.URL.Path, "/")[3]
	edgeID := strings.Split(r.URL.Path, "/")[5]

	bMap, err := storage.GetMap(mapID)
	if err == nil {
		var newEdges []models.Edge
		for _, e := range bMap.Edges {
			if e.ID != edgeID {
				newEdges = append(newEdges, e)
			}
		}
		bMap.Edges = newEdges
		storage.SaveMap(bMap)
	}
	w.WriteHeader(http.StatusOK)
}
