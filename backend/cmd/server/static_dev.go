//go:build !production

package main

import "net/http"

// staticHandler returns nil in development mode — no embedded frontend.
// Use Vite's dev server with proxy to :8080 instead.
func staticHandler() http.Handler {
	return nil
}
