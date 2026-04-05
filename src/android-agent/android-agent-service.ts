/**
 * Android Agent Service — DroidClaw Loop + duck-cli Providers
 * 
 * perceive → reason (LLM) → act loop for Android device control.
 * Uses duck-cli's ProviderManager for smart LLM routing.
 */

import { AndroidTools, type UiElement } from '../agent/android-tools.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { writeFileSync, mkdirSync } from 'fs';

// ===========================================
// Types
// ===========================================

export interface ActionDecision {
  think?: string;
  plan?: string[];
  planProgress?: string;
  action: string;
  coordinates?: [number, number];
  text?: string;
  direction?: string;
  reason?: string;
  package?: string;
  uri?: string;
  extras?: Record<string, string>;
  command?: string;
  filename?: string;
  query?: string;
  url?: string;
  path?: string;
  source?: string;
  dest?: string;
  code?: number;
  setting?: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: string;
}

export interface AgentConfig {
  maxSteps: number;
  stepDelay: number; // seconds
  maxElements: number;
  maxHistorySteps: number;
  visionMode: 'off' | 'fallback' | 'always';
  stuckThreshold: number;
  serial?: string;
  model?: string;
}

export interface StepLog {
  step: number;
  timestamp: string;
  foregroundApp: string | null;
  elementCount: number;
  screenChanged: boolean;
  decision: ActionDecision;
  result: ActionResult;
  llmLatencyMs: number;
  actionLatencyMs: number;
}

export interface SessionResult {
  success: boolean;
  goal: string;
  stepsUsed: number;
  maxSteps: number;
  steps: StepLog[];
  serial: string;
}

// ===========================================
// Compact element for LLM context
// ===========================================

interface CompactElement {
  text: string;
  center: [number, number];
  action: 'tap' | 'type' | 'longpress' | 'scroll' | 'read';
  enabled?: boolean;
  checked?: boolean;
  focused?: boolean;
  hint?: string;
  editable?: boolean;
  scrollable?: boolean;
}

/**
 * Convert duck-cli UiElement to compact element for LLM
 */
function compactElement(el: UiElement): CompactElement {
  const bounds = el.bounds;
  const center: [number, number] = bounds
    ? [Math.round((bounds.left + bounds.right) / 2), Math.round((bounds.top + bounds.bottom) / 2)]
    : [0, 0];
  const isClickable = el.clickable || el.long_clickable;

  let action: CompactElement['action'] = 'tap';
  if (!bounds) action = 'read';
  else if (isClickable && el.long_clickable) action = 'longpress';
  else if (isClickable) action = 'tap';

  const compact: CompactElement = {
    text: el.text || el.content_desc || '',
    center,
    action,
  };
  if (el.enabled === false) compact.enabled = false;
  if (el.focused) compact.focused = true;
  return compact;
}

/**
 * Score element for relevance
 */
function scoreElement(el: UiElement): number {
  let score = 0;
  if (el.enabled !== false) score += 10;
  if (el.clickable || el.long_clickable) score += 5;
  if (el.text) score += 3;
  return score;
}

/**
 * Deduplicate elements by center coordinates, score, and return top N compact elements
 */
function filterElements(elements: UiElement[], limit: number = 40): CompactElement[] {
  const seen = new Map<string, UiElement>();
  for (const el of elements) {
    if (!el.bounds) continue;
    const bucketX = Math.round((el.bounds.left + el.bounds.right) / 2 / 5) * 5;
    const bucketY = Math.round((el.bounds.top + el.bounds.bottom) / 2 / 5) * 5;
    const key = `${bucketX},${bucketY}`;
    const existing = seen.get(key);
    if (!existing || scoreElement(el) > scoreElement(existing)) {
      seen.set(key, el);
    }
  }
  const deduped = Array.from(seen.values());
  deduped.sort((a, b) => scoreElement(b) - scoreElement(a));
  return deduped.slice(0, limit).map(compactElement);
}

/**
 * Compute screen hash for change detection
 */
