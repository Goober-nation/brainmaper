package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"brainmap-backend/database"
	"brainmap-backend/handlers"
)

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	}
}

func main() {
	database.Connect()

	router := func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" && r.URL.Path == "/api/maps" {
			handlers.HandleCreateMap(w, r)
			return
		}
		if r.Method == "GET" && strings.HasPrefix(r.URL.Path, "/api/maps/") {
			handlers.HandleGetMap(w, r)
			return
		}
		if r.Method == "POST" && strings.HasSuffix(r.URL.Path, "/ask") {
			handlers.HandleAsk(w, r)
			return
		}
		http.NotFound(w, r)
	}

	port := os.Getenv("APP_PORT")
	fmt.Printf("Starting on port %s...\n", port)
	log.Fatal(http.ListenAndServe(":"+port, corsMiddleware(router)))
}