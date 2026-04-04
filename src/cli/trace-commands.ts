import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.join(process.env.HOME || '/root', '.duck', 'logs');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function listTraces(): string[] {
  ensureLogDir();
  return fs.readdirSync(LOG_DIR).filter(f => f.startsWith('trace-') && f.endsWith('.json')).sort().reverse();
}

function readTrace(filename: string): any | null {
  try {
    const content = fs.readFileSync(path.join(LOG_DIR, filename), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function traceListCommand(_args: string[]) {
  const traces = listTraces();
  if (traces.length === 0) {
    console.log('No traces found. Run with DUCK_TRACE=1 to enable tracing.');
    return;
  }

  console.log('Recent Traces');
  console.log('----------------------------------------------------------------------');
  console.log('ID              | Timestamp               | Steps | ToolCalls | Errors | Duration');
  console.log('----------------------------------------------------------------------');

  for (const file of traces.slice(0, 20)) {
    const trace = readTrace(file);
    if (!trace) continue;
    
    const shortId = file.replace('trace-', '').replace('.json', '').substring(0, 12);
    const time = new Date(trace.timestamp).toLocaleString();
    const steps = String(trace.totalSteps || trace.events?.length || 0).padStart(5);
    const toolCalls = String(trace.toolCalls || 0).padStart(8);
    const errors = trace.errors || 0;
    const errorStr = errors > 0 ? `\x1b[31m${String(errors)}\x1b[0m` : `\x1b[32m0\x1b[0m`;
    const duration = String(trace.duration || 0).padStart(7) + 'ms';

    console.log(`${shortId} | ${time.padEnd(22)} | ${steps} | ${toolCalls} | ${errorStr} | ${duration}`);
  }
}

export async function traceShowCommand(args: string[]) {
  const traceId = args[0];
  if (!traceId) {
    console.log('Usage: duck trace show <id>');
    return;
  }

  const filename = traceId.includes('.json') ? traceId : `trace-${traceId}.json`;
  const trace = readTrace(filename);
  
  if (!trace) {
    console.log(`Trace not found: ${traceId}`);
    return;
  }

  console.log(`Trace: ${filename}`);
  console.log('----------------------------------------------------------------------');
  console.log(`Timestamp:  ${new Date(trace.timestamp).toLocaleString()}`);
  console.log(`Duration:  ${trace.duration || 0}ms`);
  console.log(`Steps:     ${trace.totalSteps || trace.events?.length || 0}`);
  console.log(`Tool Calls: ${trace.toolCalls || 0}`);
  console.log(`Errors:    ${trace.errors || 0}`);
  console.log('----------------------------------------------------------------------');

  if (trace.events && trace.events.length > 0) {
    console.log('Timeline:');
    for (const event of trace.events) {
      const emoji = getEmoji(event.type);
      const step = '  ' + String(event.step || 0).padStart(3);
      
      switch (event.type) {
        case 'agent_start':
          console.log(`\x1b[2m[${step}]\x1b[0m ${emoji} \x1b[32mAgent started\x1b[0m at ${new Date(event.timestamp).toLocaleTimeString()}`);
          break;
        case 'agent_end':
          const endDur = event.data?.duration ? ` (${event.data.duration}ms)` : '';
          console.log(`\x1b[2m[${step}]\x1b[0m ${emoji} \x1b[32mAgent completed\x1b[0m${endDur}`);
          break;
        case 'thought':
          const thought = (event.data || '').toString().substring(0, 80);
          console.log(`\x1b[2m[${step}]\x1b[0m ${emoji} \x1b[33mThinking:\x1b[0m ${thought}${thought.length >= 80 ? '...' : ''}`);
          break;
        case 'tool_call':
          const tArgs = JSON.stringify(event.data || {}).substring(0, 50);
          console.log(`\x1b[2m[${step}]\x1b[0m ${emoji} \x1b[36m${event.tool || 'unknown'}\x1b[0m ${tArgs}`);
          break;
        case 'tool_result':
          const result = typeof event.data === 'string' ? event.data.substring(0, 50) : JSON.stringify(event.data || {}).substring(0, 50);
          const dur = event.duration ? ` (${event.duration}ms)` : '';
          console.log(`\x1b[2m[${step}]\x1b[0m \x1b[32m✓\x1b[0m \x1b[32mSuccess\x1b[0m${dur} ${result}`);
          break;
        case 'tool_error':
          console.log(`\x1b[2m[${step}]\x1b[0m \x1b[31m✗\x1b[0m \x1b[31mError:\x1b[0m ${event.data}`);
          break;
        case 'retry':
          console.log(`\x1b[2m[${step}]\x1b[0m ${emoji} \x1b[33mRetry\x1b[0m attempt ${event.data?.attempt}/${event.data?.maxRetries} - ${event.data?.error}`);
          break;
        case 'fallback':
          console.log(`\x1b[2m[${step}]\x1b[0m ${emoji} \x1b[33mFallback\x1b[0m trying ${event.data?.tool}`);
          break;
        case 'error':
          console.log(`\x1b[2m[${step}]\x1b[0m \x1b[31m✗\x1b[0m \x1b[31mERROR:\x1b[0m ${event.data}`);
          break;
        default:
          console.log(`\x1b[2m[${step}]\x1b[0m ${emoji} ${event.type}`);
      }
    }
  }
}

function getEmoji(type: string): string {
  const map: Record<string, string> = {
    agent_start: '🤖',
    agent_end: '✅',
    thought: '💭',
    tool_call: '📱',
    tool_result: '✅',
    tool_error: '❌',
    retry: '🔄',
    fallback: '↩️',
    error: '🚨',
    model_call: '🧠',
    model_response: '💡',
    warning: '⚠️'
  };
  return map[type] || '•';
}

export async function traceDeleteCommand(args: string[]) {
  const traceId = args[0];
  if (!traceId) {
    console.log('Usage: duck trace delete <id>');
    return;
  }

  const filename = traceId.includes('.json') ? traceId : `trace-${traceId}.json`;
  const filepath = path.join(LOG_DIR, filename);
  
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    console.log(`\x1b[32mDeleted: ${filename}\x1b[0m`);
  } else {
    console.log(`\x1b[31mNot found: ${traceId}\x1b[0m`);
  }
}

export async function traceClearCommand() {
  ensureLogDir();
  const traces = listTraces();
  
  if (traces.length === 0) {
    console.log('No traces to clear.');
    return;
  }

  for (const trace of traces) {
    fs.unlinkSync(path.join(LOG_DIR, trace));
  }
  console.log(`\x1b[32mCleared ${traces.length} traces.\x1b[0m`);
}
