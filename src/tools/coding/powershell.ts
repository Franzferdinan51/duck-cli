/**
 * 🦆 Duck Agent - PowerShell Tool
 * Windows PowerShell execution
 */

import { execSync, exec } from 'child_process';

export interface PowerShellResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode: number;
}

/**
 * Execute PowerShell command
 */
export async function powershell(command: string, options?: { cwd?: string; timeout?: number }): Promise<PowerShellResult> {
  try {
    const output = execSync(command, {
      shell: 'powershell.exe',
      cwd: options?.cwd || process.cwd(),
      encoding: 'utf-8',
      timeout: options?.timeout || 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    
    return {
      success: true,
      output: output.toString(),
      exitCode: 0,
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout?.toString(),
      error: error.stderr?.toString() || error.message,
      exitCode: error.status || 1,
    };
  }
}

/**
 * Check if PowerShell is available
 */
export function isPowerShellAvailable(): boolean {
  try {
    execSync('powershell.exe -Version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run PowerShell script file
 */
export async function runScript(scriptPath: string, args: string[] = []): Promise<PowerShellResult> {
  const argString = args.map(a => `"${a}"`).join(' ');
  return powershell(`& "${scriptPath}" ${argString}`);
}

/**
 * PowerShell command builder for common operations
 */
export const psCommands = {
  // System info
  getSystemInfo: 'Get-ComputerInfo | Select-Object CsName, WindowsVersion, OsArchitecture',
  getProcesses: 'Get-Process | Sort-Object CPU -Descending | Select-Object -First 10',
  getServices: 'Get-Service | Where-Object {$_.Status -eq "Running"}',
  
  // File operations
  listDir: (path: string) => `Get-ChildItem "${path}"`,
  fileExists: (path: string) => `Test-Path "${path}"`,
  getFileContent: (path: string) => `Get-Content "${path}"`,
  
  // Network
  getIP: 'Get-NetIPAddress | Where-Object {$_.AddressFamily -eq "IPv4"}',
  testConnection: (host: string) => `Test-Connection -ComputerName "${host}" -Count 1`,
  
  // Package managers
  listInstalled: 'Get-Package | Sort-Object Name',
  searchPackage: (name: string) => `Find-Package "${name}"`,
};

export default { powershell, isPowerShellAvailable, runScript, psCommands };
