package main

import (
	"fmt"
	"log"
	"net/http"
	// "os"
	"strings"

	"brainmap-backend/database"
	"brainmap-backend/handlers"
)

// 1. New Logging Middleware
func loggingMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
		log.Print("good")
	}
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS") // Added DELETE
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
		// Existing Routes
		if r.Method == "POST" && r.URL.Path == "/api/maps" {
			handlers.HandleCreateMap(w, r)
			return
		}
		if r.Method == "POST" && strings.HasSuffix(r.URL.Path, "/position") {
    		handlers.HandleUpdatePosition(w, r)
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
		if r.Method == "POST" && r.URL.Path == "/api/edges" {
			handlers.HandleCreateEdge(w, r)
			return
		}
		if r.Method == "DELETE" && strings.HasPrefix(r.URL.Path, "/api/nodes/") {
			handlers.HandleDeleteNode(w, r)
			return
		}
		if r.Method == "DELETE" && strings.HasPrefix(r.URL.Path, "/api/edges/") {
			handlers.HandleDeleteEdge(w, r)
			return
		}
		if r.Method == "DELETE" && strings.HasPrefix(r.URL.Path, "/api/maps/") {
			pathParts := strings.Split(r.URL.Path, "/")
			if len(pathParts) == 4 { 
				handlers.HandleDeleteMap(w, r)
				return
			}
		}
		if r.Method == "GET" && r.URL.Path == "/api/maps" {
    		handlers.HandleListMaps(w, r)
    		return
		}
		if r.Method == "POST" && strings.HasSuffix(r.URL.Path, "/joiner") {
			handlers.HandleCreateJoiner(w, r)
			return
		}

		http.NotFound(w, r)
	}

	// Wrap the router in BOTH middlewares
	wrappedRouter := loggingMiddleware(corsMiddleware(router))

	// HARDCODE 8080 here instead of relying on an environment variable
	fmt.Println("Starting on port 8080...")
	log.Fatal(http.ListenAndServe(":8080", wrappedRouter))
}