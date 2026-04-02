/**
 * 🦆 Duck Agent - Platform Detection
 * Cross-platform utilities for macOS, Linux, Windows
 */

import os from 'os';

export type Platform = 'darwin' | 'linux' | 'windows';

/**
 * Get the current platform
 */
export function osType(): Platform {
  const platform = os.platform();
  if (platform === 'darwin') return 'darwin';
  if (platform === 'win32') return 'windows';
  return 'linux';
}

/**
 * Get the home directory
 */
export function homeDir(): string {
  return os.homedir();
}

/**
 * Get the temp directory
 */
export function tempDir(): string {
  return os.tmpdir();
}

/**
 * Check if running on macOS
 */
export function isMac(): boolean {
  return osType() === 'darwin';
}

/**
 * Check if running on Linux
 */
export function isLinux(): boolean {
  return osType() === 'linux';
}

/**
 * Check if running on Windows
 */
export function isWindows(): boolean {
  return osType() === 'windows';
}

/**
 * Get the default shell path
 */
export function defaultShell(): string {
  const platform = osType();
  if (platform === 'windows') return 'powershell.exe';
  return process.env.SHELL ?? '/bin/bash';
}

/**
 * Get the browser command for opening URLs
 */
export function openCommand(): string[] {
  const platform = osType();
  if (platform === 'darwin') return ['open'];
  if (platform === 'windows') return ['cmd', '/c', 'start'];
  return ['xdg-open'];
}

/**
 * Open a URL in the default browser
 */
export function openUrl(url: string): void {
  const { spawn } = require('child_process');
  spawn(openCommand()[0], [...openCommand().slice(1), url], {
    detached: true,
    stdio: 'ignore',
  });
}

/**
 * Get system memory info
 */
export function memInfo(): { total: number; free: number; used: number } {
  const total = os.totalmem();
  const free = os.freemem();
  return { total, free, used: total - free };
}

export default { osType, homeDir, tempDir, isMac, isLinux, isWindows, defaultShell, openCommand, openUrl, memInfo };