function screenHash(elements: UiElement[]): string {
  return elements.map((e) => `${e.resource_id}|${e.text}|${e.bounds?.left},${e.bounds?.top}|${e.enabled}`).join(';');
}

// ===========================================
// Android Agent Service
// ===========================================

export class AndroidAgentService {
  private android: AndroidTools;
  private config: AgentConfig;
  private sessionId: string;
  private logDir: string;

  constructor(config: Partial<AgentConfig> = {}) {
    this.android = new AndroidTools();
    this.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.logDir = '/tmp/duck-android-agent-logs';

    this.config = {
      maxSteps: config.maxSteps ?? 30,
      stepDelay: config.stepDelay ?? 2,
      maxElements: config.maxElements ?? 40,
      maxHistorySteps: config.maxHistorySteps ?? 10,
      visionMode: config.visionMode ?? 'fallback',
      stuckThreshold: config.stuckThreshold ?? 3,
      serial: config.serial,
      model: config.model,
    };
  }

  async init(): Promise<boolean> {
    await this.android.refreshDevices();
    const devices = this.android.getDevices();
    if (devices.length === 0) {
      console.error('[Agent] ❌ No Android device connected');
      return false;
    }
    if (this.config.serial) {
      this.android.setDevice(this.config.serial);
    }
    const device = this.android.getCurrentDevice();
    console.log(`[Agent] ✅ Connected: ${device?.serial} (${device?.model || 'unknown'})`);
    mkdirSync(this.logDir, { recursive: true });
    return true;
  }

