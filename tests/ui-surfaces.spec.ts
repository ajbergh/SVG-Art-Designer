import { test, expect } from '@playwright/test';

test.describe('SVG Art Designer - UI Surfaces & Premium Features', () => {
  
  test.beforeEach(async ({ page }) => {
    // Intercept standard load and design fetching requests to prevent backend hanging
    await page.route('**/api/designs**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ designs: [], total: 0 }),
      });
    });

    await page.route('**/api/keys', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Go to our main client address
    await page.goto('/');
  });

  test('should render the main landing page layout correctly', async ({ page }) => {
    // 1. Verify Header contains core texts
    const headerTitle = page.locator('header h1');
    await expect(headerTitle).toContainText('SVG Art Designer');

    // 2. Verify Prompt Textarea is visible and ready
    const promptInput = page.locator('textarea[placeholder*="Describe what you want"]').first();
    await expect(promptInput).toBeVisible();

    // Fill the prompt first so the AI actions become visible
    await promptInput.fill('Star');

    // 3. Verify standard buttons are loaded after typing prompt
    const enhanceBtn = page.locator('button[title="Enhance prompt with AI"]').first();
    await expect(enhanceBtn).toBeVisible();

    const generateBtn = page.locator('button[title="Generate SVG Design"]').first();
    await expect(generateBtn).toBeVisible();

    // 4. Verify style cards render (e.g. Flat, Cartoon, Line Art...)
    const styleCards = page.locator('.style-card');
    await expect(styleCards.locator('text=Flat').first()).toBeVisible();
  });

  test('should support selecting styling cards', async ({ page }) => {
    // Select standard style option card (e.g. Flat)
    const flatCard = page.locator('.style-card:has-text("Flat")').first();
    await expect(flatCard).toBeVisible();

    // Click the card
    await flatCard.click();

    // Verify it acquires the selected style layout class
    await expect(flatCard).toHaveClass(/style-card-selected/);
  });

  test('should render color swatches and blueprint coordinates grid after generating an SVG', async ({ page }) => {
    // 1. Intercept generation endpoint to return a mock SVG
    await page.route('**/api/generate', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-drawing-id',
          prompt: 'Golden Star',
          style: 'flat',
          svg: `<svg viewBox="0 0 500 500" width="500" height="500">
            <rect x="0" y="0" width="500" height="500" fill="#111827" />
            <polygon points="250,50 320,190 470,210 360,320 390,470 250,400 110,470 140,320 30,210 180,190" fill="#3b82f6" stroke="#ef4444" stroke-width="5" />
            <circle cx="250" cy="250" r="40" fill="yellow" />
          </svg>`,
          timestamp: Date.now()
        }),
      });
    });

    // Write prompt and click generate
    const promptInput = page.locator('textarea[placeholder*="Describe what you want"]').first();
    await promptInput.fill('Golden Star');
    
    const generateBtn = page.locator('button[title="Generate SVG Design"]').first();
    await generateBtn.click();

    // 2. Test Color Palette Swatches Drawer - wait for it to become visible
    const paletteHeader = page.locator('text=Art Palette');
    await expect(paletteHeader).toBeVisible({ timeout: 15000 });

    // It should parse #111827, #3b82f6, #ef4444, and yellow. Let's assert at least some swatches appear
    const swatches = page.locator('#color-palette-drawer button[title*="Copy"]');
    await expect(swatches).toHaveCount(4); // #111827, #3b82f6, #ef4444, yellow

    // Hover on a swatch to verify tooltip appears
    const blueSwatch = page.locator('#color-palette-drawer button[title="Copy #3b82f6"]');
    await expect(blueSwatch).toBeVisible();
    await blueSwatch.hover();
    await expect(page.locator('div', { hasText: /^#3b82f6$/ }).first()).toBeVisible();

    // Click the swatch to copy and confirm tooltip updates to "Copied!"
    await blueSwatch.click();
    await expect(page.locator('text=Copied!').first()).toBeVisible();

    // 3. Test Blueprint Grid Toggle
    const rulerBtn = page.locator('button[title="Toggle Blueprint Grid & Ruler"]');
    await expect(rulerBtn).toBeVisible();

    // Blueprint background shouldn't be active yet
    const canvasContainer = page.locator('#canvas-viewport');
    await expect(canvasContainer).not.toHaveClass(/bg-\[#06152d\]/);

    // Toggle grid on
    await rulerBtn.click();

    // Verify background changes to Blueprint Blue
    await expect(canvasContainer).toHaveClass(/bg-\[#06152d\]/);

    // Verify coordinates ticks (g elements with X coordinate labels, like 100, 200, 300...)
    const xLabel = page.locator('text=100').first();
    await expect(xLabel).toBeVisible();

    const yLabel = page.locator('text=300').first();
    await expect(yLabel).toBeVisible();

    // Toggle grid off
    await rulerBtn.click();
    await expect(canvasContainer).not.toHaveClass(/bg-\[#06152d\]/);
  });

  test('should support toggling to Svg Code view mode', async ({ page }) => {
    // 1. Mock designs to load initial template or generate
    await page.route('**/api/generate', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'code-view-test',
          prompt: 'Simplest box',
          style: 'flat',
          svg: '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="red" /></svg>',
          timestamp: Date.now()
        }),
      });
    });

    // Generate to ensure preview content
    await page.locator('textarea[placeholder*="Describe what you want"]').first().fill('Simplest box');
    await page.locator('button[title="Generate SVG Design"]').first().click();

    // Find view toggle buttons specifically inside the view mode tablist of the PreviewArea
    const previewToggle = page.locator('[role="tablist"][aria-label="View mode"] button[role="tab"]:has-text("Preview")');
    const codeToggle = page.locator('[role="tablist"][aria-label="View mode"] button[role="tab"]:has-text("Code")');

    await expect(previewToggle).toBeVisible();
    await expect(codeToggle).toBeVisible();

    // Click Code mode tab
    await codeToggle.click();

    // Verify tab selected state changed
    await expect(codeToggle).toHaveAttribute('aria-selected', 'true');
    await expect(previewToggle).toHaveAttribute('aria-selected', 'false');

    // Code area loader or actual CodeMirror editor should load
    const editorContainer = page.locator('text=Loading editor...');
    // SvgCodeEditor is lazily loaded, so it might show loading or load the editor container
    const isLoaded = await page.locator('.cm-editor').count() > 0 || await editorContainer.count() > 0;
    expect(isLoaded).toBeTruthy();
  });
});
