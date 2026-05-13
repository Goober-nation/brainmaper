package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"brainmap-backend/models"
	"brainmap-backend/storage"

	"github.com/google/uuid"
)

type NodeStateRequest struct {
	X           float64     `json:"x"`
	Y           float64     `json:"y"`
	Width       float64     `json:"width"`
	Height      interface{} `json:"height"`
	IsCollapsed bool        `json:"is_collapsed"`
}

func HandleUpdateNodeState(w http.ResponseWriter, r *http.Request) {
	mapID := strings.Split(r.URL.Path, "/")[3]
	nodeID := strings.Split(r.URL.Path, "/")[5]

	var req NodeStateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	bMap, err := storage.GetMap(mapID)
	if err == nil {
		for i, n := range bMap.Nodes {
			if n.ID == nodeID {
				bMap.Nodes[i].PosX = req.X
				bMap.Nodes[i].PosY = req.Y
				bMap.Nodes[i].Width = req.Width
				
				// Handle Height interface{} -> float64 + IsAutoHeight
				if h, ok := req.Height.(float64); ok {
					bMap.Nodes[i].Height = h
					bMap.Nodes[i].IsAutoHeight = false
				} else if h, ok := req.Height.(string); ok && h == "auto" {
					bMap.Nodes[i].IsAutoHeight = true
					bMap.Nodes[i].Height = 0
				}
				
				bMap.Nodes[i].IsCollapsed = req.IsCollapsed
				break
			}
		}
		storage.SaveMap(bMap)
	}
	w.WriteHeader(http.StatusOK)
}

func HandleDeleteNode(w http.ResponseWriter, r *http.Request) {
	mapID := strings.Split(r.URL.Path, "/")[3]
	nodeID := strings.Split(r.URL.Path, "/")[5]

	bMap, err := storage.GetMap(mapID)
	if err == nil {
		// Filter nodes
		var newNodes []models.Node
		for _, n := range bMap.Nodes {
			if n.ID != nodeID {
				newNodes = append(newNodes, n)
			}
		}
		bMap.Nodes = newNodes

		// Filter edges
		var newEdges []models.Edge
		for _, e := range bMap.Edges {
			if e.SourceNodeID != nodeID && e.TargetNodeID != nodeID {
				newEdges = append(newEdges, e)
			}
		}
		bMap.Edges = newEdges

		storage.SaveMap(bMap)
	}
	w.WriteHeader(http.StatusOK)
}

type JoinerRequest struct {
	PosX float64 `json:"pos_x"`
	PosY float64 `json:"pos_y"`
}

func HandleCreateJoiner(w http.ResponseWriter, r *http.Request) {
	mapID := strings.Split(r.URL.Path, "/")[3]
	var req JoinerRequest
	json.NewDecoder(r.Body).Decode(&req)

	newNode := models.Node{
		ID:   uuid.New().String(),
		Type: "joiner",
		PosX: req.PosX, PosY: req.PosY,
		Width: 24, Height: 24,
		CreatedAt: time.Now(),
	}

	bMap, err := storage.GetMap(mapID)
	if err == nil {
		bMap.Nodes = append(bMap.Nodes, newNode)
		storage.SaveMap(bMap)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": newNode.ID})
}
