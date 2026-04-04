/**
 * Duck CLI Android Agent
 * 
 * Runs locally on Android phone via Termux or standalone
 * Provides: perception → reasoning → action loop (DroidClaw-style)
 * 
 * Can use:
 * - Local LLM (Ollama on phone or connected device)
 * - Remote LLM via network (LM Studio on Mac, etc.)
 * - Cloud LLM (Groq, OpenAI, etc.)
 */

import { AndroidTools, UiElement } from './android-tools.js';

export interface AgentConfig {
  // LLM Provider
  llmProvider: 'openai' | 'anthropic' | 'groq' | 'ollama' | 'lmstudio' | 'minimax' | 'kimi';
  llmModel: string;
  llmApiKey?: string;
  llmBaseUrl?: string;  // For custom endpoints (Ollama, LM Studio, etc.)
  
  // Device
  deviceSerial?: string;
  
  // Agent behavior
  maxSteps: number;
  stepDelay: number;  // ms between actions
  screenshotOnError: boolean;
  
  // Autonomous mode
  autonomousEnabled: boolean;
  autonomousInterval: number;  // seconds between autonomous checks
}

export interface AgentStep {
  step: number;
  think: string;
  action: string;
  result: string;
  success: boolean;
}

export interface AgentGoal {
  description: string;
  steps: AgentStep[];
  completed: boolean;
  finalResult?: string;
}

export class AndroidAgent {
  private android: AndroidTools;
  private config: AgentConfig;
  private history: AgentGoal[] = [];
  
  constructor(config: Partial<AgentConfig> = {}) {
    this.android = new AndroidTools();
    this.config = {
      llmProvider: config.llmProvider || 'openai',
      llmModel: config.llmModel || 'gpt-4o-mini',
      llmApiKey: config.llmApiKey || process.env.OPENAI_API_KEY,
      llmBaseUrl: config.llmBaseUrl || 'http://localhost:11434',  // Ollama default
      maxSteps: config.maxSteps || 30,
      stepDelay: config.stepDelay || 500,
      screenshotOnError: config.screenshotOnError !== false,
      autonomousEnabled: config.autonomousEnabled || false,
      autonomousInterval: config.autonomousInterval || 60
    };
  }
  
  /**
   * Initialize - refresh device connection
   */
  async init(): Promise<boolean> {
    const devices = await this.android.refreshDevices();
    if (devices.length === 0) {
      console.error('[Agent] No Android device connected');
      return false;
    }
    
    if (this.config.deviceSerial) {
      this.android.setDevice(this.config.deviceSerial);
    }
    
    console.log(`[Agent] Connected to ${devices.length} device(s)`);
    return true;
  }
  
  /**
   * Execute a goal using perception → reasoning → action loop
   */
  async executeGoal(goal: string): Promise<AgentGoal> {
    console.log(`[Agent] 🎯 Goal: ${goal}`);
    
    const agentGoal: AgentGoal = {
      description: goal,
      steps: [],
      completed: false
    };
    
    // Perception: Get initial screen state
    let screenState = await this.perceive();
    
    for (let step = 1; step <= this.config.maxSteps; step++) {
      console.log(`\n[Agent] --- Step ${step}/${this.config.maxSteps} ---`);
      
      // Reasoning: Analyze and plan
      const plan = await this.reason(goal, screenState, agentGoal.steps);
      
      if (!plan) {
        console.log('[Agent] ❌ Reasoning failed - aborting');
        break;
      }
      
      console.log(`[Agent] 💭 Think: ${plan.think}`);
      console.log(`[Agent] 🎬 Action: ${plan.action}`);
      
      // Action: Execute the plan
      const result = await this.act(plan.action);
      
      const stepResult: AgentStep = {
        step,
        think: plan.think,
        action: plan.action,
        result: result.message,
        success: result.success
      };
      
      agentGoal.steps.push(stepResult);
      
      if (!result.success && this.config.screenshotOnError) {
        await this.captureScreenshot(`error-step-${step}`);
      }
      
      // Check if goal is complete
      if (result.done) {
        console.log('[Agent] ✅ Goal completed!');
        agentGoal.completed = true;
        agentGoal.finalResult = result.message;
        break;
      }
      
      // Perception: Get updated screen state
      await this.delay(this.config.stepDelay);
      screenState = await this.perceive();
      
      // Check for stuck loops
      if (this.detectStuckLoop(agentGoal.steps)) {
        console.log('[Agent] ⚠️ Stuck loop detected - injecting recovery hints');
        screenState.recoveryHint = 'Previous actions not working - try a different approach';
      }
      
      // Check for drift (navigation spam)
      if (this.detectDrift(agentGoal.steps)) {
        console.log('[Agent] ⚠️ Drift detected - nudging toward direct action');
        screenState.driftWarning = true;
      }
    }
    
    this.history.push(agentGoal);
    
    if (!agentGoal.completed) {
      console.log(`[Agent] ⚠️ Goal not completed after ${agentGoal.steps.length} steps`);
    }
    
    return agentGoal;
  }
  
