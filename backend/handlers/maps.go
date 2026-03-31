package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"brainmap-backend/database"
	// "brainmap-backend/models"

	"github.com/google/uuid"
)

type CreateMapRequest struct {
	Title        string `json:"title"`
	CoreMaterial string `json:"core_material"`
}

func HandleCreateMap(w http.ResponseWriter, r *http.Request) {
	var req CreateMapRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	tx, err := database.Conn.Begin(ctx)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// 1. Create the Map
	mapID := uuid.New()
	// Using the test user ID we inserted in the DB init script
	testUserID := uuid.MustParse("00000000-0000-0000-0000-000000000000") 
	
	_, err = tx.Exec(ctx, 
		"INSERT INTO brainmaps (id, user_id, title, core_material) VALUES ($1, $2, $3, $4)", 
		mapID, testUserID, req.Title, req.CoreMaterial)

	if err != nil {
		fmt.Printf("DB ERROR (brainmaps): %v\n", err)
		http.Error(w, "Failed to create map", http.StatusInternalServerError)
		return
	}
	

	// db error checking
	coreNodeID := uuid.New()
	_, err = tx.Exec(ctx, 
		"INSERT INTO nodes (id, map_id, type, response_text) VALUES ($1, $2, 'core', $3)", 
		coreNodeID, mapID, "Core Material: " + req.Title)

	if err != nil {
		fmt.Printf("DB ERROR (nodes): %v\n", err)
		http.Error(w, "Failed to create core node", http.StatusInternalServerError)
		return
	}
	tx.Commit(ctx)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"map_id": mapID,
		"core_node_id": coreNodeID,
	})
}

func HandleGetMap(w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(r.URL.Path, "/")
	mapID := pathParts[3]

	ctx := context.Background()

	// 1. Fetch Nodes (Now explicitly grabbing query_text, response_text, and image_data)
	nodeRows, err := database.Conn.Query(ctx, "SELECT id, type, pos_x, pos_y, is_unplaced, COALESCE(query_text, ''), COALESCE(response_text, ''), COALESCE(image_data, '') FROM nodes WHERE map_id = $1", mapID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer nodeRows.Close()

	var nodes []map[string]interface{}
	for nodeRows.Next() {
		var id, nType, qText, rText, imgData string
		var posX, posY float64
		var isUnplaced bool
		nodeRows.Scan(&id, &nType, &posX, &posY, &isUnplaced, &qText, &rText, &imgData)

		nodes = append(nodes, map[string]interface{}{
			"id": id, "type": nType, "pos_x": posX, "pos_y": posY, "is_unplaced": isUnplaced,
			"data": map[string]interface{}{
				"question": qText,
				"answer": rText,
				"media_base64": imgData,
			},
		})
	}

	// 2. Fetch Edges
	edgeRows, _ := database.Conn.Query(ctx, "SELECT id, source_node_id, target_node_id FROM edges WHERE source_node_id IN (SELECT id FROM nodes WHERE map_id = $1)", mapID)
	defer edgeRows.Close()

	var edges []map[string]interface{}
	for edgeRows.Next() {
		var id, source, target string
		edgeRows.Scan(&id, &source, &target)
		edges = append(edges, map[string]interface{}{
			"id": id, "source": source, "target": target,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"nodes": nodes, "edges": edges})
}

func HandleListMaps(w http.ResponseWriter, r *http.Request) {
	rows, err := database.Conn.Query(context.Background(), "SELECT id, title FROM brainmaps ORDER BY created_at DESC")
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()

	var maps []map[string]string
	for rows.Next() {
		var id, title string
		rows.Scan(&id, &title)
		maps = append(maps, map[string]string{"id": id, "title": title})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(maps)
}

func min(a, b int) int {
	if a < b { return a }
	return b
}
