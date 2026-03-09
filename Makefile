.PHONY: build run test clean tidy build-prod

# Build the Go backend binary (dev mode — no embedded frontend)
build:
	cd backend && go build -o ../bin/svg-designer-server ./cmd/server

# Build production binary with embedded frontend
build-prod:
	npm run build
	cp -r dist backend/cmd/server/dist
	cd backend && go build -tags production -o ../bin/svg-designer-server ./cmd/server
	rm -rf backend/cmd/server/dist

# Run the backend in development
run:
	cd backend && go run ./cmd/server

# Run all tests
test:
	cd backend && go test ./...

# Tidy Go modules
tidy:
	cd backend && go mod tidy

# Clean build artifacts and database
clean:
	rm -rf bin/
	rm -f backend/svg_designer.db
	rm -f backend/master.key
