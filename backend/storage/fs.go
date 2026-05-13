package storage

import (
	"context"
	"os"

	"brainmap-backend/database"
	"brainmap-backend/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var BaseDir = "/app/data/admin" // Used for physical media files

func Init() {
	// Ensure the base directory for media files exists
	os.MkdirAll(BaseDir, os.ModePerm)
}

func SaveMap(bMap models.BrainMap) error {
	opts := options.Replace().SetUpsert(true)
	_, err := database.DB.Collection("maps").ReplaceOne(context.TODO(), bson.M{"_id": bMap.ID}, bMap, opts)
	return err
}

func GetMap(mapID string) (models.BrainMap, error) {
	var bMap models.BrainMap
	err := database.DB.Collection("maps").FindOne(context.TODO(), bson.M{"_id": mapID}).Decode(&bMap)
	return bMap, err
}

func DeleteMap(mapID string) error {
	_, err := database.DB.Collection("maps").DeleteOne(context.TODO(), bson.M{"_id": mapID})
	return err
}

func ListMaps() []models.BrainMap {
	var maps []models.BrainMap
	cursor, err := database.DB.Collection("maps").Find(context.TODO(), bson.M{})
	if err != nil {
		return maps
	}
	defer cursor.Close(context.TODO())

	for cursor.Next(context.TODO()) {
		var bMap models.BrainMap
		if err := cursor.Decode(&bMap); err == nil {
			maps = append(maps, bMap)
		}
	}
	return maps
}
