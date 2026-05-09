package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var Client *mongo.Client
var DB *mongo.Database

func Connect() {
	uri := fmt.Sprintf("mongodb://%s:%s@%s:%s",
		os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"), os.Getenv("DB_PORT"))

	// CRITICAL FIX: Set a short 3-second timeout so the retry loop acts quickly
	clientOptions := options.Client().ApplyURI(uri).SetServerSelectionTimeout(3 * time.Second)
	var client *mongo.Client
	var err error

	for i := 0; i < 15; i++ {
		client, err = mongo.Connect(context.Background(), clientOptions)
		if err == nil {
			err = client.Ping(context.Background(), nil)
			if err == nil {
				break
			} // Success
		}
		log.Printf("Waiting for MongoDB to initialize... (Attempt %d/15)\n", i+1)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		log.Fatalf("MongoDB failed to start after retries: %v\n", err)
	}

	// Restore normal timeout for general app queries
	clientOptions.SetServerSelectionTimeout(30 * time.Second)
	Client, _ = mongo.Connect(context.Background(), clientOptions)
	DB = Client.Database(os.Getenv("DB_NAME"))
	fmt.Println("Successfully connected to MongoDB!")
}
