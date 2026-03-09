package handler

import (
	"net/http"
	"sync"
	"time"
)

// RateLimiter implements a simple per-IP token bucket rate limiter.
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	rate     int           // tokens per interval
	interval time.Duration // refill interval
}

type visitor struct {
	tokens   int
	lastSeen time.Time
}

// NewRateLimiter creates a rate limiter that allows `rate` requests per `interval` per IP.
func NewRateLimiter(rate int, interval time.Duration) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		interval: interval,
	}

	// Cleanup stale entries every minute.
	go func() {
		for {
			time.Sleep(time.Minute)
			rl.mu.Lock()
			for ip, v := range rl.visitors {
				if time.Since(v.lastSeen) > 5*time.Minute {
					delete(rl.visitors, ip)
				}
			}
			rl.mu.Unlock()
		}
	}()

	return rl
}

// allow checks whether the given IP is allowed to make a request.
func (rl *RateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[ip]
	if !exists {
		rl.visitors[ip] = &visitor{tokens: rl.rate - 1, lastSeen: time.Now()}
		return true
	}

	// Refill tokens based on elapsed time.
	elapsed := time.Since(v.lastSeen)
	refill := int(elapsed / rl.interval)
	if refill > 0 {
		v.tokens += refill * rl.rate
		if v.tokens > rl.rate {
			v.tokens = rl.rate
		}
		v.lastSeen = time.Now()
	}

	if v.tokens <= 0 {
		return false
	}

	v.tokens--
	return true
}

// Middleware returns an HTTP middleware that enforces rate limiting.
func (rl *RateLimiter) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
				ip = forwarded
			}

			if !rl.allow(ip) {
				writeError(w, http.StatusTooManyRequests, "rate limit exceeded")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
