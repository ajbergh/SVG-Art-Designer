package model

import (
	"crypto/rand"
	"testing"
)

func TestAPIKeyCRUD(t *testing.T) {
	db := testDB(t)
	masterKey := make([]byte, 32)
	rand.Read(masterKey)
	store := NewAPIKeyStore(db.DB, masterKey)

	// Store
	if err := store.Store("gemini", "google", "AIzaSyB_testkey123"); err != nil {
		t.Fatalf("Store: %v", err)
	}

	// Exists
	exists, err := store.Exists("gemini")
	if err != nil {
		t.Fatalf("Exists: %v", err)
	}
	if !exists {
		t.Error("expected key to exist")
	}

	// Load (decrypt)
	plain, err := store.Load("gemini")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if plain != "AIzaSyB_testkey123" {
		t.Errorf("Load = %q, want %q", plain, "AIzaSyB_testkey123")
	}

	// List (no secrets)
	keys, err := store.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(keys) != 1 {
		t.Fatalf("len(keys) = %d, want 1", len(keys))
	}
	if keys[0].Name != "gemini" {
		t.Errorf("Name = %q, want %q", keys[0].Name, "gemini")
	}
	if keys[0].Provider != "google" {
		t.Errorf("Provider = %q, want %q", keys[0].Provider, "google")
	}

	// Upsert (update existing key)
	if err := store.Store("gemini", "google", "AIzaSyB_newkey456"); err != nil {
		t.Fatalf("Store (upsert): %v", err)
	}
	plain, _ = store.Load("gemini")
	if plain != "AIzaSyB_newkey456" {
		t.Errorf("after upsert, Load = %q, want %q", plain, "AIzaSyB_newkey456")
	}

	// Delete
	if err := store.Delete("gemini"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	exists, _ = store.Exists("gemini")
	if exists {
		t.Error("key should not exist after delete")
	}
}

func TestAPIKeyLoadNonExistent(t *testing.T) {
	db := testDB(t)
	masterKey := make([]byte, 32)
	rand.Read(masterKey)
	store := NewAPIKeyStore(db.DB, masterKey)

	_, err := store.Load("nonexistent")
	if err == nil {
		t.Error("expected error loading non-existent key")
	}
}

func TestAPIKeyEncryptedAtRest(t *testing.T) {
	db := testDB(t)
	masterKey := make([]byte, 32)
	rand.Read(masterKey)
	store := NewAPIKeyStore(db.DB, masterKey)

	plaintext := "super_secret_key_12345"
	store.Store("test", "google", plaintext)

	// Directly query the raw ciphertext — it should not equal plaintext.
	var ciphertext []byte
	err := db.QueryRow("SELECT ciphertext FROM api_keys WHERE name = 'test'").Scan(&ciphertext)
	if err != nil {
		t.Fatalf("query raw ciphertext: %v", err)
	}
	if string(ciphertext) == plaintext {
		t.Error("ciphertext equals plaintext — not encrypted at rest")
	}
}
