package model

import (
	"database/sql"
	"fmt"

	"github.com/ajbergh/svg-art-designer/backend/internal/crypto"
)

// APIKey represents an encrypted API key stored in the database.
type APIKey struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Provider  string `json:"provider"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// APIKeyStore handles encrypted API key persistence.
type APIKeyStore struct {
	db        *sql.DB
	masterKey []byte
}

// NewAPIKeyStore creates a new APIKeyStore with the given master key for encryption.
func NewAPIKeyStore(db *sql.DB, masterKey []byte) *APIKeyStore {
	return &APIKeyStore{db: db, masterKey: masterKey}
}

// Store encrypts and saves an API key. If a key with the same name exists, it is updated.
func (s *APIKeyStore) Store(name, provider, plaintextKey string) error {
	ciphertext, nonce, err := crypto.Encrypt([]byte(plaintextKey), s.masterKey)
	if err != nil {
		return fmt.Errorf("encrypt api key: %w", err)
	}

	_, err = s.db.Exec(
		`INSERT INTO api_keys (name, provider, ciphertext, nonce)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT(name) DO UPDATE SET
		   provider = excluded.provider,
		   ciphertext = excluded.ciphertext,
		   nonce = excluded.nonce,
		   updated_at = datetime('now')`,
		name, provider, ciphertext, nonce,
	)
	if err != nil {
		return fmt.Errorf("store api key %q: %w", name, err)
	}
	return nil
}

// Load decrypts and returns the plaintext API key for the given name.
func (s *APIKeyStore) Load(name string) (string, error) {
	var ciphertext, nonce []byte
	err := s.db.QueryRow(
		"SELECT ciphertext, nonce FROM api_keys WHERE name = ?", name,
	).Scan(&ciphertext, &nonce)
	if err != nil {
		return "", fmt.Errorf("load api key %q: %w", name, err)
	}

	plaintext, err := crypto.Decrypt(ciphertext, nonce, s.masterKey)
	if err != nil {
		return "", fmt.Errorf("decrypt api key %q: %w", name, err)
	}
	return string(plaintext), nil
}

// List returns metadata for all stored API keys (no secrets).
func (s *APIKeyStore) List() ([]APIKey, error) {
	rows, err := s.db.Query(
		"SELECT id, name, provider, created_at, updated_at FROM api_keys ORDER BY name",
	)
	if err != nil {
		return nil, fmt.Errorf("list api keys: %w", err)
	}
	defer rows.Close()

	keys := make([]APIKey, 0)
	for rows.Next() {
		var k APIKey
		if err := rows.Scan(&k.ID, &k.Name, &k.Provider, &k.CreatedAt, &k.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan api key: %w", err)
		}
		keys = append(keys, k)
	}
	return keys, nil
}

// Delete removes an API key by name.
func (s *APIKeyStore) Delete(name string) error {
	result, err := s.db.Exec("DELETE FROM api_keys WHERE name = ?", name)
	if err != nil {
		return fmt.Errorf("delete api key %q: %w", name, err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// Exists checks whether an API key with the given name is stored.
func (s *APIKeyStore) Exists(name string) (bool, error) {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM api_keys WHERE name = ?", name).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("check api key %q: %w", name, err)
	}
	return count > 0, nil
}
