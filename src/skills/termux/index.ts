/**
 * Termux Skill - duck-cli Android Integration
 * 
 * Provides seamless phone control from duck-cli via Termux
 * 
 * Usage:
 *   import { termuxService } from './index';
 *   
 *   // Run command via Termux:API
 *   await termuxService.runCommand('ls -la');
 *   
 *   // Get phone info
 *   const info = await termuxService.getPhoneInfo();
 *   
 *   // Setup duck-cli on phone
 *   await termuxService.setupDuckCLI();
 */

export { TermuxAPI, getTermuxAPI, termuxTools, DEFAULT_CONFIG } from './termux-api';
export type { TermuxConfig, TermuxResult, PhoneInfo } from './termux-api';

// Convenience singleton
import { getTermuxAPI, TermuxAPI } from './termux-api';

export const termuxService = getTermuxAPI();

/**
 * Setup duck-cli on Android phone via Termux
 * 
 * This is the bootstrap process - needs ONE manual action first:
 * User must set allow-external-apps=true in Termux
 */
export async function setupDuckCLI(): Promise<{ success: boolean; message: string }> {
  const api = termuxService;
  
  // Check what's installed
  const packages = await api.checkInstalledPackages();
  
  if (!packages.includes('com.termux')) {
    return {
      success: false,
      message: 'Termux not installed. Please install from F-Droid.',
    };
  }

  // Create bootstrap script
  const bootstrapScript = `#!/data/data/com.termux/files/usr/bin/bash
export HOME=/data/data/com.termux/files/home
export PREFIX=/data/data/com.termux/files/usr
export PATH=$PREFIX/bin:$PATH

# Install dependencies
$PREFIX/bin/pkg update -y
$PREFIX/bin/pkg install -y nodejs git

# Clone duck-cli
cd $HOME
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli

# Install and build
$PREFIX/bin/npm install
$PREFIX/bin/npm run build

# Create .env
cat > .env << 'EOF'
OPENCLAW_GATEWAY=ws://100.68.208.113:18789
LM_STUDIO_URL=http://100.68.208.113:1234
LM_STUDIO_KEY=sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf
GEMMA_MODEL=google/gemma-4-e4b-it
PHONE_MODE=true
EOF

# Create start script
cat > $HOME/start-duck.sh << 'SCRIPTEOF'
#!/data/data/com.termux/files/usr/bin/bash
cd ~/duck-cli
source .env
node dist/cli/main.js shell --agent
SCRIPTEOF
chmod +x $HOME/start-duck.sh

# Mark complete
echo "DUCK_CLI_SETUP_COMPLETE" > /sdcard/Download/duck-setup-status.txt
`;

  // Write to sdcard (using base64 to handle special chars)
  const encoded = Buffer.from(bootstrapScript).toString('base64');
  
  try {
    // Push bootstrap script
    await termuxService.pushScript('/tmp/duck-bootstrap.sh', '/sdcard/Download/duck-bootstrap.sh');
    
    return {
      success: true,
      message: 'Bootstrap script pushed. Run: bash /sdcard/Download/duck-bootstrap.sh',
    };
  } catch {
    return {
      success: false,
      message: 'Failed to push bootstrap script. Check ADB connection.',
    };
  }
}

/**
 * Start duck-cli service on phone
 */
export async function startDuckCLI(): Promise<TermuxResult> {
  return await termuxService.runCommand('~/start-duck.sh &', true);
}

/**
 * Check duck-cli status on phone
 */
export async function checkDuckCLIStatus(): Promise<TermuxResult> {
  return await termuxService.runCommand('pgrep -f "node.*duck-cli" && echo "RUNNING" || echo "STOPPED"');
}

/**
 * Full phone setup workflow
 */
export async function fullPhoneSetup(): Promise<{
  success: boolean;
  steps: string[];
  errors: string[];
}> {
  const steps: string[] = [];
  const errors: string[] = [];

  // Step 1: Check packages
  steps.push('Checking Termux packages...');
  const packages = await termuxService.checkInstalledPackages();
  
  if (!packages.includes('com.termux')) {
    errors.push('Termux not installed');
    return { success: false, steps, errors };
  }
  steps.push('✓ Termux installed');

  if (!packages.includes('com.termux.api')) {
    errors.push('Termux:API not installed - install from F-Droid');
    return { success: false, steps, errors };
  }
  steps.push('✓ Termux:API installed');

  // Step 2: Get phone info
  steps.push('Getting phone info...');
  const info = await termuxService.getPhoneInfo();
  steps.push(`✓ Phone: ${info.model} (Android ${info.androidVersion})`);

  // Step 3: Setup duck-cli
  steps.push('Setting up duck-cli...');
  const setup = await setupDuckCLI();
  if (!setup.success) {
    errors.push(setup.message);
  } else {
    steps.push('✓ duck-cli bootstrap ready');
  }

  return {
    success: errors.length === 0,
    steps,
    errors,
  };
}
