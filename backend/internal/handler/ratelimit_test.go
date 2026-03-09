package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiterAllows(t *testing.T) {
	rl := NewRateLimiter(3, time.Minute)

	for i := 0; i < 3; i++ {
		if !rl.allow("192.168.1.1") {
			t.Errorf("request %d should be allowed", i+1)
		}
	}

	// 4th request should be denied.
	if rl.allow("192.168.1.1") {
		t.Error("4th request should be rate limited")
	}

	// Different IP should still be allowed.
	if !rl.allow("192.168.1.2") {
		t.Error("different IP should be allowed")
	}
}

func TestRateLimiterMiddleware(t *testing.T) {
	rl := NewRateLimiter(2, time.Minute)

	handler := rl.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First 2 requests should pass.
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/generate", nil)
		req.RemoteAddr = "10.0.0.1:12345"
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("request %d: status = %d, want %d", i+1, w.Code, http.StatusOK)
		}
	}

	// 3rd should be blocked.
	req := httptest.NewRequest(http.MethodPost, "/api/generate", nil)
	req.RemoteAddr = "10.0.0.1:12345"
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("3rd request: status = %d, want %d", w.Code, http.StatusTooManyRequests)
	}
}

func TestRateLimiterXForwardedFor(t *testing.T) {
	rl := NewRateLimiter(1, time.Minute)

	handler := rl.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First request from X-Forwarded-For IP.
	req := httptest.NewRequest(http.MethodPost, "/api/generate", nil)
	req.RemoteAddr = "proxy:8080"
	req.Header.Set("X-Forwarded-For", "real-client-ip")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("first: status = %d, want %d", w.Code, http.StatusOK)
	}

	// Second request from same forwarded IP — should be blocked.
	req = httptest.NewRequest(http.MethodPost, "/api/generate", nil)
	req.RemoteAddr = "proxy:8080"
	req.Header.Set("X-Forwarded-For", "real-client-ip")
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("second: status = %d, want %d", w.Code, http.StatusTooManyRequests)
	}
}
