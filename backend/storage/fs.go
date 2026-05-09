package storage

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"brainmap-backend/models"
)

var BaseDir = "/app/data/admin" // Default user for now
var mu sync.RWMutex

func Init() {
	os.MkdirAll(BaseDir, os.ModePerm)
}

func GetMapPath(mapID string) string {
	return filepath.Join(BaseDir, mapID, "map.json")
}

func SaveMap(bMap models.BrainMap) error {
	mu.Lock()
	defer mu.Unlock()
	dir := filepath.Join(BaseDir, bMap.ID)
	os.MkdirAll(dir, os.ModePerm)

	data, err := json.MarshalIndent(bMap, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(GetMapPath(bMap.ID), data, 0644)
}

func GetMap(mapID string) (models.BrainMap, error) {
	mu.RLock()
	defer mu.RUnlock()
	var bMap models.BrainMap

	data, err := os.ReadFile(GetMapPath(mapID))
	if err != nil {
		return bMap, err
	}

	err = json.Unmarshal(data, &bMap)
	return bMap, err
}

func DeleteMap(mapID string) error {
	mu.Lock()
	defer mu.Unlock()
	return os.RemoveAll(filepath.Join(BaseDir, mapID))
}

func ListMaps() []models.BrainMap {
	mu.RLock()
	defer mu.RUnlock()
	var maps []models.BrainMap

	entries, err := os.ReadDir(BaseDir)
	if err != nil {
		return maps
	}

	for _, entry := range entries {
		if entry.IsDir() {
			var bMap models.BrainMap
			data, err := os.ReadFile(filepath.Join(BaseDir, entry.Name(), "map.json"))
			if err == nil {
				json.Unmarshal(data, &bMap)
				maps = append(maps, bMap)
			}
		}
	}
	return maps
}