  async run(goal: string): Promise<SessionResult> {
    console.log(`\n🤖 DroidClaw Agent`);
    console.log(`   Goal: ${goal}`);
    console.log(`   Model: ${this.config.model || 'auto (Gemma 4 preferred)'}`);
    console.log(`   Max steps: ${this.config.maxSteps}`);
    console.log('');

    const steps: StepLog[] = [];
    let prevElements: UiElement[] = [];
    let stuckCount = 0;
    let recentActions: string[] = [];
    let lastActionFeedback = '';
    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    for (let step = 0; step < this.config.maxSteps; step++) {
      console.log(`\n--- Step ${step + 1}/${this.config.maxSteps} ---`);

      // ── PERCEIVE ──
      const screenState = await this.perceive(step, prevElements);
      const { elements, compactJson, screenshotBase64, foregroundApp } = screenState;

      // ── DIFF ──
      let diffContext = '';
      let screenChanged = true;

      if (step > 0 && prevElements.length > 0) {
        const prevHash = screenHash(prevElements);
        const currHash = screenHash(elements);
        screenChanged = prevHash !== currHash;

        if (!screenChanged) {
          stuckCount++;
          diffContext = `\n\nSCREEN_CHANGE: Screen has NOT changed for ${stuckCount} step(s).`;
          if (stuckCount >= this.config.stuckThreshold) {
            diffContext += this.buildRecoveryHint(recentActions, stuckCount);
          }
        } else {
          stuckCount = 0;
          diffContext = '\n\nSCREEN_CHANGE: Screen changed.';
        }
      }
      prevElements = elements;

      // Repetition detection
      if (recentActions.length >= 3) {
        const freq: Record<string, number> = {};
        for (const a of recentActions) freq[a] = (freq[a] ?? 0) + 1;
        let topAction = '', topCount = 0;
        for (const [k, v] of Object.entries(freq)) { if (v > topCount) { topAction = k; topCount = v; } }
        if (topCount >= 3) {
          diffContext += `\n\nREPETITION_ALERT: You have attempted "${topAction}" ${topCount} times. DO NOT repeat it.`;
          if (topAction.startsWith('tap') || topAction.startsWith('longpress')) {
            diffContext += ` Alternatives: (1) If copying text, it likely succeeded — move on. (2) Use clipboard_set. (3) Use type.`;
          }
        }
      }

      // Drift detection
      if (recentActions.length >= 4) {
        const navSet = new Set(['swipe', 'scroll', 'back', 'home', 'wait', 'enter']);
        const navCount = recentActions.slice(-5).filter((a) => navSet.has(a.split('(')[0])).length;
        if (navCount >= 4) {
          diffContext += `\n\nDRIFT_WARNING: Your last ${navCount} actions were all navigation. STOP scrolling and take a direct action: tap a button, type text, or use clipboard_set.`;
        }
      }

      // ── BUILD USER MESSAGE ──
      const visionContext = screenshotBase64
        ? `\n\nVISION_ASSIST: A screenshot is attached. Use it to visually identify correct elements.`
        : '';

      const foregroundLine = foregroundApp ? `FOREGROUND_APP: ${foregroundApp}\n\n` : '';
      const feedbackLine = lastActionFeedback ? `LAST_ACTION_RESULT: ${lastActionFeedback}\n\n` : '';

      const textContent =
        `GOAL: ${goal}\n\n${foregroundLine}${feedbackLine}SCREEN_CONTEXT:\n${compactJson}${diffContext}${visionContext}`;

      const userContent: any[] = [{ type: 'text', text: textContent }];
      if (screenshotBase64) {
        userContent.push({
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${screenshotBase64}`, detail: 'low' },
        });
      }

      messages.push({ role: 'user', content: userContent });

      // ── REASON (LLM) ──
      const llmStart = Date.now();
      let decision: ActionDecision;
      try {
        decision = await this.getLLMDecision(messages);
      } catch (err) {
        console.log(`LLM Error: ${(err as Error).message}`);
        decision = { action: 'wait', reason: 'LLM request failed, waiting' };
      }
      const llmLatency = Date.now() - llmStart;

      if (decision.think) console.log(`💭 ${decision.think}`);
      if (decision.plan) console.log(`📋 Plan: ${decision.plan.join(' → ')}`);
      if (decision.planProgress) console.log(`🔄 ${decision.planProgress}`);
      console.log(`🎯 ${decision.action}${decision.reason ? ` — ${decision.reason}` : ''} (${llmLatency}ms)`);

      messages.push({ role: 'assistant', content: JSON.stringify(decision) });

      // ── ACT ──
      const actionStart = Date.now();
      const MULTI_STEP = ['read_screen', 'submit_message', 'copy_visible_text', 'wait_for_content', 'find_and_tap', 'compose_email'];
      let result: ActionResult;
      try {
        result = MULTI_STEP.includes(decision.action)
          ? await this.executeSkill(decision, elements)
          : await this.executeAction(decision);
      } catch (err) {
        console.log(`Action Error: ${(err as Error).message}`);
        result = { success: false, message: (err as Error).message };
      }
      const actionLatency = Date.now() - actionStart;

      // Track action
      const actionSig = decision.coordinates
        ? `${decision.action}(${decision.coordinates.join(',')})`
        : decision.action;
      recentActions.push(actionSig);
      if (recentActions.length > 8) recentActions.shift();

      lastActionFeedback = `${actionSig} → ${result.success ? 'OK' : 'FAILED'}: ${result.message}`;
      console.log(`${result.success ? '✅' : '❌'} ${result.message} (${actionLatency}ms)`);

      steps.push({
        step: step + 1,
        timestamp: new Date().toISOString(),
        foregroundApp,
        elementCount: elements.length,
        screenChanged,
        decision,
        result,
        llmLatencyMs: llmLatency,
        actionLatencyMs: actionLatency,
      });
      this.writePartialLog(steps);

      if (decision.action === 'done') {
        console.log('\n✅ Task completed!');
        return { success: true, goal, stepsUsed: step + 1, maxSteps: this.config.maxSteps, steps, serial: this.android.getCurrentDevice()?.serial || '' };
      }

      await this.sleep(this.config.stepDelay * 1000);
    }

    console.log(`\n⚠️  Max steps reached.`);
    return { success: false, goal, stepsUsed: this.config.maxSteps, maxSteps: this.config.maxSteps, steps, serial: this.android.getCurrentDevice()?.serial || '' };
  }

  private async perceive(step: number, _prevElements: UiElement[]): Promise<{
    elements: UiElement[];
    compactJson: string;
    screenshotBase64: string | null;
    foregroundApp: string | null;
  }> {
    await this.android.refreshDevices();

    const xml = await this.android.dumpUiXml();
    const elements = this.android.parseUiXml(xml);
    const compact = filterElements(elements, this.config.maxElements);
    const compactJson = JSON.stringify(compact);

    const foregroundApp = await this.android.getForegroundApp();
    if (foregroundApp) console.log(`📱 ${foregroundApp}`);

    let screenshotBase64: string | null = null;
    const isStuckVision = step >= 2;
    const shouldCapture =
      this.config.visionMode === 'always' ||
      (this.config.visionMode === 'fallback' && elements.length === 0) ||
      isStuckVision;

    if (shouldCapture) {
      const path = `/tmp/duck-agent-screenshot-${step}.png`;
      await this.android.captureScreen(path);
      try {
        const { readFileSync } = await import('fs');
        const buf = readFileSync(path);
        screenshotBase64 = buf.toString('base64');
        console.log(isStuckVision ? '📸 Stuck — sending screenshot for visual assist' : '📸 Sending screenshot to LLM');
      } catch {
        // screenshot failed
      }
    }

    return { elements, compactJson, screenshotBase64, foregroundApp };
  }

  private async getLLMDecision(messages: any[]): Promise<ActionDecision> {
    const { ProviderManager } = await import('../providers/manager.js');
    const pm = new ProviderManager();
    await pm.load();

    const result = await pm.route('', messages);
    if (!result.text) throw new Error('No response from LLM providers');

    return this.parseDecision(result.text);
  }

  private parseDecision(text: string): ActionDecision {
    let decision: ActionDecision | null = null;

    try {
      decision = JSON.parse(text);
    } catch {
      const sanitized = text.replace(/\n/g, ' ').replace(/\r/g, '');
      try {
        decision = JSON.parse(sanitized);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          try { decision = JSON.parse(match[0]); } catch { /* ignore */ }
        }
      }
    }

    if (!decision || !decision.action) {
      console.log(`⚠️  Could not parse: ${text.slice(0, 200)}`);
      return { action: 'wait', reason: 'Parse failed' };
    }

    if (decision.coordinates) {
      decision.coordinates = this.sanitizeCoords(decision.coordinates);
    }
    return decision;
  }

  private sanitizeCoords(raw: any): [number, number] | undefined {
    if (!raw) return undefined;
    if (Array.isArray(raw) && raw.length >= 2) {
      const x = Number(raw[0]);
      const y = Number(raw[1]);
      if (Number.isFinite(x) && Number.isFinite(y) && x <= 10000 && y <= 10000) {
        return [Math.round(x), Math.round(y)];
      }
    }
    if (typeof raw === 'string') {
      const parts = raw.split(/[,\s]+/).map(Number).filter(Number.isFinite);
      if (parts.length >= 2) return [Math.round(parts[0]), Math.round(parts[1])];
    }
    return undefined;
  }

  private async executeAction(decision: ActionDecision): Promise<ActionResult> {
    switch (decision.action) {
      case 'tap': {
        if (!decision.coordinates) return { success: false, message: 'No coordinates for tap' };
        await this.android.tap(decision.coordinates[0], decision.coordinates[1]);
        return { success: true, message: `Tapped (${decision.coordinates[0]}, ${decision.coordinates[1]})` };
      }
      case 'longpress': {
        if (!decision.coordinates) return { success: false, message: 'No coordinates for longpress' };
        const [x, y] = decision.coordinates;
        await this.android.swipe(x, y, x, y, 1000);
        return { success: true, message: `Long pressed (${x}, ${y})` };
      }
      case 'type': {
        if (!decision.text) return { success: false, message: 'No text to type' };
        if (decision.coordinates) {
          await this.android.tap(decision.coordinates[0], decision.coordinates[1]);
          await this.sleep(300);
        }
        await this.android.typeText(decision.text);
        return { success: true, message: `Typed "${decision.text}"` };
      }
      case 'enter': {
        await this.android.pressEnter();
        return { success: true, message: 'Pressed Enter' };
      }
      case 'scroll':
      case 'swipe': {
        const dir = (decision.direction || 'down') as 'up' | 'down' | 'left' | 'right';
        await this.android.scroll(dir, 500);
        return { success: true, message: `Scrolled ${dir}` };
      }
      case 'back': {
        await this.android.pressBack();
        return { success: true, message: 'Pressed Back' };
      }
      case 'home': {
        await this.android.pressHome();
        return { success: true, message: 'Pressed Home' };
      }
      case 'wait': {
        await this.sleep(2000);
        return { success: true, message: 'Waited 2s' };
      }
      case 'done': {
        return { success: true, message: decision.reason || 'Task complete' };
      }
      case 'launch': {
        if (decision.package) {
          await this.android.launchApp(decision.package);
          return { success: true, message: `Launched ${decision.package}` };
        }
        if (decision.uri) {
          await this.android.shell(`am start -a android.intent.action.VIEW -d "${decision.uri}"`);
          return { success: true, message: `Launched URI: ${decision.uri}` };
        }
        return { success: false, message: 'No package or URI for launch' };
      }
      case 'switch_app': {
        if (!decision.package) return { success: false, message: 'No package for switch_app' };
        await this.android.launchApp(decision.package);
        return { success: true, message: `Switched to ${decision.package}` };
      }
      case 'open_url': {
        if (!decision.url) return { success: false, message: 'No URL provided' };
        await this.android.shell(`am start -a android.intent.action.VIEW -d "${decision.url}"`);
        return { success: true, message: `Opened: ${decision.url}` };
      }
      case 'clipboard_get': {
        const text = await this.android.getClipboard();
        return { success: true, message: `Clipboard: ${text || '(empty)'}`, data: text || '' };
      }
      case 'clipboard_set': {
        if (!decision.text) return { success: false, message: 'No text for clipboard_set' };
        await this.android.setClipboard(decision.text);
        return { success: true, message: `Clipboard set to "${decision.text}"` };
      }
      case 'paste': {
        if (decision.coordinates) {
          await this.android.tap(decision.coordinates[0], decision.coordinates[1]);
          await this.sleep(300);
        }
        await this.android.shell('input keyevent 279'); // KEYCODE_PASTE
        return { success: true, message: 'Pasted from clipboard' };
      }
      case 'notifications': {
        const notifs = await this.android.getNotifications();
        return { success: true, message: `${notifs.length} notifications`, data: JSON.stringify(notifs) };
      }
      case 'pull_file': {
        if (!decision.path) return { success: false, message: 'No path for pull_file' };
        const localPath = `/tmp/${decision.path.split('/').pop()}`;
        await this.android.pullFile(decision.path, localPath);
        return { success: true, message: `Pulled ${decision.path} → ${localPath}` };
      }
      case 'push_file': {
        if (!decision.source || !decision.dest) return { success: false, message: 'Missing source or dest' };
        await this.android.pushFile(decision.source, decision.dest);
        return { success: true, message: `Pushed ${decision.source} → ${decision.dest}` };
      }
      case 'keyevent': {
        if (decision.code == null) return { success: false, message: 'No keycode for keyevent' };
        await this.android.shell(`input keyevent ${decision.code}`);
        return { success: true, message: `Sent keyevent ${decision.code}` };
      }
      case 'open_settings': {
        const settingsMap: Record<string, string> = {
          wifi: 'android.settings.WIFI_SETTINGS',
          bluetooth: 'android.settings.BLUETOOTH_SETTINGS',
          display: 'android.settings.DISPLAY_SETTINGS',
          sound: 'android.settings.SOUND_SETTINGS',
          battery: 'android.settings.BATTERY_SAVER_SETTINGS',
          location: 'android.settings.LOCATION_SOURCE_SETTINGS',
          apps: 'android.settings.APPLICATION_SETTINGS',
          date: 'android.settings.DATE_SETTINGS',
          accessibility: 'android.settings.ACCESSIBILITY_SETTINGS',
          developer: 'android.settings.APPLICATION_DEVELOPMENT_SETTINGS',
        };
        const action = settingsMap[decision.setting || ''];
        if (!action) return { success: false, message: `Unknown setting: ${decision.setting}` };
        await this.android.shell(`am start -a ${action}`);
        return { success: true, message: `Opened ${decision.setting} settings` };
      }
      case 'shell': {
        if (!decision.command) return { success: false, message: 'No command for shell' };
        const { stdout } = await this.android.shell(decision.command);
        return { success: true, message: `Shell: ${stdout.slice(0, 200)}`, data: stdout };
      }
      case 'screenshot': {
        const path = decision.filename || `/tmp/screenshot-${Date.now()}.png`;
        await this.android.captureScreen(path);
        return { success: true, message: `Screenshot: ${path}`, data: path };
      }
      case 'clear': {
        await this.android.clearText();
        return { success: true, message: 'Cleared text field' };
      }
      default:
        return { success: false, message: `Unknown action: ${decision.action}` };
    }
  }

  private async executeSkill(decision: ActionDecision, elements: UiElement[]): Promise<ActionResult> {
    switch (decision.action) {
      case 'read_screen': {
        const allTexts: string[] = [];
        const seen = new Set<string>();
        for (let i = 0; i < 5; i++) {
          const xml = await this.android.dumpUiXml();
          const els = this.android.parseUiXml(xml);
          for (const el of els) {
            if (el.text && !seen.has(el.text)) {
              seen.add(el.text);
              allTexts.push(el.text);
            }
          }
          await this.android.scroll('down', 500);
          await this.sleep(1500);
        }
        const combined = allTexts.join('\n');
        await this.android.setClipboard(combined);
        return { success: true, message: `Read ${allTexts.length} text elements, copied to clipboard`, data: combined };
      }

      case 'submit_message': {
        const xml = await this.android.dumpUiXml();
        const els = this.android.parseUiXml(xml);
        const sendPattern = /send|submit|post|arrow|paper.?plane/i;
        const candidates = els.filter(
          (el) => (el.enabled !== false) && el.clickable && (sendPattern.test(el.text || '') || sendPattern.test(el.resource_id || ''))
        );
        if (candidates.length === 0) {
          return { success: false, message: 'Could not find Send/Submit button' };
        }
        const target = candidates[0];
        if (!target.bounds) return { success: false, message: 'Send button has no bounds' };
        const cx = Math.round((target.bounds.left + target.bounds.right) / 2);
        const cy = Math.round((target.bounds.top + target.bounds.bottom) / 2);
        await this.android.tap(cx, cy);
        await this.sleep(6000);
        return { success: true, message: `Tapped "${target.text}" at (${cx}, ${cy})` };
      }

      case 'copy_visible_text': {
        let textEls = elements.filter((el) => el.text);
        if (decision.query) {
          const q = decision.query.toLowerCase();
          textEls = textEls.filter((el) => (el.text || '').toLowerCase().includes(q));
        }
        textEls.sort((a, b) => (a.bounds?.top ?? 0) - (b.bounds?.top ?? 0));
        const combined = textEls.map((el) => el.text || '').join('\n');
        await this.android.setClipboard(combined);
        return { success: true, message: `Copied ${textEls.length} text elements to clipboard`, data: combined };
      }

      case 'wait_for_content': {
        const originalTexts = new Set(elements.map((el) => el.text).filter(Boolean));
        for (let i = 0; i < 5; i++) {
          await this.sleep(3000);
          const xml = await this.android.dumpUiXml();
          const els = this.android.parseUiXml(xml);
          const newTexts = els.map((el) => el.text).filter((t) => t && !originalTexts.has(t));
          if (newTexts.length > 0) {
            return { success: true, message: `New content after ${(i + 1) * 3}s: ${newTexts.slice(0, 3).join('; ')}` };
          }
        }
        return { success: false, message: 'No new content after 15s' };
      }

      case 'find_and_tap': {
        if (!decision.query) return { success: false, message: 'find_and_tap requires query' };
        const q = decision.query.toLowerCase();

        let best = elements.find((el) => el.text && el.text.toLowerCase().includes(q));

        if (!best) {
          for (let i = 0; i < 10; i++) {
            await this.android.scroll('down', 500);
            await this.sleep(1500);
            const xml = await this.android.dumpUiXml();
            const els = this.android.parseUiXml(xml);
            best = els.find((el) => el.text && el.text.toLowerCase().includes(q));
            if (best) break;
          }
        }

        if (!best || !best.bounds) {
          const available = elements.slice(0, 15).map((el) => el.text).filter(Boolean);
          return { success: false, message: `No element matching "${decision.query}". Available: ${available.join(', ')}` };
        }

        const cx = Math.round((best.bounds.left + best.bounds.right) / 2);
        const cy = Math.round((best.bounds.top + best.bounds.bottom) / 2);
        await this.android.tap(cx, cy);
        return { success: true, message: `Tapped "${best.text}" at (${cx}, ${cy})` };
      }

      case 'compose_email': {
        if (!decision.query) return { success: false, message: 'compose_email requires query (email address)' };
        await this.android.shell(`am start -a android.intent.action.SENDTO -d mailto:${decision.query}`);
        await this.sleep(2500);

        if (decision.text) {
          await this.android.setClipboard(decision.text);
          await this.sleep(200);
          await this.android.shell('input keyevent 279'); // paste
        }
        return { success: true, message: `Email compose opened to ${decision.query}` };
      }

      default:
        return { success: false, message: `Unknown skill: ${decision.action}` };
    }
  }

  private buildRecoveryHint(recentActions: string[], stuckCount: number): string {
    const failingTypes = new Set(recentActions.slice(-stuckCount).map((a) => a.split('(')[0]));

    let hint = `\n\nWARNING: Stuck for ${stuckCount} steps. Screen is NOT changing.`;

    if (failingTypes.has('tap') || failingTypes.has('longpress')) {
      hint += `\nTap/press actions have NO EFFECT. Likely causes:` +
        `\n- The action SUCCEEDED SILENTLY (copy/share/like buttons). If so, MOVE ON.` +
        `\n- Element not interactive. Use "clipboard_set" to set text directly.` +
        `\n- Use "type" directly in the target app.` +
        `\n- Your plan is NOT working. Create a COMPLETELY NEW PLAN with a different approach.`;
    }
    if (failingTypes.has('swipe') || failingTypes.has('scroll')) {
      hint += `\nSwiping has no effect — you may be at the end of scrollable content.`;
    }
    return hint;
  }

  private trimMessages(messages: any[], maxHistorySteps: number): any[] {
    if (messages.length === 0) return messages;
    const system = messages[0].role === 'system' ? messages[0] : null;
    const rest = system ? messages.slice(1) : messages;
    const maxMessages = maxHistorySteps * 2;
    if (rest.length <= maxMessages) return messages;

    const dropped = rest.length - maxMessages;
    const summary = { role: 'user' as const, content: `[${Math.ceil(dropped / 2)} earlier steps omitted]` };
    return system ? [system, summary, ...rest.slice(dropped)] : [summary, ...rest.slice(dropped)];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private writePartialLog(steps: StepLog[]): void {
    try {
      writeFileSync(
        `${this.logDir}/${this.sessionId}.partial.json`,
        JSON.stringify({ sessionId: this.sessionId, steps, goal: '', completed: false }, null, 2)
      );
    } catch {
      // ignore
    }
  }
}
