/**
 * Workflow Runner - DroidClaw-inspired multi-step workflow execution
 *
 * Executes JSON workflow files with sequences of goals/steps.
 * Each step can be a simple goal that the agent figures out,
 * or a deterministic flow (no LLM, instant execution).
 *
 * Workflow JSON format:
 * {
 *   "name": "My Workflow",
 *   "description": "What this does",
 *   "steps": [
 *     { "goal": "Open Chrome and go to github.com" },
 *     { "goal": "Search for openclaw", "app": "com.android.chrome" },
 *     { "goal": "Fill form: {email} with test@test.com", "formData": { "email": "test@test.com" } }
 *   ]
 * }
 */

import { readFileSync, existsSync } from 'fs';
import { Agent } from './core.js';
import { execSync } from 'child_process';
import { DesktopControl } from '../integrations/desktop.js';

export interface WorkflowStep {
  goal?: string;           // LLM-driven goal (uses agent)
  flow?: string;           // Deterministic flow file (no LLM, instant)
  app?: string;            // Optional: app to switch to (for Android)
  formData?: Record<string, string>;  // Inject data into step
  maxSteps?: number;      // Max steps for this goal (default 15)
}

export interface Workflow {
  name: string;
  description?: string;
  steps: WorkflowStep[];
}

export interface WorkflowResult {
  name: string;
  success: boolean;
  steps: StepResult[];
}

export interface StepResult {
  goal?: string;
  flow?: string;
  success: boolean;
  stepsUsed: number;
  output?: string;
  error?: string;
}

// ============================================
// Flow Runner (Deterministic YAML, no LLM)
// ============================================

interface FlowFrontmatter {
  appId?: string;
  name?: string;
  shell?: string;  // Pre-command to run
}

type FlowStep =
  | string  // "launchApp", "back", "enter", "done"
  | { [key: string]: string | number | [number, number] };

function parseFlowFile(filePath: string): { frontmatter: FlowFrontmatter; steps: FlowStep[] } {
  const yaml = require('yaml');
  const raw = readFileSync(filePath, 'utf-8');
  const docs = yaml.parseAllDocuments(raw);

  let frontmatter: FlowFrontmatter = {};
  let steps: FlowStep[] = [];

  if (docs.length === 1) {
    const content = docs[0].toJSON();
    if (Array.isArray(content)) {
      steps = content;
    } else if (content && typeof content === 'object') {
      frontmatter = content as FlowFrontmatter;
    }
  } else if (docs.length >= 2) {
    frontmatter = (docs[0].toJSON() ?? {}) as FlowFrontmatter;
    steps = (docs[1].toJSON() ?? []) as FlowStep[];
  }

  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('Flow file contains no steps');
  }

  return { frontmatter, steps };
}

