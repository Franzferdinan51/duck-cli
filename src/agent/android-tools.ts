/**
 * DroidClaw-Style Android Device Tools
 * Inspired by: https://github.com/unitedbyai/droidclaw
 *
 * Provides ADB-based Android device control for duck-cli.
 * Supports:
 * - Device listing and connection management
 * - Screen capture and analysis
 * - UI element interaction (tap, swipe, type)
 * - App launching and management
 * - Shell command execution
 * - Screenshot with vision AI analysis
 *
 * Prerequisites: ADB (Android Debug Bridge) must be installed and accessible.
 * On macOS: brew install android-platform-tools
 * The device must have USB debugging enabled.
 */

import { exec, spawn } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { promisify } from "util";
import { join, dirname } from "path";
import { randomUUID } from "crypto";

const execAsync = promisify(exec);

// Import remote node sanitizer (OpenClaw v2026.4.9 security fix)
import { sanitizeCommand, logSanitization } from "../security/remote-node-sanitizer.js";

export interface AndroidDevice {
  serial: string;
  state: "device" | "offline" | "unauthorized" | "no device";
  model?: string;
  product?: string;
  device?: string;
  transport?: string;
}

export interface UiElement {
  text?: string;
  content_desc?: string;
  resource_id?: string;
  class?: string;
  bounds?: { left: number; top: number; right: number; bottom: number };
  clickable?: boolean;
  long_clickable?: boolean;
  enabled?: boolean;
  focused?: boolean;
}

export interface ScreenCapture {
  path: string;
  width: number;
  height: number;
  timestamp: string;
}

// ─── ADB Core ──────────────────────────────────────────────────────────────

export class AndroidTools {
  private devices: Map<string, AndroidDevice> = new Map();
  private serial: string | null = null;
  private screenshotDir: string;
  private connected = false;

  constructor(screenshotDir?: string) {
    this.screenshotDir = screenshotDir || join(process.env.TEMP || "/tmp", "duck-android");
    mkdirSync(this.screenshotDir, { recursive: true });
  }

  // ─── Device Management ──────────────────────────────────────────────────

  async refreshDevices(): Promise<AndroidDevice[]> {
    try {
      const { stdout } = await execAsync("adb devices -l", { timeout: 10000 });
      const lines = stdout.trim().split("\n").slice(1); // Skip header
      this.devices.clear();

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length === 0) continue;

        const [deviceSerial, state, ...kvPairs] = parts;
        const device: AndroidDevice = {
          serial: deviceSerial,
          state: state as AndroidDevice["state"],
        };

        // Parse key:value pairs
        for (const kv of kvPairs) {
          const [k, v] = kv.split(":");
          if (k === "model") device.model = v;
          if (k === "product") device.product = v;
          if (k === "device") device.device = v;
          if (k === "transport") device.transport = v;
        }

        this.devices.set(deviceSerial, device);
      }

      // Auto-select first connected device
      if (!this.serial) {
        const firstConnected = Array.from(this.devices.values()).find(d => d.state === "device");
        if (firstConnected) this.serial = firstConnected.serial;
      }

