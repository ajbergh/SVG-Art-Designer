package config

import (
	"bufio"
	"os"
	"strings"
)

// Config holds all server configuration.
type Config struct {
	Port          string
	DatabasePath  string
	MasterKeyFile string
	CORSOrigins   []string
	LogLevel      string
	GeminiAPIKey  string // Optional: seed key from env on first run
}

// Load reads configuration from environment variables with sensible defaults.
// It also loads a .env file if present.
func Load() *Config {
	loadEnvFile(".env")

	cfg := &Config{
		Port:          envOrDefault("PORT", "8080"),
		DatabasePath:  envOrDefault("DATABASE_PATH", "./svg_designer.db"),
		MasterKeyFile: envOrDefault("MASTER_KEY_FILE", "./master.key"),
		LogLevel:      envOrDefault("LOG_LEVEL", "info"),
		GeminiAPIKey:  os.Getenv("GEMINI_API_KEY"),
	}

	origins := envOrDefault("CORS_ORIGINS", "http://localhost:3000")
	cfg.CORSOrigins = strings.Split(origins, ",")
	for i := range cfg.CORSOrigins {
		cfg.CORSOrigins[i] = strings.TrimSpace(cfg.CORSOrigins[i])
	}

	return cfg
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// loadEnvFile reads a simple key=value file and sets env vars that aren't already set.
func loadEnvFile(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		// Don't override existing env vars.
		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}
}