function executeFlowStep(step: FlowStep, desktop: DesktopControl): { success: boolean; message: string } {
  // Simple string commands
  if (typeof step === 'string') {
    switch (step) {
      case 'launchApp':
        return { success: false, message: 'launchApp requires appId in frontmatter (use "app" field)' };
      case 'back':
        desktop.click(10, 10); // Back gesture on Mac = top-left
        return { success: true, message: 'Back' };
      case 'enter':
        execSync('osascript -e \'tell application "System Events" to key code 36\'');
        return { success: true, message: 'Enter pressed' };
      case 'clear':
        execSync('osascript -e \'tell application "System Events" to keystroke "a" using command down\'');
        execSync('osascript -e \'tell application "System Events" to key code 51\''); // delete
        return { success: true, message: 'Cleared' };
      case 'tab':
        execSync('osascript -e \'tell application "System Events" to key code 48\''); // tab
        return { success: true, message: 'Tab pressed' };
      case 'done':
        return { success: true, message: 'Flow complete' };
      case 'wait':
        // Wait is handled in flow runner
        return { success: true, message: 'Wait' };
      default:
        return { success: false, message: `Unknown step: ${step}` };
    }
  }

  // Object commands
  if (typeof step === 'object' && step !== null) {
    const [command, value] = Object.entries(step)[0];

    switch (command) {
      case 'shell': {
        execSync(String(value), { stdio: 'inherit' });
        return { success: true, message: `Shell: ${value}` };
      }
      case 'type': {
        const text = String(value);
        // Escape for osascript
        const escaped = text.replace(/"/g, '\\"');
        execSync(`osascript -e 'tell application "System Events" to keystroke "${escaped}"'`);
        return { success: true, message: `Typed: ${text.slice(0, 50)}` };
      }
      case 'open': {
        const app = String(value);
        execSync(`open -a "${app}"`, { stdio: 'inherit' });
        return { success: true, message: `Opened: ${app}` };
      }
      case 'click': {
        if (Array.isArray(value)) {
          desktop.click(value[0], value[1]);
          return { success: true, message: `Clicked: ${value}` };
        }
        return { success: false, message: `click requires coordinates [x, y]` };
      }
      case 'wait': {
        const seconds = Number(value) || 2;
        return { success: true, message: `Wait ${seconds}s` };
      }
      case 'done':
        return { success: true, message: `Done: ${value || 'Flow complete'}` };
      default:
        return { success: false, message: `Unknown command: ${command}` };
    }
  }

  return { success: false, message: `Invalid step: ${JSON.stringify(step)}` };
}

// ============================================
// Workflow Runner
// ============================================

export class WorkflowRunner {
  private agent: Agent;
  private desktop: DesktopControl;
  private defaultMaxSteps = 15;

  constructor(agent: Agent) {
    this.agent = agent;
    this.desktop = new DesktopControl();
  }

  /**
   * Run a workflow from a JSON file
   */
  async runFromFile(filePath: string): Promise<WorkflowResult> {
    if (!existsSync(filePath)) {
      throw new Error(`Workflow file not found: ${filePath}`);
    }
    const content = readFileSync(filePath, 'utf-8');
    const workflow: Workflow = JSON.parse(content);
    return this.run(workflow);
  }

  /**
   * Run a deterministic YAML flow (no LLM)
   */
  async runFlowFromFile(filePath: string): Promise<StepResult> {
    try {
      const { frontmatter, steps } = parseFlowFile(filePath);
      const name = frontmatter.name || filePath.split('/').pop() || 'flow';

      console.log(`[Flow] "${name}" — ${steps.length} steps`);

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const label = typeof step === 'string' ? step : Object.entries(step)[0].join(': ');
        console.log(`[Flow] [${i + 1}/${steps.length}] ${label}`);

        // Handle wait step
        if (typeof step === 'string' && step === 'wait') {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        if (typeof step === 'object' && !Array.isArray(step)) {
          const [cmd, val] = Object.entries(step)[0];
          if (cmd === 'wait') {
            await new Promise(r => setTimeout(r, (Number(val) || 2) * 1000));
            continue;
          }
        }

        const result = executeFlowStep(step, this.desktop);
        if (!result.success) {
          return {
            flow: filePath,
            success: false,
            stepsUsed: i + 1,
            error: result.message
          };
        }
      }

      return {
        flow: filePath,
        success: true,
        stepsUsed: steps.length,
        output: `Flow "${name}" completed successfully`
      };
    } catch (err: any) {
      return {
        flow: filePath,
        success: false,
        stepsUsed: 0,
        error: err.message
      };
    }
  }

  /**
   * Run a workflow object
   */
  async run(workflow: Workflow): Promise<WorkflowResult> {
    console.log(`[Workflow] Starting: "${workflow.name}" (${workflow.steps.length} steps)`);
    const results: StepResult[] = [];
    let allSuccess = true;

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];

      if (step.flow) {
        // Deterministic flow - run without LLM
        const flowResult = await this.runFlowFromFile(step.flow);
        results.push(flowResult);
        if (!flowResult.success) allSuccess = false;
      } else if (step.goal) {
        // LLM-driven goal
        const goalResult = await this.runGoal(step);
        results.push(goalResult);
        if (!goalResult.success) allSuccess = false;
      } else {
        results.push({
          error: 'Step must have either "goal" or "flow"',
          success: false,
          stepsUsed: 0
        });
        allSuccess = false;
      }

      if (!allSuccess) {
        console.log(`[Workflow] Step failed, stopping.`);
        break;
      }
    }

    const succeeded = results.filter(r => r.success).length;
    console.log(`[Workflow] Complete: ${workflow.name} — ${succeeded}/${results.length} steps succeeded`);
    return { name: workflow.name, success: allSuccess, steps: results };
  }

  /**
   * Run a single goal through the agent
   */
  private async runGoal(step: WorkflowStep): Promise<StepResult> {
    let finalGoal = step.goal || '';

    // Inject form data into goal
    if (step.formData) {
      for (const [key, value] of Object.entries(step.formData)) {
        finalGoal = finalGoal.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      }
      // Also append form data context if not already in goal
      if (!finalGoal.includes('FORM DATA')) {
        const lines = Object.entries(step.formData)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join('\n');
        finalGoal += `\n\nFORM DATA TO FILL:\n${lines}`;
      }
    }

    console.log(`[Workflow] Goal: ${finalGoal}`);
    try {
      const response = await this.agent.chat(finalGoal);
      return {
        goal: finalGoal,
        success: true,
        stepsUsed: 1,
        output: response.slice(0, 500)
      };
    } catch (err: any) {
      return {
        goal: finalGoal,
        success: false,
        stepsUsed: 0,
        error: err.message
      };
    }
  }
}

/**
 * Parse a workflow goal with form data injection support
 */
export function parseWorkflowGoal(goal: string, formData?: Record<string, string>): string {
  if (!formData) return goal;
  let result = goal;
  for (const [key, value] of Object.entries(formData)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}
