/**
 * 🦆 duck attach - OpenClaw Gateway ACP Client
 * 
 * Connects duck-cli to an OpenClaw gateway as a peer super-agent.
 * Registers duck-cli's services as ACP tools that OpenClaw can call.
 * Enables bidirectional communication between duck-cli and OpenClaw.
 * 
 * Usage:
 *   duck attach ws://localhost:18789           - Attach to local gateway
 *   duck attach ws://192.168.1.x:18789        - Attach to remote gateway
 *   duck attach ws://100.68.208.113:18789     - Attach to Mac's gateway
 *   duck attach --detach                        - Detach from current gateway
 *   duck attach --status                        - Show connection status
 */

import { BridgeManager, createBridgeManager, defineTool } from '../bridge/index.js';
import type { ToolDefinition, ToolCallResult } from '../bridge/index.js';

// Global bridge instance
let bridgeManager: BridgeManager | null = null;

// Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// ============================================================================
// TOOL DEFINITIONS - Services duck-cli exposes to OpenClaw
// ============================================================================

/**
 * AI Council deliberation tool
 * Routes complex decisions through the multi-model council at port 3003
 */
async function toolCouncil(params: Record<string, any>): Promise<ToolCallResult> {
  const { topic, mode = 'multi' } = params;
  
  try {
    const response = await fetch('http://localhost:3003/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, mode }),
      signal: AbortSignal.timeout(300000), // 5 min timeout
    });
    
    if (!response.ok) {
      return { success: false, error: `Council error: ${response.status}` };
    }
    
    const data = await response.json() as any;
    const sessionId = data.session_id;
    
    // Poll for result (up to 5 minutes)
    const startTime = Date.now();
    while (Date.now() - startTime < 300000) {
      await new Promise(r => setTimeout(r, 10000)); // Poll every 10s
      const resultRes = await fetch(`http://localhost:3003/api/session/${sessionId}`);
      if (resultRes.ok) {
        const result = await resultRes.json() as any;
        if (result.status === 'complete') {
          return {
            success: true,
            result: {
              sessionId,
              verdict: result.result,
              mode: data.mode,
            }
          };
        }
      }
    }
    
    return { success: false, error: 'Council deliberation timed out' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Agent Mesh - List connected agents
 */
async function toolMeshList(_params: Record<string, any>): Promise<ToolCallResult> {
  try {
    const response = await fetch('http://localhost:4000/api/agents', {
      headers: { 'X-API-Key': 'openclaw-mesh-default-key' },
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      return { success: false, error: `Mesh API error: ${response.status}` };
    }
    
    const agents = await response.json();
    return { success: true, result: agents };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Agent Mesh - Send message to another agent
 */
async function toolMeshSend(params: Record<string, any>): Promise<ToolCallResult> {
  const { toAgent, content } = params;
  
  try {
    const response = await fetch('http://localhost:4000/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'openclaw-mesh-default-key',
      },
      body: JSON.stringify({
        fromAgentId: 'duck-cli',
        toAgentId: toAgent,
        content,
        type: 'direct',
      }),
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      return { success: false, error: `Mesh send error: ${response.status}` };
    }
    
    return { success: true, result: { sent: true, to: toAgent } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Agent Mesh - Broadcast to all agents
 */
async function toolMeshBroadcast(params: Record<string, any>): Promise<ToolCallResult> {
  const { content } = params;
  
  try {
    const response = await fetch('http://localhost:4000/api/messages/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'openclaw-mesh-default-key',
      },
      body: JSON.stringify({
        fromAgentId: 'duck-cli',
        content,
      }),
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      return { success: false, error: `Mesh broadcast error: ${response.status}` };
    }
    
    return { success: true, result: { broadcast: true } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * CannaAI Plant Analysis
 */
async function toolPlantAnalyze(params: Record<string, any>): Promise<ToolCallResult> {
  const { imageBase64, angle } = params;
  
  try {
    const response = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64, angle }),
      signal: AbortSignal.timeout(120000),
    });
    
    if (!response.ok) {
      return { success: false, error: `CannaAI error: ${response.status}` };
    }
    
    const data = await response.json();
    return { success: true, result: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * CannaAI Plant Health Check
 */
async function toolPlantHealth(_params: Record<string, any>): Promise<ToolCallResult> {
  try {
    const response = await fetch('http://localhost:3000/api/health', {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      return { success: false, error: `CannaAI health error: ${response.status}` };
    }
    
    const data = await response.json();
    return { success: true, result: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Phone Screenshot via ADB
 */
async function toolPhoneScreenshot(_params: Record<string, any>): Promise<ToolCallResult> {
  try {
    const { execSync } = await import('child_process');
    
    // Check if ADB is connected
    const devices = execSync('adb devices', { encoding: 'utf-8' });
    if (!devices.includes('100.91.33.100')) {
      return { success: false, error: 'Phone not connected. Run: adb connect 100.91.33.100:40835' };
    }
    
    // Take screenshot via ADB
    const screenshotData = execSync(
      'adb -s 100.91.33.100:40835 exec-out screencap -p',
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    // Convert to base64 for transport
    const { Buffer } = await import('buffer');
    const base64 = Buffer.from(screenshotData, 'binary').toString('base64');
    
    return {
      success: true,
      result: {
        format: 'png',
        width: 720,
        height: 1600,
        data: base64.substring(0, 500000) + '...', // Truncate for transport
        note: 'Full base64 data available on request'
      }
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Phone Tap via ADB
 */
async function toolPhoneTap(params: Record<string, any>): Promise<ToolCallResult> {
  const { x, y } = params;
  
  try {
    const { execSync } = await import('child_process');
    execSync(`adb -s 100.91.33.100:40835 shell input tap ${x} ${y}`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    
    return { success: true, result: { tapped: { x, y } } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Phone Swipe via ADB
 */
async function toolPhoneSwipe(params: Record<string, any>): Promise<ToolCallResult> {
  const { x1, y1, x2, y2, duration = 300 } = params;
  
  try {
    const { execSync } = await import('child_process');
    execSync(
      `adb -s 100.91.33.100:40835 shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    
    return { success: true, result: { swiped: { x1, y1, x2, y2, duration } } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Phone Text Input via ADB
 */
async function toolPhoneType(params: Record<string, any>): Promise<ToolCallResult> {
  const { text } = params;
  
  try {
    const { execSync } = await import('child_process');
    // Escape special characters
    const escaped = text.replace(/[`$!"]/g, '\\$&');
    execSync(`adb -s 100.91.33.100:40835 shell input text "${escaped}"`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    
    return { success: true, result: { typed: text.substring(0, 50) } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Phone Launch App via ADB
 */
async function toolPhoneLaunch(params: Record<string, any>): Promise<ToolCallResult> {
  const { package: pkg, activity } = params;
  
  try {
    const { execSync } = await import('child_process');
    const component = activity ? `${pkg}/${activity}` : pkg;
    execSync(`adb -s 100.91.33.100:40835 shell am start -n ${component}`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    
    return { success: true, result: { launched: { package: pkg, activity } } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * duck-cli status / ping
 */
async function toolDuckStatus(_params: Record<string, any>): Promise<ToolCallResult> {
  return {
    success: true,
    result: {
      agent: 'duck-cli',
      role: 'super-agent',
      version: '0.4.0',
      services: {
        council: 'localhost:3003',
        mesh: 'localhost:4000',
        cannaai: 'localhost:3000',
        phone: '100.91.33.100:40835',
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    }
  };
}

// ============================================================================
// ATTACH COMMAND
// ============================================================================

export interface AttachConfig {
  gatewayUrl: string;
  agentId?: string;
  agentName?: string;
}

export async function attachCommand(args: string[]): Promise<void> {
  const [subCmd, ...subArgs] = args;
  
  // Handle sub-commands
  if (subCmd === '--detach' || subCmd === 'detach') {
    await detach();
    return;
  }
  
  if (subCmd === '--status' || subCmd === 'status') {
    await status();
    return;
  }
  
  if (subCmd === '--help' || subCmd === 'help' || !subCmd) {
    printHelp();
    return;
  }
  
  // Parse gateway URL
  const gatewayUrl = subCmd;
  await attach(gatewayUrl);
}

async function attach(gatewayUrl: string): Promise<void> {
  console.log(`${c.cyan}🦆 duck-cli Super Agent${c.reset}`);
  console.log(`${c.dim}Connecting to OpenClaw gateway: ${gatewayUrl}${c.reset}\n`);
  
  // Determine agent identity
  const agentId = process.env.DUCK_AGENT_ID || 'duck-cli';
  const agentName = process.env.DUCK_AGENT_NAME || 'Duck Super Agent';
  
  // Create bridge manager
  bridgeManager = createBridgeManager({
    agentId,
    agentName,
    gatewayUrl,
    reconnectInterval: 5000,
    heartbeatInterval: 30000,
    mcpEnabled: false,
    restEnabled: false,
    externalMeshEnabled: false,
  });
  
  // Register duck-cli's services as ACP tools
  registerTools();
  
  // Handle tool calls from OpenClaw
  bridgeManager.on('tool_call', async (data: any) => {
    console.log(`${c.dim}[duck-cli] Tool call: ${data.payload?.tool}${c.reset}`);
  });
  
  // Handle agent output from OpenClaw
  bridgeManager.on('agent_output', async (data: any) => {
    console.log(`${c.dim}[duck-cli] Agent output: ${data.payload?.text?.substring(0, 100)}...${c.reset}`);
  });
  
  // Handle spawn requests
  bridgeManager.on('spawn_agent', async (data: any) => {
    console.log(`${c.dim}[duck-cli] Spawn request: ${data.payload?.task}${c.reset}`);
  });
  
  try {
    // Initialize bridges (no REST/MCP needed for pure ACP)
    await bridgeManager.initialize();
    
    // Connect to gateway
    await bridgeManager.connect();
    
    console.log(`\n${c.green}✓ Connected to OpenClaw gateway!${c.reset}`);
    console.log(`${c.bold}Super Agent "${agentName}" is now active.${c.reset}`);
    console.log(`\nRegistered tools:`);
    console.log(`  ${c.cyan}duck_council${c.reset}      - AI Council deliberation`);
    console.log(`  ${c.cyan}duck_mesh_list${c.reset}    - List mesh agents`);
    console.log(`  ${c.cyan}duck_mesh_send${c.reset}    - Send message to agent`);
    console.log(`  ${c.cyan}duck_mesh_broadcast${c.reset} - Broadcast to all agents`);
    console.log(`  ${c.cyan}duck_plant_analyze${c.reset} - Plant health analysis`);
    console.log(`  ${c.cyan}duck_plant_health${c.reset}  - Plant server status`);
    console.log(`  ${c.cyan}duck_phone_screenshot${c.reset} - Phone screenshot`);
    console.log(`  ${c.cyan}duck_phone_tap${c.reset}     - Tap on phone`);
    console.log(`  ${c.cyan}duck_phone_swipe${c.reset}   - Swipe on phone`);
    console.log(`  ${c.cyan}duck_phone_type${c.reset}   - Type on phone`);
    console.log(`  ${c.cyan}duck_phone_launch${c.reset}  - Launch app`);
    console.log(`  ${c.cyan}duck_status${c.reset}       - Duck-cli status`);
    console.log(`\n${c.dim}Press Ctrl+C to detach.${c.reset}\n`);
    
    // Keep process alive
    await new Promise(() => {});
    
  } catch (e: any) {
    console.error(`${c.red}✗ Failed to connect: ${e.message}${c.reset}`);
    console.error(`\n${c.dim}Make sure the OpenClaw gateway is running at:${c.reset}`);
    console.error(`  ${gatewayUrl}`);
    process.exit(1);
  }
}

async function detach(): Promise<void> {
  if (bridgeManager) {
    bridgeManager.disconnect('User requested detach');
    console.log(`${c.green}✓ Detached from OpenClaw gateway${c.reset}`);
    bridgeManager = null;
  } else {
    console.log(`${c.yellow}Not attached to any gateway${c.reset}`);
  }
}

async function status(): Promise<void> {
  if (bridgeManager) {
    const tools = bridgeManager.getRegisteredTools();
    console.log(`${c.green}✓ Connected to OpenClaw gateway${c.reset}`);
    console.log(`\nRegistered tools (${tools.length}):`);
    for (const tool of tools) {
      console.log(`  ${c.cyan}${tool.name}${c.reset} - ${tool.description.substring(0, 50)}...`);
    }
  } else {
    console.log(`${c.yellow}✗ Not attached to any gateway${c.reset}`);
    console.log(`\nUsage: ${c.bold}duck attach <gateway-url>${c.reset}`);
    console.log(`\nExample:`);
    console.log(`  duck attach ws://localhost:18789`);
    console.log(`  duck attach ws://100.68.208.113:18789`);
  }
}

function registerTools(): void {
  if (!bridgeManager) return;
  
  const tools: Array<{ def: ToolDefinition; handler: Function }> = [
    {
      def: defineTool('duck_council', 'Deliberate a topic through the AI Council (multi-model, 7 specialist groups)', {
        topic: { type: 'string', description: 'The topic or question to deliberate' },
        mode: { type: 'string', description: 'Deliberation mode: standard or multi', default: 'multi' },
      }),
      handler: toolCouncil,
    },
    {
      def: defineTool('duck_mesh_list', 'List all agents registered on the agent mesh network', {}),
      handler: toolMeshList,
    },
    {
      def: defineTool('duck_mesh_send', 'Send a direct message to another agent on the mesh', {
        toAgent: { type: 'string', description: 'Target agent ID' },
        content: { type: 'string', description: 'Message content' },
      }),
      handler: toolMeshSend,
    },
    {
      def: defineTool('duck_mesh_broadcast', 'Broadcast a message to all agents on the mesh', {
        content: { type: 'string', description: 'Broadcast message' },
      }),
      handler: toolMeshBroadcast,
    },
    {
      def: defineTool('duck_plant_analyze', 'Analyze plant health using CannaAI vision', {
        imageBase64: { type: 'string', description: 'Base64-encoded plant photo' },
        angle: { type: 'string', description: 'Camera angle identifier' },
      }),
      handler: toolPlantAnalyze,
    },
    {
      def: defineTool('duck_plant_health', 'Check CannaAI plant server health', {}),
      handler: toolPlantHealth,
    },
    {
      def: defineTool('duck_phone_screenshot', 'Take a screenshot from the connected Android phone via ADB', {}),
      handler: toolPhoneScreenshot,
    },
    {
      def: defineTool('duck_phone_tap', 'Tap at coordinates on the Android phone', {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
      }),
      handler: toolPhoneTap,
    },
    {
      def: defineTool('duck_phone_swipe', 'Swipe on the Android phone', {
        x1: { type: 'number', description: 'Start X' },
        y1: { type: 'number', description: 'Start Y' },
        x2: { type: 'number', description: 'End X' },
        y2: { type: 'number', description: 'End Y' },
        duration: { type: 'number', description: 'Swipe duration in ms' },
      }),
      handler: toolPhoneSwipe,
    },
    {
      def: defineTool('duck_phone_type', 'Type text on the Android phone', {
        text: { type: 'string', description: 'Text to type' },
      }),
      handler: toolPhoneType,
    },
    {
      def: defineTool('duck_phone_launch', 'Launch an app on the Android phone', {
        package: { type: 'string', description: 'App package name' },
        activity: { type: 'string', description: 'Activity name (optional)' },
      }),
      handler: toolPhoneLaunch,
    },
    {
      def: defineTool('duck_status', 'Get duck-cli super agent status', {}),
      handler: toolDuckStatus,
    },
  ];
  
  for (const { def, handler } of tools) {
    bridgeManager!.registerTool({
      definition: def,
      handler: handler as any,
    });
  }
}

function printHelp(): void {
  console.log(`
${c.bold}🦆 duck attach — Super Agent ACP Client${c.reset}

Connect duck-cli to an OpenClaw gateway as a peer super-agent.

${c.bold}Usage:${c.reset}
  ${c.cyan}duck attach <gateway-url>${c.reset}   Connect to OpenClaw gateway
  ${c.cyan}duck attach --status${c.reset}        Show connection status
  ${c.cyan}duck attach --detach${c.reset}        Detach from current gateway
  ${c.cyan}duck attach --help${c.reset}           Show this help

${c.bold}Examples:${c.reset}
  ${c.dim}# Attach to local OpenClaw gateway${c.reset}
  duck attach ws://localhost:18789
  
  ${c.dim}# Attach to Mac's OpenClaw gateway${c.reset}
  duck attach ws://100.68.208.113:18789
  
  ${c.dim}# Check connection status${c.reset}
  duck attach --status

${c.bold}Environment Variables:${c.reset}
  DUCK_AGENT_ID      Agent ID (default: duck-cli)
  DUCK_AGENT_NAME    Agent name (default: Duck Super Agent)

${c.bold}Registered Tools:${c.reset}
  duck_council           AI Council deliberation (port 3003)
  duck_mesh_list         List mesh agents (port 4000)
  duck_mesh_send         Send message to agent
  duck_mesh_broadcast    Broadcast to all agents
  duck_plant_analyze     Plant health analysis (port 3000)
  duck_plant_health      Plant server health check
  duck_phone_screenshot  Phone screenshot (ADB)
  duck_phone_tap         Tap on phone
  duck_phone_swipe       Swipe on phone
  duck_phone_type        Type text on phone
  duck_phone_launch      Launch app on phone
  duck_status            Agent status
`);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log(`\n${c.yellow}Detaching from gateway...${c.reset}`);
  if (bridgeManager) {
    bridgeManager.disconnect('Ctrl+C');
  }
  process.exit(0);
});
