//go:build production

package main

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed all:dist
var distFS embed.FS

// staticHandler returns an HTTP handler that serves the embedded frontend.
// It serves files from dist/ and falls back to index.html for SPA routing.
func staticHandler() http.Handler {
	subFS, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic("failed to load embedded dist: " + err.Error())
	}

	fileServer := http.FileServer(http.FS(subFS))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Don't serve static files for API routes.
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}

		// Try to serve the exact file. If it doesn't exist, serve index.html (SPA fallback).
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		if _, err := fs.Stat(subFS, path); err != nil {
			// File not found — serve index.html for SPA routing.
			r.URL.Path = "/"
		}

		fileServer.ServeHTTP(w, r)
	})
}
