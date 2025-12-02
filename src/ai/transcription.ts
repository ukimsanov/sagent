/**
 * Audio Transcription Service using OpenAI Whisper API
 *
 * Features:
 * - Automatic language detection
 * - Transcription caching (by audio SHA256 hash)
 * - Confidence threshold filtering
 * - Error handling and retries
 */

import { downloadAudio } from '../whatsapp/media';

// ============================================================================
// Types
// ============================================================================

export interface TranscriptionResult {
  text: string;
  language: string | null;
  duration: number | null;
  confidence: 'high' | 'medium' | 'low';
  cached: boolean;
}

export interface TranscriptionError {
  error: string;
  type: 'download_failed' | 'transcription_failed' | 'invalid_audio' | 'rate_limit';
  retryable: boolean;
}

// ============================================================================
// Main Transcription Function
// ============================================================================

/**
 * Transcribe audio message using OpenAI Whisper API with caching
 *
 * @param audioId - WhatsApp audio media ID
 * @param audioSha256 - SHA256 hash for caching
 * @param openaiApiKey - OpenAI API key
 * @param whatsappAccessToken - WhatsApp access token for downloading
 * @param conversationsKV - KV namespace for caching transcriptions
 * @returns Transcription result or error
 */
export async function transcribeAudioMessage(
  audioId: string,
  audioSha256: string | undefined,
  openaiApiKey: string,
  whatsappAccessToken: string,
  conversationsKV: KVNamespace
): Promise<TranscriptionResult | TranscriptionError> {
  try {
    // Check cache first if we have SHA256
    if (audioSha256) {
      const cached = await getCachedTranscription(conversationsKV, audioSha256);
      if (cached) {
        console.log(`Cache hit for audio ${audioSha256.substring(0, 8)}...`);
        return {
          ...cached,
          cached: true
        };
      }
    }

    // Download audio from WhatsApp
    console.log(`Downloading audio ${audioId}...`);
    let audioData;
    try {
      audioData = await downloadAudio(audioId, whatsappAccessToken);
    } catch (error) {
      console.error('Failed to download audio:', error);
      return {
        error: 'Failed to download audio file from WhatsApp',
        type: 'download_failed',
        retryable: true
      };
    }

    // Validate audio size (Whisper limit: 25MB)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioData.fileSize > maxSize) {
      return {
        error: `Audio file too large: ${(audioData.fileSize / 1024 / 1024).toFixed(1)}MB (max 25MB)`,
        type: 'invalid_audio',
        retryable: false
      };
    }

    // Transcribe using Whisper API
    console.log(`Transcribing audio (${(audioData.fileSize / 1024).toFixed(1)}KB)...`);
    const result = await transcribeWithWhisper(audioData.data, audioData.mimeType, openaiApiKey);

    // Check confidence
    const confidence = assessConfidence(result.text);

    const transcriptionResult: TranscriptionResult = {
      text: result.text,
      language: result.language || null,
      duration: result.duration || null,
      confidence,
      cached: false
    };

    // Cache the result if we have SHA256
    if (audioSha256) {
      await cacheTranscription(conversationsKV, audioSha256, transcriptionResult);
    }

    console.log(`Transcription complete: "${result.text.substring(0, 50)}..." (${result.language || 'unknown'}, confidence: ${confidence})`);
    return transcriptionResult;

  } catch (error) {
    console.error('Transcription error:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown transcription error',
      type: 'transcription_failed',
      retryable: true
    };
  }
}

// ============================================================================
// Whisper API Integration
// ============================================================================

interface WhisperResponse {
  text: string;
  language?: string;
  duration?: number;
}

/**
 * Call OpenAI Whisper API to transcribe audio
 *
 * @param audioBuffer - Audio file as ArrayBuffer
 * @param mimeType - Audio MIME type
 * @param apiKey - OpenAI API key
 * @returns Transcription with metadata
 */
async function transcribeWithWhisper(
  audioBuffer: ArrayBuffer,
  mimeType: string,
  apiKey: string
): Promise<WhisperResponse> {
  // Determine file extension from MIME type
  const extension = getFileExtension(mimeType);

  // Create form data
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: mimeType }), `audio.${extension}`);
  formData.append('model', 'whisper-1');
  // Don't specify language - let Whisper auto-detect for multilingual support
  formData.append('response_format', 'verbose_json'); // Get language and duration info

  // Call Whisper API
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Check for rate limit
    if (response.status === 429) {
      throw {
        error: 'OpenAI API rate limit exceeded',
        type: 'rate_limit',
        retryable: true
      };
    }

    throw new Error(`Whisper API error (${response.status}): ${errorText}`);
  }

  const result = await response.json() as WhisperResponse;
  return result;
}

/**
 * Get appropriate file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/amr': 'amr',
    'audio/aac': 'aac'
  };

  return mimeToExt[mimeType] || 'ogg'; // Default to ogg (WhatsApp voice messages)
}

// ============================================================================
// Confidence Assessment
// ============================================================================

/**
 * Assess transcription confidence based on heuristics
 * Whisper doesn't return confidence scores, so we use proxy signals
 *
 * @param text - Transcribed text
 * @returns Confidence level
 */
function assessConfidence(text: string): 'high' | 'medium' | 'low' {
  const words = text.trim().split(/\s+/);
  const wordCount = words.length;

  // Very short transcriptions likely low confidence
  if (wordCount < 2) {
    return 'low';
  }

  // Check for gibberish patterns
  const hasGibberish = words.some(word => {
    // Words with excessive repetition of same character
    return /(.)\1{4,}/.test(word);
  });

  if (hasGibberish) {
    return 'low';
  }

  // Short but coherent
  if (wordCount < 5) {
    return 'medium';
  }

  // Normal length transcription
  return 'high';
}

// ============================================================================
// Caching
// ============================================================================

interface CachedTranscription {
  text: string;
  language: string | null;
  duration: number | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Cache transcription result in KV
 *
 * @param kv - KV namespace
 * @param audioSha256 - Audio file hash
 * @param result - Transcription result
 */
async function cacheTranscription(
  kv: KVNamespace,
  audioSha256: string,
  result: TranscriptionResult
): Promise<void> {
  const cacheKey = `transcription:${audioSha256}`;
  const cacheValue: CachedTranscription = {
    text: result.text,
    language: result.language,
    duration: result.duration,
    confidence: result.confidence
  };

  // Cache for 24 hours (matches WhatsApp media URL expiration)
  const ttl = 24 * 60 * 60; // 24 hours in seconds

  await kv.put(cacheKey, JSON.stringify(cacheValue), {
    expirationTtl: ttl
  });
}

/**
 * Get cached transcription from KV
 *
 * @param kv - KV namespace
 * @param audioSha256 - Audio file hash
 * @returns Cached transcription or null
 */
async function getCachedTranscription(
  kv: KVNamespace,
  audioSha256: string
): Promise<CachedTranscription | null> {
  const cacheKey = `transcription:${audioSha256}`;
  const cached = await kv.get(cacheKey);

  if (!cached) {
    return null;
  }

  try {
    return JSON.parse(cached) as CachedTranscription;
  } catch {
    return null;
  }
}
