/**
 * 🦆 Duck CLI - Sandbox Manager
 * Manages OpenClaw-compatible sandboxes: list, recreate, explain
 */

import { execSync } from 'child_process';

export interface SandboxInfo {
  id: string;
  name: string;
  status: 'active' | 'stopped' | 'error';
  profile: string;
  created?: string;
}

export interface SandboxCreateOptions {
  name?: string;
  profile?: string;
  headless?: boolean;
}

export interface ExplainResult {
  summary: string;
  elements: ExplainElement[];
  forms: FormInfo[];
  links: LinkInfo[];
}

export interface ExplainElement {
  ref: string;
  role: string;
  name: string;
  tagName?: string;
}

export interface FormInfo {
  ref: string;
  method?: string;
  action?: string;
  fields: string[];
}

export interface LinkInfo {
  ref: string;
  href?: string;
  text: string;
}

/**
 * List all available sandboxes
 */
export async function listSandboxes(): Promise<SandboxInfo[]> {
  try {
    // Check if BrowserOS is running as sandbox
    try {
      execSync('curl -s http://127.0.0.1:9002/mcp', { stdio: 'pipe' });
      return [{
        id: 'browseros-1',
        name: 'BrowserOS Sandbox',
        status: 'active',
        profile: 'sandbox',
      }];
    } catch {
      return [];
    }
  } catch (err: any) {
    throw new Error(`Failed to list sandboxes: ${err.message}`);
  }
}

/**
 * Recreate a sandbox (stop and start fresh)
 */
export async function recreateSandbox(sandboxId?: string): Promise<SandboxInfo> {
  try {
    // Restart BrowserOS if it's the sandbox
    execSync('pkill -f "BrowserOS" 2>/dev/null; sleep 1; open -a BrowserOS', { stdio: 'pipe' });
    
    return {
      id: sandboxId ?? 'browseros-1',
      name: sandboxId ? `Sandbox ${sandboxId}` : 'BrowserOS Sandbox',
      status: 'active',
      profile: 'sandbox',
    };
  } catch (err: any) {
    throw new Error(`Failed to recreate sandbox: ${err.message}`);
  }
}

/**
 * Explain current page - summarize structure, forms, links
 */
export async function explainPage(targetId?: string): Promise<ExplainResult> {
  try {
    // Get snapshot via BrowserOS MCP
    const result = execSync(
      'mcporter call browseros.take_snapshot 2>/dev/null || echo "{}"',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    );

    const snapshot = JSON.parse(result);
    const elements: ExplainElement[] = [];
    const forms: FormInfo[] = [];
    const links: LinkInfo[] = [];

    const traverse = (nodes: any[], depth = 0) => {
      if (!nodes || depth > 3) return;
      for (const node of nodes) {
        const role = node.role?.toLowerCase() ?? '';
        const name = node.name ?? node.value ?? '';

        if (role === 'link' || role === 'navigation') {
          links.push({
            ref: node.ref ?? '',
            href: node.href,
            text: name,
          });
        } else if (role === 'form' || role === 'textbox' || role === 'checkbox' || role === 'radio') {
          const formEl = forms.find(f => f.ref === (node.formRef ?? ''));
          if (formEl) {
            formEl.fields.push(name);
          }
        } else if (role) {
          elements.push({
            ref: node.ref ?? '',
            role: node.role,
            name,
            tagName: node.tagName,
          });
        }

        if (node.children) {
          traverse(node.children, depth + 1);
        }
      }
    };

    if (snapshot) {
      traverse(Array.isArray(snapshot) ? snapshot : [snapshot]);
    }

    return {
      summary: buildPageSummary(elements, forms, links),
      elements: elements.slice(0, 20),
      forms,
      links: links.slice(0, 20),
    };
  } catch (err: any) {
    throw new Error(`Failed to explain page: ${err.message}`);
  }
}

function buildPageSummary(elements: ExplainElement[], forms: FormInfo[], links: LinkInfo[]): string {
  const counts: Record<string, number> = {};
  
  for (const el of elements) {
    const role = el.role.toLowerCase();
    if (role === 'button' || role === 'link' || role === 'textbox' || role === 'checkbox' || role === 'radio') {
      counts[role] = (counts[role] ?? 0) + 1;
    }
  }

  const parts: string[] = [];
  
  if (links.length > 0) {
    parts.push(`${links.length} link(s)`);
  }
  if (counts.button > 0) {
    parts.push(`${counts.button} button(s)`);
  }
  if (counts.textbox > 0) {
    parts.push(`${counts.textbox} text input(s)`);
  }
  if (forms.length > 0) {
    parts.push(`${forms.length} form(s)`);
  }

  return parts.length > 0 
    ? `Page has: ${parts.join(', ')}` 
    : 'Page appears empty or minimal';
}

/**
 * Open URL in sandbox
 */
export async function openInSandbox(url: string): Promise<void> {
  try {
    execSync(`mcporter call browseros.new_page url="${url}" 2>/dev/null || open "${url}"`, { stdio: 'pipe' });
  } catch (err: any) {
    throw new Error(`Failed to open in sandbox: ${err.message}`);
  }
}

/**
 * Get sandbox status
 */
export async function getSandboxStatus(): Promise<SandboxInfo> {
  try {
    try {
      execSync('curl -s http://127.0.0.1:9002/mcp', { stdio: 'pipe' });
      return {
        id: 'browseros-1',
        name: 'BrowserOS Sandbox',
        status: 'active',
        profile: 'sandbox',
      };
    } catch {
      return {
        id: 'browseros-1',
        name: 'BrowserOS Sandbox',
        status: 'stopped',
        profile: 'sandbox',
      };
    }
  } catch (err: any) {
    return {
      id: 'browseros-1',
      name: 'BrowserOS Sandbox',
      status: 'error',
      profile: 'sandbox',
    };
  }
}

export default {
  listSandboxes,
  recreateSandbox,
  explainPage,
  openInSandbox,
  getSandboxStatus,
};
