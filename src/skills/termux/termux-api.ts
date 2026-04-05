/**
 * Termux API Integration for duck-cli
 * 
 * Provides tools to control Android phone via Termux from duck-cli.
 * Uses ADB + Termux:API broadcasts for phone control.
 * 
 * Phone: ZT4227P8NK (Moto G Play 2026)
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TermuxConfig {
  phoneSerial: string;
  termuxApiPackage: string;
  termuxPackage: string;
  termuxTaskerPackage: string;
  termuxBootPackage: string;
}

export const DEFAULT_CONFIG: TermuxConfig = {
  phoneSerial: 'ZT4227P8NK',
  termuxApiPackage: 'com.termux.api',
  termuxPackage: 'com.termux',
  termuxTaskerPackage: 'com.termux.tasker',
  termuxBootPackage: 'com.termux.boot',
};

export interface TermuxResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

export interface PhoneInfo {
  serial: string;
  model: string;
  androidVersion: string;
  termuxInstalled: boolean;
  termuxApiInstalled: boolean;
  termuxTaskerInstalled: boolean;
  termuxBootInstalled: boolean;
}

// Broadcast receiver for Termux:API
const TERMUX_API_RECEIVER = 'com.termux.api/.TermuxAPIReceiver';
const TERMUX_API_ACTION = 'com.termux.api.ACTION_RUN_COMMAND';

// RUN_COMMAND intent (requires allow-external-apps)
const TERMUX_RUN_COMMAND_SERVICE = 'com.termux/com.termux.app.RunCommandService';
const TERMUX_RUN_COMMAND_ACTION = 'com.termux.RUN_COMMAND';

export class TermuxAPI {
  private config: TermuxConfig;
  private adbPath: string = 'adb';

  constructor(config: Partial<TermuxConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set ADB serial for multi-device setups
   */
  setDevice(serial: string): void {
    this.config.phoneSerial = serial;
  }

  /**
   * Run a command via Termux:API broadcast
   */
  async runCommand(command: string, background = false): Promise<TermuxResult> {
    const extra = background ? 'true' : 'false';
    const adbCmd = [
      'adb', '-s', this.config.phoneSerial, 'shell',
      'am', 'broadcast',
      '-a', TERMUX_API_ACTION,
      '-e', 'com.termux.api.EXTRA_COMMAND', command,
      '-e', 'com.termux.api.EXTRA_BACKGROUND', extra,
      TERMUX_API_RECEIVER
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(adbCmd, { timeout: 30000 });
      return {
        success: stderr.includes('completed'),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: '',
        stderr: error.message || String(error),
      };
    }
  }

  /**
   * Run via Termux RUN_COMMAND intent (requires allow-external-apps)
   */
  async runCommandIntent(
    commandPath: string,
    args: string[] = [],
    workdir = '/data/data/com.termux/files/home',
    background = true
  ): Promise<TermuxResult> {
    const argsStr = args.join(',');
    const adbCmd = [
      'adb', '-s', this.config.phoneSerial, 'shell',
      'am', 'startservice',
      '--user', '0',
      '-n', TERMUX_RUN_COMMAND_SERVICE,
      '-a', TERMUX_RUN_COMMAND_ACTION,
      '--es', 'com.termux.RUN_COMMAND_PATH', commandPath,
      '--esa', 'com.termux.RUN_COMMAND_ARGUMENTS', argsStr,
      '--es', 'com.termux.RUN_COMMAND_WORKDIR', workdir,
      '--ez', 'com.termux.RUN_COMMAND_BACKGROUND', background ? 'true' : 'false'
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(adbCmd, { timeout: 30000 });
      return {
        success: stdout.includes('Starting service'),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: '',
        stderr: error.message || String(error),
      };
    }
  }

  /**
   * Run via Termux Tasker plugin
   */
  async runViaTasker(command: string): Promise<TermuxResult> {
    const adbCmd = [
      'adb', '-s', this.config.phoneSerial, 'shell',
      'am', 'broadcast',
      '-a', 'com.termux.tasker.EXECUTE',
      '-e', 'com.termux.tasker.EXTRA_COMMAND', command,
      'com.termux.tasker/.PluginReceiver'
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(adbCmd, { timeout: 30000 });
      return {
        success: stderr.includes('completed'),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: '',
        stderr: error.message || String(error),
      };
    }
  }

  /**
   * Push a script to sdcard and prepare for execution
   */
  async pushScript(scriptPath: string, sdcardPath: string): Promise<boolean> {
    try {
      const cmd = `adb -s ${this.config.phoneSerial} push "${scriptPath}" "${sdcardPath}"`;
      await execAsync(cmd);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write a script to sdcard via echo
   */
  async writeScriptToSdcard(content: string, sdcardPath: string): Promise<boolean> {
    const escaped = content.replace(/"/g, '\\"').replace(/\n/g, ' && ');
    try {
      const cmd = `adb -s ${this.config.phoneSerial} shell "echo \\"${escaped}\\" > ${sdcardPath}"`;
      await execAsync(cmd);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read a file from sdcard
   */
  async readFile(sdcardPath: string): Promise<string> {
    try {
      const cmd = `adb -s ${this.config.phoneSerial} shell cat "${sdcardPath}"`;
      const { stdout } = await execAsync(cmd);
      return stdout;
    } catch {
      return '';
    }
  }

  /**
   * Check if Termux packages are installed
   */
  async checkInstalledPackages(): Promise<string[]> {
    try {
      const cmd = `adb -s ${this.config.phoneSerial} shell pm list packages | grep termux`;
      const { stdout } = await execAsync(cmd);
      const packages = stdout.match(/package:(\S+)/g) || [];
      return packages.map(p => p.replace('package:', ''));
    } catch {
      return [];
    }
  }

  /**
   * Get phone info
   */
  async getPhoneInfo(): Promise<PhoneInfo> {
    const devices: PhoneInfo = {
      serial: this.config.phoneSerial,
      model: '',
      androidVersion: '',
      termuxInstalled: false,
      termuxApiInstalled: false,
      termuxTaskerInstalled: false,
      termuxBootInstalled: false,
    };

    try {
      const modelCmd = `adb -s ${this.config.phoneSerial} shell getprop ro.product.model`;
      const { stdout: model } = await execAsync(modelCmd);
      devices.model = model.trim();

      const versionCmd = `adb -s ${this.config.phoneSerial} shell getprop ro.build.version.release`;
      const { stdout: version } = await execAsync(versionCmd);
      devices.androidVersion = version.trim();

      const packages = await this.checkInstalledPackages();
      devices.termuxInstalled = packages.includes('com.termux');
      devices.termuxApiInstalled = packages.includes('com.termux.api');
      devices.termuxTaskerInstalled = packages.includes('com.termux.tasker');
      devices.termuxBootInstalled = packages.includes('com.termux.boot');
    } catch {
      // Ignore errors
    }

    return devices;
  }
}

// Singleton instance
let termuxInstance: TermuxAPI | null = null;

export function getTermuxAPI(config?: Partial<TermuxConfig>): TermuxAPI {
  if (!termuxInstance) {
    termuxInstance = new TermuxAPI(config);
  }
  return termuxInstance;
}

// CLI tools registration
export const termuxTools = [
  {
    name: 'termux_status',
    description: 'Check Termux and phone status',
    execute: async () => {
      const api = getTermuxAPI();
      const info = await api.getPhoneInfo();
      return JSON.stringify(info, null, 2);
    },
  },
  {
    name: 'termux_exec',
    description: 'Execute command via Termux:API',
    execute: async (command: string) => {
      const api = getTermuxAPI();
      return await api.runCommand(command);
    },
  },
  {
    name: 'termux_push_script',
    description: 'Push script to phone sdcard',
    execute: async (scriptPath: string, sdcardPath: string) => {
      const api = getTermuxAPI();
      const result = await api.pushScript(scriptPath, sdcardPath);
      return result ? 'Script pushed successfully' : 'Failed to push script';
    },
  },
];

export default TermuxAPI;
