/**
 * Example: Basic Bridge Usage
 * 
 * This demonstrates how to use the duck-cli bridge to connect
 * to the OpenClaw gateway and expose tools.
 */

import {
  createBridgeManager,
  defineTool,
  registerTool,
  ToolRegistration,
} from "../index";

async function main() {
  // Create bridge manager
  const bridge = createBridgeManager({
    agentId: "android-controller",
    agentName: "Android Device Controller",
    gatewayUrl: "ws://localhost:18789",
    mcpEnabled: true,
    mcpPort: 9090,
    restEnabled: true,
    restPort: 8080,
  });

  // Register tools with the bridge
  const tools: ToolRegistration[] = [
    {
      definition: defineTool(
        "android_screenshot",
        "Capture a screenshot from the Android device",
        {} // No parameters
      ),
      handler: async (tool, params) => {
        console.log(`Executing ${tool}...`);
        // In real implementation, this would call adb
        return { success: true, result: "screenshot_data_base64" };
      },
    },
    {
      definition: defineTool(
        "android_tap",
        "Tap at coordinates on Android device",
        { x: { type: "number" }, y: { type: "number" } },
        ["x", "y"]
      ),
      handler: async (tool, params) => {
        console.log(`Executing ${tool} at (${params.x}, ${params.y})...`);
        // In real implementation, this would call adb
        return { success: true, result: "tap performed" };
      },
    },
    {
      definition: defineTool(
        "android_input_text",
        "Input text on Android device",
        { text: { type: "string" } },
        ["text"]
      ),
      handler: async (tool, params) => {
        console.log(`Executing ${tool} with text: ${params.text}...`);
        return { success: true, result: "text input performed" };
      },
    },
  ];

  bridge.registerTools(tools);

  // Listen for events
  bridge.on("connected", () => {
    console.log("✅ Connected to OpenClaw gateway!");
  });

  bridge.on("disconnected", (data) => {
    console.log(`❌ Disconnected: ${data.reason || "unknown"}`);
  });

  bridge.on("tool_call", (data) => {
    console.log(`🔧 Tool call received: ${data.message?.payload?.tool}`);
  });

  bridge.on("error", (data) => {
    console.error(`❌ Error: ${data.error}`);
  });

  // Initialize bridges
  await bridge.initialize();

  // Connect to OpenClaw gateway
  await bridge.connect();

  // Get status
  const status = bridge.getStatus();
  console.log("Bridge status:", status);

  // Keep running
  console.log("Bridge is running. Press Ctrl+C to stop.");

  // Handle shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await bridge.shutdown();
    process.exit(0);
  });
}

main().catch(console.error);
