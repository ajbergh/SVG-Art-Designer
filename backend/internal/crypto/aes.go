package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
)

// LoadMasterKey loads the AES-256 master key from environment variable,
// key file, or generates a new one.
func LoadMasterKey(keyFilePath string) ([]byte, error) {
	// 1. Try environment variable.
	if keyHex := os.Getenv("SVG_DESIGNER_MASTER_KEY"); keyHex != "" {
		key, err := hex.DecodeString(strings.TrimSpace(keyHex))
		if err != nil {
			return nil, fmt.Errorf("decode master key from env: %w", err)
		}
		if len(key) != 32 {
			return nil, errors.New("master key must be 32 bytes (64 hex characters)")
		}
		return key, nil
	}

	// 2. Try key file.
	if data, err := os.ReadFile(keyFilePath); err == nil {
		key, err := hex.DecodeString(strings.TrimSpace(string(data)))
		if err != nil {
			return nil, fmt.Errorf("decode master key from file: %w", err)
		}
		if len(key) != 32 {
			return nil, errors.New("master key file must contain 32 bytes (64 hex characters)")
		}
		return key, nil
	}

	// 3. Generate a new key.
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("generate master key: %w", err)
	}
	if err := os.WriteFile(keyFilePath, []byte(hex.EncodeToString(key)+"\n"), 0600); err != nil {
		return nil, fmt.Errorf("write master key file: %w", err)
	}
	log.Printf("Generated new master key at %s — keep this file safe and backed up", keyFilePath)
	return key, nil
}

// Encrypt encrypts plaintext using AES-256-GCM with the given key.
// Returns ciphertext and nonce.
func Encrypt(plaintext, key []byte) (ciphertext, nonce []byte, err error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("create GCM: %w", err)
	}

	nonce = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("generate nonce: %w", err)
	}

	ciphertext = gcm.Seal(nil, nonce, plaintext, nil)
	return ciphertext, nonce, nil
}

// Decrypt decrypts ciphertext using AES-256-GCM with the given key and nonce.
func Decrypt(ciphertext, nonce, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create GCM: %w", err)
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt: %w", err)
	}

	return plaintext, nil
}
