/**
 * 🦆 Duck Agent - Docker Sandbox
 * Run dangerous tools in isolated containers
 * Based on NeMoClaw's sandbox concept
 */

import { spawn, execSync, exec } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { randomUUID } from 'crypto';

export interface SandboxConfig {
  image?: string;           // Docker image to use
  network?: 'none' | 'bridge' | 'host';  // Network isolation
  readOnly?: boolean;        // Read-only filesystem
  maxMemory?: string;        // e.g., '512m'
  maxCpu?: string;          // e.g., '0.5'
  timeout?: number;          // Max execution time in ms
  user?: string;             // Run as non-root user
  volumes?: { host: string; container: string }[];
}

export interface SandboxResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  containerId?: string;
}

export class DockerSandbox {
  private config: Required<SandboxConfig>;
  private containerId: string | null = null;

  constructor(config: SandboxConfig = {}) {
    this.config = {
      image: config.image ?? 'ubuntu:22.04',
      network: config.network ?? 'none',
      readOnly: config.readOnly ?? true,
      maxMemory: config.maxMemory ?? '512m',
      maxCpu: config.maxCpu ?? '0.5',
      timeout: config.timeout ?? 30000,
      user: config.user ?? 'nobody',
      volumes: config.volumes ?? [],
    };
  }

  /**
   * Check if Docker is available
   */
  static isAvailable(): boolean {
    try {
      execSync('docker info', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run a command in a sandboxed container
   */
  async run(command: string): Promise<SandboxResult> {
    const startTime = Date.now();
    const containerName = `duck-sandbox-${randomUUID().slice(0, 8)}`;
    
    // Build docker run arguments
    const args = [
      'docker', 'run',
      '--rm',                          // Auto-remove on exit
      '--name', containerName,
      '--network', this.config.network,
      '--memory', this.config.maxMemory,
      '--cpus', this.config.maxCpu,
      '--read-only', this.config.readOnly,
      '--user', this.config.user,
      '--pids-limit', '50',
      '--ulimit', 'nproc=50:50',
      '--ulimit', 'nofile=100:100',
      '--cap-drop', 'ALL',             // Drop all capabilities
      '--security-opt', 'no-new-privileges',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
    ];

    // Add volumes
    for (const vol of this.config.volumes) {
      args.push('-v', `${vol.host}:${vol.container}`);
    }

    // Add image
    args.push(this.config.image);

    // Add command
    args.push('sh', '-c', command);

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let proc: any;

      try {
        const cmd = args[0] || 'docker';
        const cmdArgs = args.slice(1);
        proc = (spawn as any)(cmd, cmdArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
        } as any);

        proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
        proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

        const timeout = setTimeout(() => {
          proc.kill('SIGKILL');
          resolve({
            success: false,
            stdout,
            stderr: stderr + '\n[TIMEOUT] Execution timed out',
            exitCode: 124,
            duration: Date.now() - startTime,
          });
        }, this.config.timeout);

        proc.on('close', (code: number) => {
          clearTimeout(timeout);
          resolve({
            success: code === 0,
            stdout,
            stderr,
            exitCode: code ?? -1,
            duration: Date.now() - startTime,
          });
        });

        proc.on('error', (err: Error) => {
          clearTimeout(timeout);
          resolve({
            success: false,
            stdout,
            stderr: err.message,
            exitCode: -1,
            duration: Date.now() - startTime,
          });
        });
      } catch (err: any) {
        resolve({
          success: false,
          stdout,
          stderr: err.message,
          exitCode: -1,
          duration: Date.now() - startTime,
        });
      }
    });
  }

  /**
   * Run a Node.js script in a sandboxed container
   */
  async runNode(scriptPath: string): Promise<SandboxResult> {
    return this.run(`node ${scriptPath}`);
  }

  /**
   * Run a Python script in a sandboxed container
   */
  async runPython(scriptPath: string): Promise<SandboxResult> {
    return this.run(`python3 ${scriptPath}`);
  }

  /**
   * Run a dangerous shell command in sandbox
   */
  async runShell(command: string): Promise<SandboxResult> {
    return this.run(command);
  }
}

/**
 * Quick sandboxed execution helper
 */
export async function sandboxExec(
  command: string,
  options: Partial<SandboxConfig> = {}
): Promise<SandboxResult> {
  const sandbox = new DockerSandbox(options);
  return sandbox.run(command);
}

/**
 * Sandbox the dangerous tool execution
 */
export async function sandboxTool(
  toolName: string,
  command: string,
  dangerousLevel: 'low' | 'medium' | 'high' | 'critical' = 'high'
): Promise<SandboxResult> {
  if (!DockerSandbox.isAvailable()) {
    // Fallback: run without sandbox (warn)
    console.warn(`[Sandbox] Docker not available, running without isolation`);
    return {
      success: false,
      stdout: '',
      stderr: 'Docker not available',
      exitCode: -1,
      duration: 0,
    };
  }

  const configs: Record<string, Partial<SandboxConfig>> = {
    critical: { maxMemory: '256m', maxCpu: '0.25', timeout: 10000, network: 'none' },
    high: { maxMemory: '512m', maxCpu: '0.5', timeout: 30000, network: 'bridge' },
    medium: { maxMemory: '1g', maxCpu: '1', timeout: 60000, network: 'bridge' },
    low: { maxMemory: '2g', maxCpu: '2', timeout: 120000, network: 'bridge' },
  };

  return sandboxExec(command, configs[dangerousLevel]);
}

export default DockerSandbox;
