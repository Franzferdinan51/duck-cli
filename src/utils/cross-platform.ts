/**
 * 🦆 Duck Agent - Cross-Platform Utilities
 * Handles macOS, Linux, and Windows differences
 */

import os from 'os';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export type Platform = 'darwin' | 'linux' | 'windows';

/**
 * Get current platform
 */
export function platform(): Platform {
  const p = os.platform();
  if (p === 'darwin') return 'darwin';
  if (p === 'win32') return 'windows';
  return 'linux';
}

/**
 * Check platform helpers
 */
export const isMac = () => platform() === 'darwin';
export const isLinux = () => platform() === 'linux';
export const isWindows = () => platform() === 'windows';

/**
 * Get home directory (works on all platforms)
 */
export function homeDir(): string {
  if (isWindows()) {
    return process.env.USERPROFILE || process.env.HOMEPATH || os.homedir();
  }
  return process.env.HOME || os.homedir();
}

/**
 * Get temp directory (works on all platforms)
 */
export function tempDir(): string {
  if (isWindows()) {
    return process.env.TEMP || process.env.TMP || os.tmpdir();
  }
  return os.tmpdir();
}

/**
 * Get desktop directory (works on all platforms)
 */
export function desktopDir(): string {
  if (isWindows()) {
    return path.join(homeDir(), 'Desktop');
  } else if (isMac()) {
    return path.join(homeDir(), 'Desktop');
  } else {
    // Linux - try common locations
    const xdg = process.env.XDG_DESKTOP_DIR;
    if (xdg && fs.existsSync(xdg)) return xdg;
    const fallback = path.join(homeDir(), 'Desktop');
    if (fs.existsSync(fallback)) return fallback;
    return homeDir(); // Fallback to home
  }
}

/**
 * Expand ~ to home directory
 */
export function expandPath(p: string): string {
  if (p.startsWith('~')) {
    return path.join(homeDir(), p.slice(1));
  }
  return p;
}

/**
 * Create directory recursively (cross-platform)
 */
export function mkdirp(dirPath: string): void {
  const fullPath = expandPath(dirPath);
  try {
    fs.mkdirSync(fullPath, { recursive: true });
  } catch (e: any) {
    // On Windows, sometimes need to try differently
    if (e.code !== 'EEXIST') {
      throw e;
    }
  }
}

/**
 * Get default shell (cross-platform)
 */
export function defaultShell(): string {
  if (isWindows()) {
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

/**
 * Get shell args for spawning (cross-platform)
 */
export function shellArgs(): { shell: boolean; executable?: string } {
  if (isWindows()) {
    return { shell: true };
  }
  return { shell: true, executable: '/bin/bash' };
}

/**
 * Get audio player command (cross-platform)
 */
export function audioPlayer(): string[] {
  if (isMac()) {
    return ['afplay'];
  } else if (isWindows()) {
    return ['powershell.exe', '-c', 'Start-Process', '-Wait'];
  } else {
    // Linux - try several
    const candidates = ['paplay', 'aplay', 'mpg123', 'play'];
    for (const cmd of candidates) {
      try {
        execSync(`which ${cmd}`, { stdio: 'ignore' });
        return [cmd];
      } catch {
        // Not found, try next
      }
    }
    return ['paplay']; // Default fallback
  }
}

/**
 * Play audio file (cross-platform)
 */
export function playAudio(filePath: string): void {
  const fullPath = expandPath(filePath);
  if (isMac()) {
    execSync(`afplay "${fullPath}"`, { stdio: 'ignore' });
  } else if (isWindows()) {
    // Windows: use PowerShell to play
    execSync(`powershell.exe -c "Add-Type -AssemblyName PresentationCore; [MediaPlayer]::new().Open('${fullPath.replace(/'/g, "''")}'); [MediaPlayer]::new().Play();"`, { stdio: 'ignore' });
  } else {
    // Linux
    execSync(`paplay "${fullPath}"`, { stdio: 'ignore' });
  }
}

/**
 * Get screenshot tool command (cross-platform)
 */
export function screenshotCommand(): string | null {
  if (isMac()) {
    // macOS has built-in screenshot
    return 'screencapture';
  } else if (isWindows()) {
    // Windows 10/11 has built-in
    return 'powershell.exe -c "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen].Capture().Save(';
  } else {
    // Linux - try various tools
    const candidates = ['gnome-screenshot', 'scrot', 'spectacle', 'ksnapshot', 'import'];
    for (const cmd of candidates) {
      try {
        execSync(`which ${cmd}`, { stdio: 'ignore' });
        return cmd;
      } catch {
        // Not found
      }
    }
    return null;
  }
}

/**
 * Take screenshot and return path (cross-platform)
 */
export function takeScreenshot(outputPath?: string): string {
  const ext = '.png';
  const defaultName = `screenshot-${Date.now()}${ext}`;
  const dest = outputPath || path.join(tempDir(), defaultName);
  
  if (isMac()) {
    execSync(`screencapture "${dest}"`, { stdio: 'ignore' });
  } else if (isWindows()) {
    execSync(`powershell.exe -c "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Capture().Save('${dest.replace(/'/g, "''")}')"`, { stdio: 'ignore' });
  } else {
    // Linux
    const tool = screenshotCommand();
    if (tool === 'scrot') {
      execSync(`scrot "${dest}"`, { stdio: 'ignore' });
    } else if (tool === 'gnome-screenshot') {
      execSync(`gnome-screenshot -f "${dest}"`, { stdio: 'ignore' });
    } else {
      throw new Error('No screenshot tool found. Install scrot, gnome-screenshot, or spectacle.');
    }
  }
  
  return dest;
}

/**
 * Open URL in browser (cross-platform)
 */
export function openUrl(url: string): void {
  const { spawn } = require('child_process');
  
  if (isMac()) {
    spawn('open', [url], { detached: true, stdio: 'ignore' });
  } else if (isWindows()) {
    spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' });
  } else {
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
  }
}

/**
 * Open file in default application (cross-platform)
 */
export function openFile(filePath: string): void {
  const fullPath = expandPath(filePath);
  const { spawn } = require('child_process');
  
  if (isMac()) {
    spawn('open', [fullPath], { detached: true, stdio: 'ignore' });
  } else if (isWindows()) {
    spawn('cmd.exe', ['/c', 'start', '', fullPath], { detached: true, stdio: 'ignore' });
  } else {
    spawn('xdg-open', [fullPath], { detached: true, stdio: 'ignore' });
  }
}

/**
 * Check if file exists (cross-platform path)
 */
export function pathExists(p: string): boolean {
  try {
    return fs.existsSync(expandPath(p));
  } catch {
    return false;
  }
}

export default {
  platform, isMac, isLinux, isWindows,
  homeDir, tempDir, desktopDir,
  expandPath, mkdirp,
  defaultShell, shellArgs,
  audioPlayer, playAudio,
  screenshotCommand, takeScreenshot,
  openUrl, openFile,
  pathExists
};