      this.connected = this.devices.size > 0;
      return Array.from(this.devices.values());
    } catch (e) {
      this.connected = false;
      console.warn("[Android] ADB not available:", (e as Error).message);
      return [];
    }
  }

  getDevices(): AndroidDevice[] {
    return Array.from(this.devices.values());
  }

  getCurrentDevice(): AndroidDevice | null {
    if (!this.serial) return null;
    return this.devices.get(this.serial) || null;
  }

  setDevice(serial: string): boolean {
    if (this.devices.has(serial)) {
      this.serial = serial;
      return true;
    }
    return false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ─── Shell Commands ──────────────────────────────────────────────────────

  /**
   * Execute shell command on Android device
   * Command is sanitized (OpenClaw v2026.4.9 security fix)
   */
  async shell(command: string, timeout = 30000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.serial) throw new Error("No device selected. Call refreshDevices() first.");
    
    // Sanitize command to prevent injection attacks
    const sanitized = sanitizeCommand(command);
    if (sanitized.wasModified || sanitized.threatDetected) {
      logSanitization({
        nodeId: this.serial || 'android',
        field: 'shell',
        originalLength: command.length,
        sanitizedLength: sanitized.sanitized.length,
        threats: sanitized.threats
      });
    }
    
    // Double-quote wrapping with POSIX escaping for Android /system/bin/sh.
    // Single quotes are LITERAL inside double quotes (no escaping needed).
    const escaped = sanitized.sanitized
      .replace(/\\/g, "\\\\")
      .replace(/\$/g, "\\$")
      .replace(/`/g, "\\`")
      .replace(/"/g, '\\"');
    const fullCmd = `adb -s ${this.serial} shell "${escaped}"`;
    try {
      const { stdout, stderr } = await execAsync(fullCmd, { timeout });
      return { stdout, stderr, exitCode: 0 };
    } catch (e: any) {
      return { stdout: "", stderr: e.message, exitCode: e.code || 1 };
    }
  }

  async exec(command: string, args: string[] = [], timeout = 30000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.serial) throw new Error("No device selected. Call refreshDevices() first.");
    const fullCmd = `adb -s ${this.serial} ${command} ${args.join(" ")}`;
    try {
      const { stdout, stderr } = await execAsync(fullCmd, { timeout });
      return { stdout, stderr, exitCode: 0 };
    } catch (e: any) {
      return { stdout: "", stderr: e.message, exitCode: e.code || 1 };
    }
  }

  // ─── App Management ──────────────────────────────────────────────────────

  async launchApp(packageName: string, activity?: string): Promise<boolean> {
    const comp = activity ? `${packageName}/${activity}` : packageName;
    const { exitCode } = await this.shell(`am start -n "${comp}"`);
    return exitCode === 0;
  }

  async killApp(packageName: string): Promise<boolean> {
    const { exitCode } = await this.shell(`am force-stop ${packageName}`);
    return exitCode === 0;
  }

  async getForegroundApp(): Promise<string | null> {
    const { stdout } = await this.shell("dumpsys activity activities | grep mResumedActivity | head -1");
    const match = stdout.match(/([^\s\/]+)\/([^\s\/]+)/);
    return match ? match[1] : null;
  }

  async listApps(): Promise<string[]> {
    const { stdout } = await this.shell("pm list packages");
    return stdout.trim().split("\n").map(line => line.replace("package:", "").trim()).filter(Boolean);
  }

  // ─── Input Interaction ───────────────────────────────────────────────────

  async tap(x: number, y: number): Promise<boolean> {
    const { exitCode } = await this.shell(`input tap ${x} ${y}`);
    return exitCode === 0;
  }

  async tapElement(element: UiElement): Promise<boolean> {
    if (!element.bounds) return false;
    const { left, top, right, bottom } = element.bounds;
    return this.tap((left + right) / 2, (top + bottom) / 2);
  }

  async swipe(x1: number, y1: number, x2: number, y2: number, duration = 300): Promise<boolean> {
    const { exitCode } = await this.shell(`input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
    return exitCode === 0;
  }

  async scroll(direction: "up" | "down" | "left" | "right", distance = 500): Promise<boolean> {
    const w = await this.getScreenSize();
    const cx = Math.floor(w.width / 2);
    const cy = Math.floor(w.height / 2);

    switch (direction) {
      case "up":    return this.swipe(cx, cy - distance, cx, cy + distance);
      case "down":  return this.swipe(cx, cy + distance, cx, cy - distance);
      case "left":  return this.swipe(cx - distance, cy, cx + distance, cy);
      case "right": return this.swipe(cx + distance, cy, cx - distance, cy);
    }
  }

  async typeText(text: string): Promise<boolean> {
    // Escape special characters
    const escaped = text.replace(/ /g, "%s").replace(/\n/g, "%n");
    const { exitCode } = await this.shell(`input text "${escaped}"`);
    return exitCode === 0;
  }

  async pressKey(keyCode: string): Promise<boolean> {
    const { exitCode } = await this.shell(`input keyevent ${keyCode}`);
    return exitCode === 0;
  }

  async pressEnter(): Promise<boolean> { return this.pressKey("66"); }
  async pressBack(): Promise<boolean> { return this.pressKey("4"); }
  async pressHome(): Promise<boolean> { return this.pressKey("3"); }
  async pressRecent(): Promise<boolean> { return this.pressKey("187"); }

  async clearText(): Promise<boolean> {
    const { exitCode } = await this.shell("input keyevent KEYCODE_MOVE_END");
    // Select all and delete
    await this.shell("input keyevent 67".repeat(50)); // Backspace x50
    return exitCode === 0;
  }

  // ─── Screen & UI Dump ────────────────────────────────────────────────────

  async getScreenSize(): Promise<{ width: number; height: number }> {
    const { stdout } = await this.shell("wm size");
    const match = stdout.match(/(\d+)x(\d+)/);
    if (match) {
      return { width: parseInt(match[1]), height: parseInt(match[2]) };
    }
    return { width: 1080, height: 1920 }; // Default
  }

  async captureScreen(filename?: string): Promise<ScreenCapture> {
    if (!this.serial) throw new Error("No device selected");

    const ts = filename || `screenshot-${Date.now()}.png`;
    const localPath = join(this.screenshotDir, ts);
    const remotePath = `/sdcard/${ts}`;

    // Wake screen if off (screencap produces tiny/blank file when screen is off)
    await this.shell('input keyevent KEYCODE_WAKEUP');
    await new Promise(r => setTimeout(r, 500));

    // Capture on device
    await this.shell(`screencap -p "${remotePath}"`);

    // Pull to local
    await execAsync(`adb -s ${this.serial} pull "${remotePath}" "${localPath}"`, { timeout: 15000 });

    // Clean up remote
    await this.shell(`rm "${remotePath}"`);

    // Get file stats
    let width = 0;
    let height = 0;
    try {
      const fs = await import('fs');
      const stat = fs.statSync(localPath);
      if (stat.size < 1000) {
        // Screenshot is too small — likely corrupted (e.g. screen off or permission issue)
        console.warn(`[android] Screenshot only ${stat.size} bytes — screen may be off or permission denied`);
      }
      // Try to read PNG dimensions from header (bytes 16-24 = width, bytes 24-32 = height)
      try {
        const buffer = Buffer.alloc(32);
        const fd = require('fs').openSync(localPath, 'r');
        require('fs').readSync(fd, buffer, 0, 32, 16);
        require('fs').closeSync(fd);
        width = buffer.readUInt32BE(0);
        height = buffer.readUInt32BE(4);
      } catch {
        // Fallback: use adb shell to get real resolution
        try {
          const { stdout } = await this.shell('dumpsys display | grep mBaseDisplayInfo');
          const match = stdout.match(/width=(\d+).*height=(\d+)/);
          if (match) { width = parseInt(match[1]); height = parseInt(match[2]); }
        } catch {}
      }
    } catch (e) {
      console.warn(`[android] Could not get screenshot dimensions: ${e}`);
    }

    return {
      path: localPath,
      width,
      height,
      timestamp: new Date().toISOString(),
    };
  }

  async dumpUiXml(filename = "view.xml"): Promise<string> {
    if (!this.serial) throw new Error("No device selected");

    const remotePath = `/sdcard/${filename}`;
    const localPath = join(this.screenshotDir, filename);

    await this.shell(`uiautomator dump "${remotePath}"`);
    await execAsync(`adb -s ${this.serial} pull "${remotePath}" "${localPath}"`, { timeout: 15000 });
    await this.shell(`rm "${remotePath}"`);

    try {
      return readFileSync(localPath, "utf8");
    } catch {
      return "";
    }
  }

  // Parse UI XML into elements (DroidClaw-style)
  parseUiXml(xml: string): UiElement[] {
    const elements: UiElement[] = [];
    const nodeRegex = /<node[^>]*>/g;
    let match;

    while ((match = nodeRegex.exec(xml)) !== null) {
      const nodeStr = match[0];
      const el: UiElement = {};

      const attr = (name: string) => {
        const m = nodeStr.match(new RegExp(`${name}="([^"]*)"`));
        return m ? m[1] : undefined;
      };

      el.text = attr("text");
      el.content_desc = attr("content-desc");
      el.resource_id = attr("resource-id");
      el.class = attr("class");
      el.clickable = attr("clickable") === "true";
      el.long_clickable = attr("long-clickable") === "true";
      el.enabled = attr("enabled") === "true";
      el.focused = attr("focused") === "true";

      const boundsStr = attr("bounds");
      if (boundsStr) {
        const coords = boundsStr.replace(/[\[\]]/g, "").split(",").map(Number);
        if (coords.length === 4) {
          el.bounds = { left: coords[0], top: coords[1], right: coords[2], bottom: coords[3] };
        }
      }

      elements.push(el);
    }

    return elements;
  }

  // Find element by text, content description, or resource ID
  findElement(elements: UiElement[], query: string): UiElement | null {
    const q = query.toLowerCase();
    return elements.find(el =>
      (el.text?.toLowerCase().includes(q)) ||
      (el.content_desc?.toLowerCase().includes(q)) ||
      (el.resource_id?.toLowerCase().includes(q))
    ) || null;
  }

  // Find all elements matching a query
  findElements(elements: UiElement[], query: string): UiElement[] {
    const q = query.toLowerCase();
    return elements.filter(el =>
      (el.text?.toLowerCase().includes(q)) ||
      (el.content_desc?.toLowerCase().includes(q)) ||
      (el.resource_id?.toLowerCase().includes(q))
    );
  }

  // ─── Clipboard ──────────────────────────────────────────────────────────

  async getClipboard(): Promise<string> {
    const { stdout } = await this.shell("am broadcast -a clipper.get");
    return stdout.trim();
  }

  async setClipboard(text: string): Promise<boolean> {
    const escaped = text.replace(/"/g, '\\"').replace(/\n/g, "\\n");
    const { exitCode } = await this.shell(`am broadcast -a clipper.set -e text "${escaped}"`);
    return exitCode === 0;
  }

  // ─── Notifications ───────────────────────────────────────────────────────

  async getNotifications(): Promise<{app: string, text: string}[]> {
    const { stdout } = await this.shell("dumpsys notification --noredact | grep -E 'tickerText|pkg=' | head -60");
    const lines = stdout.trim().split("\n").filter(l => l.includes('tickerText=') || l.includes('pkg='));
    const notifications: {app: string, text: string}[] = [];
    let currentApp = 'unknown';
    for (const line of lines) {
      if (line.includes('pkg=')) {
        const match = line.match(/pkg=(\S+)/);
        if (match) {
          const pkg = match[1];
          currentApp = pkg.split('.').pop() || pkg;
        }
      } else if (line.includes('tickerText=')) {
        const text = line.split('tickerText=')[1]?.trim();
        if (text && text !== 'null') {
          notifications.push({ app: currentApp, text });
        }
      }
    }
    return notifications.slice(0, 10);
  }

  // ─── File Operations ─────────────────────────────────────────────────────

  async pushFile(localPath: string, remotePath: string): Promise<boolean> {
    if (!this.serial) return false;
    try {
      await execAsync(`adb -s ${this.serial} push "${localPath}" "${remotePath}"`, { timeout: 60000 });
      return true;
    } catch {
      return false;
    }
  }

  async pullFile(remotePath: string, localPath: string): Promise<boolean> {
    if (!this.serial) return false;
    try {
      await execAsync(`adb -s ${this.serial} pull "${remotePath}" "${localPath}"`, { timeout: 60000 });
      return true;
    } catch {
      return false;
    }
  }

  // ─── Port Forwarding ──────────────────────────────────────────────────────

  async forward(local: string, remote: string): Promise<boolean> {
    if (!this.serial) return false;
    try {
      await execAsync(`adb -s ${this.serial} forward "${local}" "${remote}"`, { timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }

  async removeForward(local: string): Promise<boolean> {
    if (!this.serial) return false;
    try {
      await execAsync(`adb -s ${this.serial} forward --remove "${local}"`, { timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }

  // ─── System Info ─────────────────────────────────────────────────────────

  async getBatteryLevel(): Promise<number> {
    const { stdout } = await this.shell("dumpsys battery | grep level");
    const match = stdout.match(/level:\s*(\d+)/);
    return match ? parseInt(match[1]) : -1;
  }

  async isScreenOn(): Promise<boolean> {
    const { stdout } = await this.shell("dumpsys power | grep 'Display Power'");
    return stdout.includes("ON") || stdout.includes("POWERED");
  }

  async wakeDevice(): Promise<boolean> {
    await this.shell("input keyevent 82"); // Unlock
    return true;
  }

  // ─── High-Level DroidClaw-Style Actions ─────────────────────────────────

  /**
   * DroidClaw-style: find element and tap it
   */
  async findAndTap(query: string): Promise<boolean> {
    const xml = await this.dumpUiXml();
    const elements = this.parseUiXml(xml);
    const el = this.findElement(elements, query);
    if (!el) return false;
    return this.tapElement(el);
  }

  /**
   * DroidClaw-style: wait for content to appear
   */
  async waitForContent(query: string, timeout = 10000): Promise<UiElement | null> {
    const interval = 500;
    const maxAttempts = Math.floor(timeout / interval);

    for (let i = 0; i < maxAttempts; i++) {
      const xml = await this.dumpUiXml();
      const elements = this.parseUiXml(xml);
      const el = this.findElement(elements, query);
      if (el) return el;
      await new Promise(r => setTimeout(r, interval));
    }

    return null;
  }

  /**
   * DroidClaw-style: submit a message (find send button and tap)
   */
  async submitMessage(text: string): Promise<boolean> {
    // Type the text
    if (!await this.typeText(text)) return false;

    // Find and tap send button
    return this.findAndTap("send");
  }

  /**
   * DroidClaw-style: read screen and return all visible text
   */
  async readScreen(): Promise<string> {
    const xml = await this.dumpUiXml();
    const elements = this.parseUiXml(xml);
    return elements
      .filter(el => el.text || el.content_desc)
      .map(el => el.text || el.content_desc)
      .filter(Boolean)
      .join("\n");
  }

  // ─── NEW: DroidClaw Enhanced Methods ──────────────────────────────────

  async getProperty(serial: string | null | undefined, prop: string): Promise<string> {
    const dev = serial || this.serial;
    if (!dev) return "";
    try {
      const { stdout } = await execAsync(`adb -s ${dev} shell getprop ${prop}`, { timeout: 5000 });
      return stdout.trim();
    } catch { return ""; }
  }

  async getDeviceState(serial?: string): Promise<string> {
    const dev = serial || this.serial;
    if (!dev) return "no device";
    try {
      const { stdout } = await execAsync(`adb -s ${dev} get-state`, { timeout: 5000 });
      return stdout.trim() || "unknown";
    } catch { return "offline"; }
  }

  async getDeviceIP(serial?: string | null): Promise<string | null> {
    const dev = serial || this.serial;
    if (!dev) return null;
    try {
      const { stdout } = await execAsync(
        `adb -s ${dev} shell "ip route | grep wlan0 | awk '{print \\\$3}' | head -1"`,
        { timeout: 5000 }
      );
      return stdout.trim() || null;
    } catch { return null; }
  }

  async getDeviceInfo(serial?: string | null): Promise<Record<string, unknown>> {
    const dev = serial || this.serial;
    if (!dev) return { error: "No device selected" };
    const [model, manufacturer, android, sdk, battery, density, state] = await Promise.all([
      this.getProperty(dev, "ro.product.model"),
      this.getProperty(dev, "ro.product.manufacturer"),
      this.getProperty(dev, "ro.build.version.release"),
      this.getProperty(dev, "ro.build.version.sdk"),
      this.getBatteryLevel(),
      this.getProperty(dev, "ro.sf.lcd_density"),
      this.getDeviceState(dev),
    ]);
    const screen = await this.getScreenSize().catch(() => ({ width: 0, height: 0 }));
    const ip = await this.getDeviceIP(dev).catch(() => null);
    return { serial: dev, model, manufacturer, android, sdk, battery, density, state, screen, ip };
  }

  async installApk(apkPath: string, serial?: string | null): Promise<string> {
    const dev = serial || this.serial;
    if (!dev) return "Error: No device selected";
    const { existsSync } = await import("fs");
    if (!existsSync(apkPath)) return `Error: APK not found: ${apkPath}`;
    try {
      const { stdout, stderr } = await execAsync(`adb -s ${dev} install -r "${apkPath}"`, { timeout: 120000 });
      if (stderr && stderr.includes("Failure")) return `Install failed: ${stderr}`;
      return stdout.trim() || "Installed successfully";
    } catch (e: any) { return `Install failed: ${e.message}`; }
  }

  async uninstallPackage(packageName: string, serial?: string | null): Promise<string> {
    const dev = serial || this.serial;
    if (!dev) return "Error: No device selected";
    try {
      const { stdout } = await execAsync(`adb -s ${dev} uninstall ${packageName}`, { timeout: 30000 });
      return stdout.trim();
    } catch (e: any) { return `Uninstall failed: ${e.message}`; }
  }

  async launchAppExplicit(packageName: string, activity: string, serial?: string | null): Promise<boolean> {
    const dev = serial || this.serial;
    if (!dev) return false;
    const comp = `${packageName}/${activity}`;
    const { exitCode } = await this.shell(`am start -n "${comp}"`);
    return exitCode === 0;
  }

  async pressPower(serial?: string | null): Promise<boolean> {
    const dev = serial || this.serial;
    if (!dev) return false;
    const { exitCode } = await this.shell(`input keyevent 26`);
    return exitCode === 0;
  }

  async pressVolumeUp(serial?: string | null): Promise<boolean> {
    const dev = serial || this.serial;
    if (!dev) return false;
    const { exitCode } = await this.shell(`input keyevent 24`);
    return exitCode === 0;
  }

  async pressVolumeDown(serial?: string | null): Promise<boolean> {
    const dev = serial || this.serial;
    if (!dev) return false;
    const { exitCode } = await this.shell(`input keyevent 25`);
    return exitCode === 0;
  }

  async reboot(serial?: string | null): Promise<string> {
    const dev = serial || this.serial;
    if (!dev) return "Error: No device selected";
    try { await execAsync(`adb -s ${dev} reboot`, { timeout: 5000 }); return "Rebooting..."; }
    catch (e: any) { return `Reboot failed: ${e.message}`; }
  }

  async termuxCommand(command: string, serial?: string | null): Promise<string> {
    const dev = serial || this.serial;
    if (!dev) return "Error: No device selected";
    const { stdout } = await this.shell(command);
    return stdout || "(no output)";
  }

  async screenshotAnalyze(serial?: string | null): Promise<Record<string, unknown>> {
    const dev = serial || this.serial;
    if (!dev) throw new Error("No device selected");
    const capture = await this.captureScreen();
    const xml = await this.dumpUiXml();
    const elements = this.parseUiXml(xml);
    const { readFileSync, statSync } = await import("fs");
    let screenshotBase64 = "";
    let sizeKb = 0;
    try { screenshotBase64 = readFileSync(capture.path).toString("base64"); sizeKb = Math.round(statSync(capture.path).size / 1024); } catch {}
    return {
      screenshotPath: capture.path,
      screenshotBase64,
      screenshotSizeKb: sizeKb,
      uiXmlLength: xml.length,
      uiElementCount: elements.length,
      uiElements: elements.slice(0, 50),
      foregroundApp: await this.getForegroundApp(),
      screen: `${capture.width}x${capture.height}`,
      battery: await this.getBatteryLevel(),
      device: dev,
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── Singleton for convenience ─────────────────────────────────────────────

let androidInstance: AndroidTools | null = null;

export function getAndroidTools(): AndroidTools {
  if (!androidInstance) {
    androidInstance = new AndroidTools();
  }
  return androidInstance;
}

export default AndroidTools;
