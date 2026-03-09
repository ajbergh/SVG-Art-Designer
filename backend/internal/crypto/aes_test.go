package crypto

import (
	"bytes"
	"crypto/rand"
	"os"
	"path/filepath"
	"testing"
)

func TestEncryptDecrypt(t *testing.T) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}

	plaintext := []byte("AIzaSyBexamplekey12345678")

	ciphertext, nonce, err := Encrypt(plaintext, key)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	if bytes.Equal(ciphertext, plaintext) {
		t.Error("ciphertext should not equal plaintext")
	}

	decrypted, err := Decrypt(ciphertext, nonce, key)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if !bytes.Equal(decrypted, plaintext) {
		t.Errorf("decrypted = %q, want %q", decrypted, plaintext)
	}
}

func TestDecryptWrongKey(t *testing.T) {
	key1 := make([]byte, 32)
	key2 := make([]byte, 32)
	rand.Read(key1)
	rand.Read(key2)

	plaintext := []byte("secret data")
	ciphertext, nonce, err := Encrypt(plaintext, key1)
	if err != nil {
		t.Fatal(err)
	}

	_, err = Decrypt(ciphertext, nonce, key2)
	if err == nil {
		t.Error("expected error decrypting with wrong key")
	}
}

func TestDecryptBadNonce(t *testing.T) {
	key := make([]byte, 32)
	rand.Read(key)

	plaintext := []byte("secret data")
	ciphertext, _, err := Encrypt(plaintext, key)
	if err != nil {
		t.Fatal(err)
	}

	badNonce := make([]byte, 12)
	rand.Read(badNonce)

	_, err = Decrypt(ciphertext, badNonce, key)
	if err == nil {
		t.Error("expected error decrypting with wrong nonce")
	}
}

func TestLoadMasterKey_EnvVar(t *testing.T) {
	// Generate a known key.
	expected := make([]byte, 32)
	rand.Read(expected)
	hexKey := make([]byte, 64)
	for i, b := range expected {
		const hextable = "0123456789abcdef"
		hexKey[i*2] = hextable[b>>4]
		hexKey[i*2+1] = hextable[b&0x0f]
	}

	t.Setenv("SVG_DESIGNER_MASTER_KEY", string(hexKey))

	key, err := LoadMasterKey(filepath.Join(t.TempDir(), "test.key"))
	if err != nil {
		t.Fatalf("LoadMasterKey failed: %v", err)
	}

	if !bytes.Equal(key, expected) {
		t.Error("loaded key does not match expected")
	}
}

func TestLoadMasterKey_GeneratesFile(t *testing.T) {
	t.Setenv("SVG_DESIGNER_MASTER_KEY", "")

	keyFile := filepath.Join(t.TempDir(), "generated.key")

	key, err := LoadMasterKey(keyFile)
	if err != nil {
		t.Fatalf("LoadMasterKey failed: %v", err)
	}

	if len(key) != 32 {
		t.Errorf("key length = %d, want 32", len(key))
	}

	// File should exist.
	if _, err := os.Stat(keyFile); os.IsNotExist(err) {
		t.Error("key file was not created")
	}

	// Loading again should return the same key.
	key2, err := LoadMasterKey(keyFile)
	if err != nil {
		t.Fatalf("second LoadMasterKey failed: %v", err)
	}
	if !bytes.Equal(key, key2) {
		t.Error("second load returned different key")
	}
}
