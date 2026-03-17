package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ajbergh/svg-art-designer/backend/internal/config"
	"github.com/ajbergh/svg-art-designer/backend/internal/crypto"
	"github.com/ajbergh/svg-art-designer/backend/internal/database"
	"github.com/ajbergh/svg-art-designer/backend/internal/gemini"
	"github.com/ajbergh/svg-art-designer/backend/internal/handler"
	"github.com/ajbergh/svg-art-designer/backend/internal/model"
)

func main() {
	// Load configuration.
	cfg := config.Load()

	// Load or generate master key.
	masterKey, err := crypto.LoadMasterKey(cfg.MasterKeyFile)
	if err != nil {
		log.Fatalf("Failed to load master key: %v", err)
	}

	// Open and migrate database.
	db, err := database.Open(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	if err := db.Migrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize stores.
	designStore := model.NewDesignStore(db.DB)
	apiKeyStore := model.NewAPIKeyStore(db.DB, masterKey)

	// Seed Gemini API key from env if not already stored.
	if cfg.GeminiAPIKey != "" {
		exists, err := apiKeyStore.Exists("gemini")
		if err != nil {
			log.Fatalf("Failed to check API key: %v", err)
		}
		if !exists {
			if err := apiKeyStore.Store("gemini", "google", cfg.GeminiAPIKey); err != nil {
				log.Fatalf("Failed to seed API key: %v", err)
			}
			log.Println("Seeded Gemini API key from environment variable")
		}
	}

	// Initialize Gemini client.
	geminiAPIKey, err := apiKeyStore.Load("gemini")
	if err != nil {
		log.Printf("Warning: No Gemini API key found — generation endpoints will fail until a key is stored via POST /api/keys")
		geminiAPIKey = ""
	}
	geminiClient := gemini.NewClient(geminiAPIKey)

	// Start background cleanup of stale Gemini sessions.
	cleanupCtx, cleanupCancel := context.WithCancel(context.Background())
	defer cleanupCancel()
	geminiClient.StartCleanup(cleanupCtx)

	// Initialize handlers.
	designHandler := handler.NewDesignHandler(designStore)
	apiKeyHandler := handler.NewAPIKeyHandler(apiKeyStore)
	apiKeyHandler.SetOnKeyChanged(func(name, plaintext string) {
		if name == "gemini" {
			geminiClient.UpdateAPIKey(plaintext)
			log.Println("Gemini API key updated via settings")
		}
	})
	geminiHandler := handler.NewGeminiHandler(geminiClient, designStore)

	// Build router (Go 1.22+ pattern matching).
	mux := http.NewServeMux()

	// Rate limiter for AI generation endpoints: 10 requests per minute per IP.
	genLimiter := handler.NewRateLimiter(10, time.Minute)

	// Design endpoints.
	mux.HandleFunc("GET /api/designs", designHandler.List)
	mux.HandleFunc("GET /api/designs/{id}", designHandler.GetByID)
	mux.HandleFunc("POST /api/designs", designHandler.Create)
	mux.HandleFunc("DELETE /api/designs/{id}", designHandler.Delete)
	mux.HandleFunc("DELETE /api/designs", designHandler.DeleteAll)

	// API key endpoints.
	mux.HandleFunc("GET /api/keys", apiKeyHandler.List)
	mux.HandleFunc("POST /api/keys", apiKeyHandler.Store)
	mux.HandleFunc("PUT /api/keys/{name}", apiKeyHandler.Update)
	mux.HandleFunc("DELETE /api/keys/{name}", apiKeyHandler.Delete)

	// Gemini proxy endpoints (rate limited).
	mux.Handle("POST /api/generate", genLimiter.Middleware()(http.HandlerFunc(geminiHandler.Generate)))
	mux.Handle("POST /api/enhance", genLimiter.Middleware()(http.HandlerFunc(geminiHandler.Enhance)))
	mux.HandleFunc("POST /api/session/reset", geminiHandler.ResetSession)

	// Health check.
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Serve embedded frontend in production builds.
	if sh := staticHandler(); sh != nil {
		mux.Handle("/", sh)
	}

	// Apply middleware.
	var h http.Handler = mux
	h = handler.CORS(cfg.CORSOrigins)(h)
	h = handler.Logging()(h)

	// Start server.
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      h,
		ReadTimeout:  120 * time.Second, // Long timeout for Gemini Pro generation
		WriteTimeout: 120 * time.Second, // Long timeout for Gemini generation
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown.
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		log.Println("Shutting down server...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	log.Printf("SVG Art Designer backend starting on :%s", cfg.Port)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}

	log.Println("Server stopped")
}