  /**
   * Perceive: Get current screen state
   */
  private async perceive(): Promise<{
    screenshot: string;
    uiElements: UiElement[];
    screenText: string;
    foregroundApp: string | null;
    recoveryHint?: string;
    driftWarning?: boolean;
  }> {
    await this.android.refreshDevices();
    
    const screenshotResult = await this.android.captureScreen('/tmp/agent-screenshot.png');
    const screenshot = typeof screenshotResult === 'string' ? screenshotResult : (screenshotResult?.path || '/tmp/agent-screenshot.png');
    const xml = await this.android.dumpUiXml();
    const uiElements = this.android.parseUiXml(xml);
    const screenText = await this.android.readScreen();
    const foregroundApp = await this.android.getForegroundApp();
    
    return {
      screenshot,
      uiElements,
      screenText,
      foregroundApp,
      recoveryHint: undefined,
      driftWarning: undefined
    };
  }
  
  /**
   * Reason: Analyze screen state and create action plan
   */
  private async reason(
    goal: string, 
    screenState: Awaited<ReturnType<typeof this.perceive>>,
    history: AgentStep[]
  ): Promise<{ think: string; action: string } | null> {
    try {
      // Build context for LLM
      const context = this.buildContext(goal, screenState, history);
      
      // Call LLM for reasoning
      const response = await this.callLLM(context);
      
      // Parse response to extract think and action
      return this.parseResponse(response);
    } catch (error) {
      console.error('[Agent] Reasoning error:', error);
      return null;
    }
  }
  
  /**
   * Build context prompt for LLM
   */
  private buildContext(
    goal: string,
    screenState: Awaited<ReturnType<typeof this.perceive>>,
    history: AgentStep[]
  ): string {
    const historyText = history.length > 0 
      ? history.map(s => `Step ${s.step}: ${s.action} → ${s.success ? 'success' : 'failed'}`).join('\n')
      : 'No previous steps';
    
    const elementsText = screenState.uiElements
      .filter(e => e.clickable)
      .slice(0, 15)
      .map(e => {
        const bounds = typeof e.bounds === 'string' ? JSON.parse(e.bounds) : e.bounds;
        return `- "${e.text || e.content_desc || 'unnamed'}" (${e.class}) at (${bounds?.left || 0},${bounds?.top || 0}) clickable=${e.clickable}`;
      })
      .join('\n');
    
    let prompt = `You are an Android automation agent. A user wants to accomplish this goal:

GOAL: "${goal}"

CURRENT SCREEN:
- App: ${screenState.foregroundApp || 'Unknown'}
- Visible text: ${screenState.screenText.substring(0, 300)}...
- Tappable elements:
${elementsText || '- (no tappable elements found)'}

RECENT HISTORY:
${historyText}

${screenState.recoveryHint ? `RECOVERY HINT: ${screenState.recoveryHint}\n` : ''}
${screenState.driftWarning ? 'DRIFT WARNING: You are navigating too much without interacting. Take direct action.\n' : ''}

Based on this, provide your next action.

Think about what you see and what makes sense to do next. Consider:
- What element should you interact with?
- What action (tap, type, swipe, press key)?
- What text to input if any?

Respond with a JSON object containing:
{
  "think": "Your reasoning for this action",
  "action": "The action to take (e.g., 'tap 360 720' or 'type Hello' or 'press back' or 'done')"
}

If the goal is complete, set action to "done" and explain in think.
If no valid action is possible, explain why and suggest an alternative approach.`;

    return prompt;
  }
  
  /**
   * Call LLM API
   */
  private async callLLM(prompt: string): Promise<string> {
    const { llmProvider, llmModel, llmApiKey, llmBaseUrl } = this.config;
    
    switch (llmProvider) {
      case 'openai':
        return this.callOpenAI(prompt, llmModel, llmApiKey!);
      
      case 'anthropic':
        return this.callAnthropic(prompt, llmModel, llmApiKey!);
      
      case 'groq':
        return this.callGroq(prompt, llmModel, llmApiKey!);
      
      case 'ollama':
        return this.callOllama(prompt, llmModel, llmBaseUrl!);
      
      case 'lmstudio':
        return this.callLMStudio(prompt, llmModel, llmBaseUrl!);
      
      case 'minimax':
        return this.callMinimax(prompt, llmModel, llmApiKey!);
      
      case 'kimi':
        return this.callKimi(prompt, llmModel, llmApiKey!);
      
      default:
        throw new Error(`Unknown LLM provider: ${llmProvider}`);
    }
  }
  
