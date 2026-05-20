package gemini

import (
	"testing"
)

func TestMapModel(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{
			input:    "gemini-3-flash-preview",
			expected: "gemini-1.5-flash",
		},
		{
			input:    "gemini-3.5-flash-preview",
			expected: "gemini-2.0-flash",
		},
		{
			input:    "gemini-3.1-pro-preview",
			expected: "gemini-1.5-pro",
		},
		{
			input:    "gemini-2.0-flash",
			expected: "gemini-2.0-flash",
		},
		{
			input:    "custom-model",
			expected: "custom-model",
		},
		{
			input:    "",
			expected: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			actual := MapModel(tc.input)
			if actual != tc.expected {
				t.Errorf("MapModel(%q) = %q; want %q", tc.input, actual, tc.expected)
			}
		})
	}
}

func TestNewClient(t *testing.T) {
	apiKey := "test-api-key"
	client := NewClient(apiKey)

	if client == nil {
		t.Fatal("NewClient returned nil")
	}

	if client.apiKey != apiKey {
		t.Errorf("NewClient apiKey = %q; want %q", client.apiKey, apiKey)
	}

	if client.sessions == nil {
		t.Error("NewClient sessions map is nil")
	}
}

func TestUpdateAPIKey(t *testing.T) {
	client := NewClient("key1")
	client.UpdateAPIKey("key2")

	if client.apiKey != "key2" {
		t.Errorf("UpdateAPIKey apiKey = %q; want %q", client.apiKey, "key2")
	}
}
