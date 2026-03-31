/**
 * 🦆 Duck Agent - Credential Sanitizer
 * Prevents API key/credential leaks in logs and output
 * Based on NVIDIA NemoClaw security model
 */

// Common credential patterns
const CREDENTIAL_PATTERNS = [
  // API keys
  { pattern: /([a-zA-Z0-9_-]{20,64})/, name: 'generic_api_key' },
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'aws_access_key' },
  { pattern: /[a-zA-Z0-9/+=]{40}/, name: 'aws_secret_key' },
  // OpenAI
  { pattern: /sk-[a-zA-Z0-9]{48}/, name: 'openai_api_key' },
  { pattern: /sk-proj-[a-zA-Z0-9_-]{50,}/, name: 'openai_project_key' },
  // Anthropic
  { pattern: /sk-ant-[a-zA-Z0-9_-]{50,}/, name: 'anthropic_api_key' },
  // Google
  { pattern: /AIza[0-9A-Za-z_-]{35}/, name: 'google_api_key' },
  // GitHub
  { pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'github_token' },
  { pattern: /gho_[a-zA-Z0-9]{36}/, name: 'github_oauth' },
  // Telegram
  { pattern: /[0-9]{8,10}:[a-zA-Z0-9_-]{35}/, name: 'telegram_token' },
  // Discord
  { pattern: /[A-Za-z0-9]{24}\.[A-Za-z0-9]{6}\.[A-Za-z0-9_-]{27}/, name: 'discord_token' },
  // Bearer tokens
  { pattern: /Bearer\s+[a-zA-Z0-9_-]{20,}/i, name: 'bearer_token' },
  // Basic auth
  { pattern: /Basic\s+[a-zA-Z0-9+=]{20,}/i, name: 'basic_auth' },
  // MiniMax (Duckets' key pattern)
  { pattern: /sk-cp-[a-zA-Z0-9]{60,}/, name: 'minimax_api_key' },
];

// Environment variable names that contain credentials
const CREDENTIAL_ENV_VARS = new Set([
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'TELEGRAM_BOT_TOKEN',
  'DISCORD_TOKEN',
  'GITHUB_TOKEN',
  'NVIDIA_API_KEY',
  'MINIMAX_API_KEY',
  'MINIMAX_API_KEY_2',
  'BROWSEROS_API_KEY',
  'LMSTUDIO_API_KEY',
  'API_KEY',
  'SECRET_KEY',
  'PRIVATE_KEY',
]);

export interface SanitizeOptions {
  redact?: boolean;
  replacement?: string;
  skipEnvVars?: boolean;
}

const DEFAULT_OPTIONS: Required<SanitizeOptions> = {
  redact: true,
  replacement: '[REDACTED]',
  skipEnvVars: false,
};

/**
 * Sanitize a string to remove credentials
 */
export function sanitize(input: string, options: SanitizeOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let result = input;

  for (const { pattern } of CREDENTIAL_PATTERNS) {
    result = result.replace(pattern, opts.replacement);
  }

  // Also sanitize environment variable references
  if (!opts.skipEnvVars) {
    for (const varName of CREDENTIAL_ENV_VARS) {
      const pattern = new RegExp(`${varName}=([^\s&]+)`, 'gi');
      result = result.replace(pattern, `${varName}=${opts.replacement}`);
    }
  }

  return result;
}

/**
 * Sanitize an object (deep sanitization)
 */
export function sanitizeObject(obj: any, options: SanitizeOptions = {}): any {
  if (typeof obj === 'string') {
    return sanitize(obj, options);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }
  
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip known sensitive keys
      if (key.toLowerCase().includes('key') || 
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('credential')) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = sanitizeObject(value, options);
      }
    }
    return result;
  }
  
  return obj;
}

/**
 * Check if a string contains potential credentials
 */
export function containsCredentials(input: string): boolean {
  for (const { pattern } of CREDENTIAL_PATTERNS) {
    if (pattern.test(input)) return true;
  }
  return false;
}

/**
 * Get list of environment variables that contain credentials
 */
export function getCredentialEnvVars(): string[] {
  return Array.from(CREDENTIAL_ENV_VARS).filter(v => process.env[v]);
}

/**
 * Create a safe log context (for debugging without leaking secrets)
 */
export function safeLogContext(context: Record<string, any>): string {
  const safe = sanitizeObject(context);
  return JSON.stringify(safe, null, 2);
}

export default { sanitize, sanitizeObject, containsCredentials, getCredentialEnvVars, safeLogContext };
