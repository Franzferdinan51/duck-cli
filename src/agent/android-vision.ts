/**
 * Android Vision Analysis Tool  
 * AI-powered screen understanding for Android automation
 * 
 * Uses AndroidTools singleton - auto-selects first connected device
 */

import { AndroidTools } from './android-tools.js';

const android = new AndroidTools();

export interface VisionAnalysis {
  screenshot: string;
  elementCount: number;
  tappableElements: Array<{
    description: string;
    x: number;
    y: number;
    type: string;
  }>;
  screenText: string;
  recommendations: string[];
  confidence: number;
}

/**
 * Capture screenshot and save
 */
export async function captureScreen(filename?: string): Promise<string> {
  const name = filename || `screenshot_${Date.now()}.png`;
  const savePath = `/tmp/duck-android/${name}`;
  await android.captureScreen(savePath);
  return savePath;
}

/**
 * Get UI elements from screen dump
 */
export async function getUIElements(packageFilter?: string) {
  await android.refreshDevices();
  const xml = await android.dumpUiXml(packageFilter);
  return android.parseUiXml(xml);
}

/**
 * Get all visible text from screen
 */
export async function getScreenText(): Promise<string> {
  await android.refreshDevices();
  return android.readScreen();
}

/**
 * Find tappable elements with coordinates
 */
export async function findTappableElements(): Promise<Array<{
  description: string;
  x: number;
  y: number;
  type: string;
}>> {
  const elements = await getUIElements();
  
  return elements
    .filter(e => e.clickable && e.bounds)
    .map(e => {
      const bounds = typeof e.bounds === 'string' ? JSON.parse(e.bounds) : e.bounds;
      return {
        description: e.text || e.content_desc || 'Unknown',
        x: Math.round((bounds.left + bounds.right) / 2),
        y: Math.round((bounds.top + bounds.bottom) / 2),
        type: e.class || 'Unknown'
      };
    });
}

/**
 * Full AI analysis of screen
 */
export async function analyzeScreen(): Promise<VisionAnalysis> {
  await android.refreshDevices();
  
  // Capture screenshot
  const screenshot = await captureScreen();
  
  // Get UI elements
  const elements = await getUIElements();
  
  // Get screen text
  const screenText = await getScreenText();
  
  // Find tappable elements
  const tappable = await findTappableElements();
  
  // Generate recommendations
  const recommendations = generateRecommendations(elements, screenText);
  
  return {
    screenshot,
    elementCount: elements.length,
    tappableElements: tappable.slice(0, 10),
    screenText: screenText.substring(0, 500),
    recommendations,
    confidence: elements.length > 0 ? 0.85 : 0.5
  };
}

/**
 * Generate recommendations based on screen context
 */
function generateRecommendations(elements: any[], text: string): string[] {
  const recommendations: string[] = [];
  const textLower = text.toLowerCase();
  
  // Login screen
  if (textLower.includes('sign in') || textLower.includes('login')) {
    recommendations.push('Login screen detected - use type for input fields, tap for buttons');
  }
  
  // Search
  if (textLower.includes('search')) {
    recommendations.push('Search detected - tap search field, then type');
  }
  
  // Camera
  if (textLower.includes('camera') || textLower.includes('photo')) {
    recommendations.push('Camera/photo screen - shutter button typically at bottom center');
  }
  
  // Messaging
  if (textLower.includes('message') || textLower.includes('send')) {
    recommendations.push('Messaging screen - type message, tap send or press enter');
  }
  
  // Form
  const editTexts = elements.filter((e: any) => e.class?.includes('EditText'));
  if (editTexts.length > 2) {
    recommendations.push(`Form with ${editTexts.length} fields detected`);
  }
  
  // Error
  if (textLower.includes('error') || textLower.includes('warning')) {
    recommendations.push('⚠️ Warning/error on screen - proceed with caution');
  }
  
  return recommendations;
}

/**
 * Find element by text and tap it
 */
export async function findAndTapElement(query: string): Promise<{found: boolean; tapped: boolean}> {
  const elements = await getUIElements();
  
  for (const el of elements) {
    if ((el.text?.toLowerCase().includes(query.toLowerCase())) ||
        (el.content_desc?.toLowerCase().includes(query.toLowerCase()))) {
      if (el.bounds && el.clickable) {
        const bounds = typeof el.bounds === 'string' ? JSON.parse(el.bounds) : el.bounds;
        await android.tap(
          Math.round((bounds.left + bounds.right) / 2),
          Math.round((bounds.top + bounds.bottom) / 2)
        );
        return { found: true, tapped: true };
      }
    }
  }
  
  return { found: false, tapped: false };
}

/**
 * Describe what's at coordinates
 */
export async function describeAt(x: number, y: number): Promise<string> {
  const elements = await getUIElements();
  
  for (const el of elements) {
    if (!el.bounds) continue;
    const bounds = typeof el.bounds === 'string' ? JSON.parse(el.bounds) : el.bounds;
    
    if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom) {
      return [
        `Type: ${el.class || 'Unknown'}`,
        el.text ? `Text: "${el.text}"` : null,
        el.content_desc ? `Description: ${el.content_desc}` : null,
        `Clickable: ${el.clickable ? 'Yes' : 'No'}`
      ].filter(Boolean).join('\n');
    }
  }
  
  return `No element found at (${x}, ${y})`;
}

// Singleton instance
export const androidVision = {
  capture: captureScreen,
  getUIElements,
  getScreenText,
  findTappableElements,
  analyze: analyzeScreen,
  findAndTapElement,
  describeAt
};

export default androidVision;