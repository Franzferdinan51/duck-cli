/**
 * 🦆 Duck Agent - MiniMax TTS Integration
 * Text-to-speech with MiniMax speech-2.8-hd
 */

export interface TTSConfig {
  apiKey: string;
  voice?: string;
  speed?: number;
  model?: string;
}

export interface TTSOptions {
  text: string;
  voice?: string;
  speed?: number;
  outputPath?: string;
}

// Voice options
export const VOICES = {
  narrator: 'English_expressive_narrator',     // Formal narration (default)
  casual: 'English_expressive_casual',        // Casual conversation
  sad: 'English_expressive_sad',              // Sad/emotional
  chinese: 'Chinese_expressive',
  japanese: 'Japanese_expressive',
  korean: 'Korean_expressive',
} as const;

export type VoiceType = keyof typeof VOICES;

export class TTSService {
  private apiKey: string;
  private voice: string;
  private speed: number;
  private model: string;
  private dailyUsage: number = 0;
  private dailyLimit: number = 4000;
  private lastReset: Date;

  constructor(config: TTSConfig) {
    this.apiKey = config.apiKey;
    this.voice = config.voice || VOICES.narrator;
    this.speed = config.speed || 1;
    this.model = config.model || 'speech-2.8-hd';
    this.lastReset = new Date();
    
    // Reset daily at midnight
    this.checkDailyReset();
  }

  /**
   * Check if we need to reset daily counter
   */
  private checkDailyReset(): void {
    const now = new Date();
    if (now.getDate() !== this.lastReset.getDate()) {
      this.dailyUsage = 0;
      this.lastReset = now;
    }
  }

  /**
   * Get remaining daily quota
   */
  getRemainingQuota(): number {
    this.checkDailyReset();
    return Math.max(0, this.dailyLimit - this.dailyUsage);
  }

  /**
   * Set voice
   */
  setVoice(voice: VoiceType | string): void {
    if (voice in VOICES) {
      this.voice = VOICES[voice as VoiceType];
    } else {
      this.voice = voice;
    }
  }

  /**
   * Convert text to speech
   */
  async speak(options: TTSOptions): Promise<{ success: boolean; path?: string; chars?: number; error?: string }> {
    this.checkDailyReset();

    const { text, voice, speed, outputPath } = {
      text: options.text || '',
      voice: options.voice || this.voice,
      speed: options.speed || this.speed,
      outputPath: options.outputPath || './tts_output.mp3',
    };

    // Check quota
    if (text.length > this.getRemainingQuota()) {
      return {
        success: false,
        error: `Text too long (${text.length} chars). Remaining quota: ${this.getRemainingQuota()}`
      };
    }

    try {
      const response = await fetch('https://api.minimax.io/v1/t2a_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          text: text,
          voice_setting: {
            voice_id: voice,
            speed: speed,
          },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: 'mp3',
            channel: 1,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `TTS API error: ${error}` };
      }

      const data: any = await response.json();

      if (data.code !== 0 && !data.data?.audio) {
        return { success: false, error: data.msg || 'TTS generation failed' };
      }

      // Decode hex audio to binary
      const audioHex = data.data.audio;
      const audioBytes = Buffer.from(audioHex, 'hex');

      // Write to file
      const { writeFileSync } = await import('fs');
      writeFileSync(outputPath, audioBytes);

      // Update usage
      this.dailyUsage += text.length;

      return {
        success: true,
        path: outputPath,
        chars: text.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown TTS error',
      };
    }
  }

  /**
   * Speak and play immediately
   */
  async speakAndPlay(text: string, voice?: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.speak({ text, voice });
    
    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Play the audio
    try {
      const { execSync } = await import('child_process');
      execSync(`afplay "${result.path}"`, { stdio: 'ignore' });
      return { success: true };
    } catch {
      // afplay might not be available on all systems
      return { success: true }; // File was generated successfully
    }
  }

  /**
   * Get available voices
   */
  static getVoices(): Record<string, string> {
    return { ...VOICES };
  }
}

// Default TTS instance
let ttsInstance: TTSService | null = null;

export function getTTS(): TTSService {
  if (!ttsInstance) {
    const apiKey = process.env.MINIMAX_API_KEY || '';
    if (!apiKey) {
      throw new Error('MINIMAX_API_KEY not set');
    }
    ttsInstance = new TTSService({ apiKey });
  }
  return ttsInstance;
}

export default TTSService;
