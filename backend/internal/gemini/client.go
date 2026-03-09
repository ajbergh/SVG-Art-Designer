package gemini

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

const baseSystemInstruction = `
You are an expert SVG artist and frontend engineer. 
Your goal is to generate clean, high-quality, and scalable SVG code based on user prompts.

RULES:
1. Output ONLY the raw SVG XML code.
2. Do NOT wrap the code in markdown code blocks (e.g., no ` + "```" + `xml ... ` + "```" + `).
3. Do NOT include any conversational text, explanations, or preambles. Just the code.
4. Ensure the SVG has a 'viewBox' attribute for responsiveness.
5. Use inline styles or attributes. Do not use external CSS references.
6. The SVG should be self-contained.
7. If the user requests a refinement, output the FULLY updated SVG code, not just the changes.
8. Default to a canvas size of 512x512 unless specified otherwise.
9. Ensure accessibility (e.g., add a <title> tag inside the SVG).

If the user request is unclear, generate your best interpretation in the requested style.
`

const layerInstruction = `
10. IMPORTANT: Assign meaningful 'id' attributes to top-level groups or key elements (e.g., id="background", id="character-head") to facilitate a layer system. Group related elements using <g> tags.
`

const animationInstruction = `
11. ANIMATION: Generate animated SVG code. Use SMIL animations (<animate>, <animateTransform>) or CSS keyframes within a <style> tag inside the SVG. Make animations smooth, subtle, and looping (repeatCount="indefinite").
`

// Client wraps the Gemini API with session management.
type Client struct {
	mu               sync.Mutex
	apiKey           string
	genaiClient      *genai.Client
	chatSession      *genai.ChatSession
	sessionModel     string
	sessionLayers    *bool
	sessionAnimation *bool
}

// NewClient creates a new Gemini client with the given API key.
func NewClient(apiKey string) *Client {
	return &Client{apiKey: apiKey}
}

// UpdateAPIKey replaces the API key and resets the session.
func (c *Client) UpdateAPIKey(apiKey string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.apiKey = apiKey
	c.closeClient()
}

// ResetSession clears the current chat session.
func (c *Client) ResetSession() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.chatSession = nil
	c.sessionModel = ""
	c.sessionLayers = nil
	c.sessionAnimation = nil
}

// GenerateSVG generates an SVG from a prompt using the Gemini chat session.
func (c *Client) GenerateSVG(ctx context.Context, prompt, style, model string, enableLayers, enableAnimation bool) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.apiKey == "" {
		return "", fmt.Errorf("gemini API key not configured")
	}

	// Create or recreate session if config changed.
	if err := c.ensureSession(ctx, model, enableLayers, enableAnimation); err != nil {
		return "", err
	}

	// Build the full prompt with style context.
	fullPrompt := buildPrompt(prompt, style, enableAnimation)

	resp, err := c.chatSession.SendMessage(ctx, genai.Text(fullPrompt))
	if err != nil {
		return "", fmt.Errorf("gemini generate: %w", err)
	}

	text := extractText(resp)
	return cleanSVGResponse(text), nil
}

// EnhancePrompt uses a lightweight model call to rewrite a prompt.
func (c *Client) EnhancePrompt(ctx context.Context, originalPrompt string) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.apiKey == "" {
		return "", fmt.Errorf("gemini API key not configured")
	}

	client, err := c.getClient(ctx)
	if err != nil {
		return "", err
	}

	enhanceModel := client.GenerativeModel("gemini-2.0-flash")
	enhanceModel.SetTemperature(0.7)

	prompt := fmt.Sprintf(`Rewrite the following art prompt to be more descriptive, artistic, and suitable for a generative vector SVG artist.
Keep it concise but detailed regarding shape, geometry, and color.
Original: "%s"
Output ONLY the enhanced prompt string.`, originalPrompt)

	resp, err := enhanceModel.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return originalPrompt, nil // Graceful fallback
	}

	text := extractText(resp)
	if text == "" {
		return originalPrompt, nil
	}
	return strings.TrimSpace(text), nil
}

func (c *Client) ensureSession(ctx context.Context, model string, enableLayers, enableAnimation bool) error {
	needsNew := c.chatSession == nil ||
		c.sessionModel != model ||
		c.sessionLayers == nil || *c.sessionLayers != enableLayers ||
		c.sessionAnimation == nil || *c.sessionAnimation != enableAnimation

	if !needsNew {
		return nil
	}

	client, err := c.getClient(ctx)
	if err != nil {
		return err
	}

	// Build system instruction.
	sysInstruction := baseSystemInstruction
	if enableLayers {
		sysInstruction += layerInstruction
	}
	if enableAnimation {
		sysInstruction += animationInstruction
	}

	genModel := client.GenerativeModel(model)
	genModel.SetTemperature(0.4)
	genModel.SystemInstruction = &genai.Content{
		Parts: []genai.Part{genai.Text(sysInstruction)},
	}

	c.chatSession = genModel.StartChat()
	c.sessionModel = model
	c.sessionLayers = &enableLayers
	c.sessionAnimation = &enableAnimation
	return nil
}

func (c *Client) getClient(ctx context.Context) (*genai.Client, error) {
	if c.genaiClient != nil {
		return c.genaiClient, nil
	}

	client, err := genai.NewClient(ctx, option.WithAPIKey(c.apiKey))
	if err != nil {
		return nil, fmt.Errorf("create genai client: %w", err)
	}
	c.genaiClient = client
	return client, nil
}

func (c *Client) closeClient() {
	if c.genaiClient != nil {
		c.genaiClient.Close()
		c.genaiClient = nil
	}
	c.chatSession = nil
	c.sessionModel = ""
	c.sessionLayers = nil
	c.sessionAnimation = nil
}

func buildPrompt(prompt, style string, enableAnimation bool) string {
	var fullPrompt string
	if style == "" || style == "None" {
		fullPrompt = "Request: " + prompt
	} else {
		fullPrompt = "Style: " + style + ".\nRequest: " + prompt
	}
	if enableAnimation {
		fullPrompt += "\nRequirement: The SVG must be animated."
	}
	return fullPrompt
}

func extractText(resp *genai.GenerateContentResponse) string {
	if resp == nil || len(resp.Candidates) == 0 {
		return ""
	}
	candidate := resp.Candidates[0]
	if candidate.Content == nil || len(candidate.Content.Parts) == 0 {
		return ""
	}
	var sb strings.Builder
	for _, part := range candidate.Content.Parts {
		if text, ok := part.(genai.Text); ok {
			sb.WriteString(string(text))
		}
	}
	return sb.String()
}

func cleanSVGResponse(text string) string {
	// Remove markdown code block wrappers.
	text = strings.ReplaceAll(text, "```xml", "")
	text = strings.ReplaceAll(text, "```svg", "")
	text = strings.ReplaceAll(text, "```", "")

	// Extract SVG tags.
	svgStart := strings.Index(text, "<svg")
	svgEnd := strings.LastIndex(text, "</svg>")
	if svgStart != -1 && svgEnd != -1 {
		text = text[svgStart : svgEnd+6]
	}

	return strings.TrimSpace(text)
}