  private async callOpenAI(prompt: string, model: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500
      })
    });
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
  
  private async callGroq(prompt: string, model: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'llama-3.2-3b-preview',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500
      })
    });
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
  
  private async callOllama(prompt: string, model: string, baseUrl: string): Promise<string> {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false
      })
    });
    
    const data = await response.json();
    return data.message?.content || '';
  }
  
  private async callLMStudio(prompt: string, model: string, baseUrl: string): Promise<string> {
    // LM Studio compatible with OpenAI API
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500
      })
    });
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
  
  private async callAnthropic(prompt: string, model: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    const data = await response.json();
    return data.content?.[0]?.text || '';
  }
  
  private async callMinimax(prompt: string, model: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.minimax.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
  
  private async callKimi(prompt: string, model: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
  
  /**
   * Parse LLM response
   */
  private parseResponse(response: string): { think: string; action: string } | null {
    try {
      // Try JSON first
      const json = JSON.parse(response);
      if (json.think && json.action) {
        return { think: json.think, action: json.action };
      }
    } catch {
      // Try to extract from text
      const thinkMatch = response.match(/think["\s:]+([^"]+)/i) || response.match(/think:\s*([^\n]+)/i);
      const actionMatch = response.match(/action["\s:]+([^"]+)/i) || response.match(/action:\s*([^\n]+)/i);
      
      if (thinkMatch && actionMatch) {
        return { think: thinkMatch[1].trim(), action: actionMatch[1].trim() };
      }
    }
    
    // Default fallback
    return { think: 'Could not parse response', action: 'done' };
  }
  
  /**
   * Act: Execute the planned action
   */
  private async act(action: string): Promise<{ success: boolean; done: boolean; message: string }> {
    const parts = action.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    try {
      switch (cmd) {
        case 'tap':
          const [x, y] = [parseInt(args[0]), parseInt(args[1])];
          if (isNaN(x) || isNaN(y)) throw new Error('Invalid tap coordinates');
          const tapResult = await this.android.tap(x, y);
          return { success: tapResult, done: false, message: `Tapped at (${x}, ${y})` };
        
        case 'type':
          const text = args.join(' ');
          const typeResult = await this.android.typeText(text);
          return { success: typeResult, done: false, message: `Typed: "${text}"` };
        
        case 'press':
          const key = args[0];
          const keyResult = await this.android.pressKey(key);
          return { success: keyResult, done: false, message: `Pressed key: ${key}` };
        
        case 'swipe':
          const dir = args[0] as 'up' | 'down' | 'left' | 'right';
          const dist = parseInt(args[1]) || 500;
          const swipeResult = await this.android.scroll(dir, dist);
          return { success: swipeResult, done: false, message: `Swiped ${dir}` };
        
        case 'launch':
          const pkg = args[0];
          const launchResult = await this.android.launchApp(pkg);
          return { success: launchResult, done: false, message: `Launched: ${pkg}` };
        
        case 'done':
          return { success: true, done: true, message: 'Goal completed' };
        
        case 'wait':
          await this.delay(parseInt(args[0]) * 1000 || 1000);
          return { success: true, done: false, message: 'Waited' };
        
        default:
          // Try as shell command
          const shellResult = await this.android.shell(action);
          return { success: true, done: false, message: `Executed: ${action}` };
      }
    } catch (error: any) {
      return { success: false, done: false, message: `Error: ${error.message}` };
    }
  }
  
  /**
   * Detect stuck loop (same coordinates tapped 3+ times)
   */
  private detectStuckLoop(steps: AgentStep[]): boolean {
    if (steps.length < 3) return false;
    
    const recentTaps = steps.slice(-3).filter(s => s.action.startsWith('tap'));
    if (recentTaps.length < 3) return false;
    
    // Extract coordinates from actions
    const coords = recentTaps.map(s => {
      const match = s.action.match(/tap\s+(\d+)\s+(\d+)/);
      return match ? `${match[1]},${match[2]}` : '';
    }).filter(Boolean);
    
    // Check if all same coordinates
    return coords.length >= 3 && coords.every(c => c === coords[0]);
  }
  
  /**
   * Detect drift (navigation spam without interaction)
   */
  private detectDrift(steps: AgentStep[]): boolean {
    if (steps.length < 5) return false;
    
    const recent = steps.slice(-5);
    const navActions = ['swipe', 'press back', 'press home', 'wait'];
    const hasNavigation = recent.some(s => navActions.some(n => s.action.toLowerCase().includes(n)));
    const hasInteraction = recent.some(s => s.action.startsWith('tap') || s.action.startsWith('type'));
    
    return hasNavigation && !hasInteraction;
  }
  
  /**
   * Capture screenshot for debugging
   */
  private async captureScreenshot(filename: string): Promise<void> {
    const path = `/tmp/${filename}.png`;
    await this.android.captureScreen(path);
    console.log(`[Agent] 📸 Screenshot saved: ${path}`);
  }
  
  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get agent history
   */
  getHistory(): AgentGoal[] {
    return this.history;
  }
  
  /**
   * Update config
   */
  updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
export const androidAgent = new AndroidAgent();

export default androidAgent;