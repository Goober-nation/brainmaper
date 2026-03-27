package database

import (
	"context"
	"fmt"
	"log"
	"os"

	// 1. Notice the updated import path here!
	"github.com/jackc/pgx/v5/pgxpool"
)

// 2. We change this from *pgx.Conn to *pgxpool.Pool
var Conn *pgxpool.Pool

func Connect() {
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"),
	)

	var err error
	// 3. We use pgxpool.New instead of pgx.Connect
	Conn, err = pgxpool.New(context.Background(), dsn)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}

	// Optional: Ping the database to ensure the pool is actually connected
	if err := Conn.Ping(context.Background()); err != nil {
		log.Fatalf("Database ping failed: %v\n", err)
	}

	fmt.Println("Successfully connected to PostgreSQL Connection Pool!")
}