package main

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"brainmap-backend/database"
	"brainmap-backend/handlers"
	"brainmap-backend/storage"
)

// responseRecorder intercepts the HTTP response so we can log its body and status
type responseRecorder struct {
	http.ResponseWriter
	statusCode int
	body       []byte
}

func (rec *responseRecorder) WriteHeader(statusCode int) {
	rec.statusCode = statusCode
	rec.ResponseWriter.WriteHeader(statusCode)
}

func (rec *responseRecorder) Write(b []byte) (int, error) {
	// Only capture the first 1000 characters to prevent flooding the terminal with large image/map payloads
	if len(rec.body) < 1000 {
		rec.body = append(rec.body, b...)
	}
	return rec.ResponseWriter.Write(b)
}

// loggingMiddleware now logs both the request and the response payload
func loggingMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rec := &responseRecorder{
			ResponseWriter: w,
			statusCode:     http.StatusOK, // Default to 200
		}

		next.ServeHTTP(rec, r)

		// Clean up the body string for the log (truncate if it hit the cap)
		bodyStr := string(rec.body)
		if len(rec.body) >= 1000 {
			bodyStr += "... [TRUNCATED]"
		}

		log.Printf("[%s] %s | Status: %d | Response: %s", r.Method, r.URL.Path, rec.statusCode, bodyStr)
	}
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, PUT, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	}
}

func main() {
	database.Connect() // Connect to MongoDB with retries
	storage.Init()     // Initialize local file system for map data

	mediaServer := http.StripPrefix("/api/media/", http.FileServer(http.Dir("/app/data/")))

	router := func(w http.ResponseWriter, r *http.Request) {
		// Serve physical files (Do not apply heavy logging to these binary streams)
		if strings.HasPrefix(r.URL.Path, "/api/media/") {
			mediaServer.ServeHTTP(w, r)
			return
		}

		if r.Method == "POST" && r.URL.Path == "/api/maps" {
			handlers.HandleCreateMap(w, r)
			return
		}
		if r.Method == "GET" && r.URL.Path == "/api/maps" {
			handlers.HandleListMaps(w, r)
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
		if r.Method == "POST" && strings.HasSuffix(r.URL.Path, "/joiner") {
			handlers.HandleCreateJoiner(w, r)
			return
		}
		if r.Method == "POST" && strings.Contains(r.URL.Path, "/state") {
			handlers.HandleUpdateNodeState(w, r)
			return
		}
		if r.Method == "DELETE" && strings.Contains(r.URL.Path, "/nodes/") {
			handlers.HandleDeleteNode(w, r)
			return
		}
		if r.Method == "POST" && r.URL.Path == "/api/edges" {
			handlers.HandleCreateEdge(w, r)
			return
		}
		if r.Method == "DELETE" && strings.Contains(r.URL.Path, "/edges/") {
			handlers.HandleDeleteEdge(w, r)
			return
		}
		if r.Method == "DELETE" && strings.HasPrefix(r.URL.Path, "/api/maps/") {
			handlers.HandleDeleteMap(w, r)
			return
		}

		http.NotFound(w, r)
	}

	// Wrap the router with CORS and the new Request/Response Logger
	wrappedRouter := loggingMiddleware(corsMiddleware(router))

	fmt.Println("Starting Backend on port 8080...")
	log.Fatal(http.ListenAndServe(":8080", wrappedRouter))
}
