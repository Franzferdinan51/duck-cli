export function toolsCommand() {
  const tools = [
    ['shell', 'Execute a guarded shell command'],
    ['desktop_open', 'Open an application via ClawdCursor'],
    ['desktop_click', 'Click screen coordinates via ClawdCursor'],
    ['desktop_type', 'Type text via ClawdCursor'],
    ['desktop_screenshot', 'Capture a desktop screenshot'],
    ['screen_read', 'Capture and analyze the screen with vision'],
    ['android_*', 'ADB-based Android device control'],
    ['weather_*', 'Weather and forecast access'],
    ['crypto_*', 'Crypto prices and portfolio tracking'],
    ['grow_*', 'Plant / grow-tent monitoring tools'],
    ['memory_*', 'Persistent memory storage and recall'],
    ['agent_*', 'Spawn and manage subagents'],
    ['cron_*', 'Scheduled task management'],
    ['web_search', 'Search the web'],
    ['file_read', 'Read a file'],
    ['file_write', 'Write a file'],
  ];

  console.log('\n🦆 duck tools\n');
  for (const [name, desc] of tools) {
    console.log(`${name.padEnd(18)} ${desc}`);
  }
}
