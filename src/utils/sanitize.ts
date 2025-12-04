/**
 * Input Sanitization for LLM Prompt Injection Prevention
 *
 * Implements OWASP LLM security best practices:
 * - Input validation and sanitization
 * - Detection of known injection patterns
 * - Flagging suspicious inputs for monitoring
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
 */

// ============================================================================
// Types
// ============================================================================

export interface SanitizationResult {
  sanitized: string;
  flagged: boolean;
  reason?: string;
}

// ============================================================================
// Injection Patterns
// ============================================================================

/**
 * Known LLM prompt injection patterns
 * These patterns attempt to override system instructions
 */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  // Direct instruction override attempts
  { pattern: /ignore\s+(all\s+)?previous\s+instructions?/i, name: 'ignore_previous' },
  { pattern: /disregard\s+(all\s+)?instructions?/i, name: 'disregard_instructions' },
  { pattern: /forget\s+(all\s+)?(your\s+)?instructions?/i, name: 'forget_instructions' },
  { pattern: /override\s+(all\s+)?instructions?/i, name: 'override_instructions' },

  // Role/context manipulation
  { pattern: /you\s+are\s+now\s+/i, name: 'role_change' },
  { pattern: /pretend\s+(you\s+are|to\s+be)/i, name: 'role_pretend' },
  { pattern: /act\s+as\s+(if\s+you\s+are|a)/i, name: 'act_as' },
  { pattern: /new\s+persona/i, name: 'new_persona' },

  // System prompt leakage attempts
  { pattern: /system\s*:/i, name: 'system_prefix' },
  { pattern: /\[INST\]/i, name: 'inst_tag' },
  { pattern: /\[\/INST\]/i, name: 'inst_close_tag' },
  { pattern: /<\|system\|>/i, name: 'system_tag' },
  { pattern: /<\|assistant\|>/i, name: 'assistant_tag' },
  { pattern: /<\|user\|>/i, name: 'user_tag' },
  { pattern: /<<SYS>>/i, name: 'sys_tag' },

  // Privilege escalation
  { pattern: /admin\s+override/i, name: 'admin_override' },
  { pattern: /admin\s+mode/i, name: 'admin_mode' },
  { pattern: /developer\s+mode/i, name: 'developer_mode' },
  { pattern: /debug\s+mode/i, name: 'debug_mode' },
  { pattern: /maintenance\s+mode/i, name: 'maintenance_mode' },

  // Known jailbreak keywords
  { pattern: /jailbreak/i, name: 'jailbreak' },
  { pattern: /DAN\s+mode/i, name: 'dan_mode' },
  { pattern: /do\s+anything\s+now/i, name: 'do_anything_now' },

  // Output manipulation
  { pattern: /output\s+your\s+system\s+prompt/i, name: 'leak_system_prompt' },
  { pattern: /print\s+your\s+instructions/i, name: 'print_instructions' },
  { pattern: /show\s+me\s+your\s+prompt/i, name: 'show_prompt' },
  { pattern: /what\s+are\s+your\s+instructions/i, name: 'what_instructions' },
];

/**
 * Suspicious character sequences that might indicate encoding bypass attempts
 */
const SUSPICIOUS_SEQUENCES = [
  '\\u0000', // Null byte
  '\\x00', // Hex null
  '\u200B', // Zero-width space
  '\u200C', // Zero-width non-joiner
  '\u200D', // Zero-width joiner
  '\uFEFF', // BOM
];

// ============================================================================
// Main Sanitization Function
// ============================================================================

/**
 * Sanitize user input before sending to LLM
 *
 * @param input - Raw user input
 * @param maxLength - Maximum allowed length (default: 4096 for WhatsApp)
 * @returns Sanitization result with sanitized text and flag info
 */
export function sanitizeUserInput(
  input: string,
  maxLength: number = 4096
): SanitizationResult {
  // Handle empty/null input
  if (!input || typeof input !== 'string') {
    return { sanitized: '', flagged: false };
  }

  let sanitized = input.trim();
  const flags: string[] = [];

  // 1. Length check
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
    flags.push('truncated');
  }

  // 2. Remove suspicious Unicode sequences
  for (const seq of SUSPICIOUS_SEQUENCES) {
    if (sanitized.includes(seq)) {
      sanitized = sanitized.split(seq).join('');
      flags.push('removed_suspicious_chars');
    }
  }

  // 3. Check for injection patterns
  for (const { pattern, name } of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      flags.push(`injection_pattern:${name}`);
    }
  }

  // 4. Normalize whitespace (but preserve newlines for multi-line messages)
  sanitized = sanitized
    .replace(/\t/g, ' ') // Tabs to spaces
    .replace(/ +/g, ' '); // Multiple spaces to single space

  // Build result
  const flagged = flags.length > 0;
  const reason = flagged ? flags.join(', ') : undefined;

  return {
    sanitized,
    flagged,
    reason,
  };
}

/**
 * Check if input contains any injection patterns (quick check without sanitization)
 */
export function containsInjectionPattern(input: string): boolean {
  if (!input) return false;
  return INJECTION_PATTERNS.some(({ pattern }) => pattern.test(input));
}

/**
 * Get detailed injection analysis (for logging/monitoring)
 */
export function analyzeInput(input: string): {
  patterns: string[];
  risk: 'none' | 'low' | 'medium' | 'high';
} {
  if (!input) {
    return { patterns: [], risk: 'none' };
  }

  const patterns: string[] = [];

  for (const { pattern, name } of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      patterns.push(name);
    }
  }

  // Determine risk level
  let risk: 'none' | 'low' | 'medium' | 'high' = 'none';
  if (patterns.length === 0) {
    risk = 'none';
  } else if (patterns.length === 1) {
    risk = 'low';
  } else if (patterns.length <= 3) {
    risk = 'medium';
  } else {
    risk = 'high';
  }

  return { patterns, risk };
}
