/**
 * 🦆 Duck Agent - Voice Conversation Mode
 * Continuous voice interaction: listen → transcribe → respond → speak
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { promisify } from 'util';
import { exec as execSync } from 'child_process';
import { Agent } from '../agent/core.js';
import { TTSService } from '../tools/tts.js';

const execAsync = promisify(execSync);

export interface TalkConfig {
  agent: Agent;
  voice?: string;
  continuous?: boolean;
  maxDuration?: number;
}

export class VoiceConversation {
  private agent: Agent;
  private voice: string;
  private continuous: boolean;
  private maxDuration: number;
  private running = false;
  private tts: TTSService;

  constructor(config: TalkConfig) {
    this.agent = config.agent;
    this.voice = config.voice ?? 'English_expressive_casual';
    this.continuous = config.continuous ?? true;
    this.maxDuration = config.maxDuration ?? 30000;
    
    const apiKey = process.env.MINIMAX_API_KEY || process.env.MINIMAX_API_KEY_2 || '';
    this.tts = new TTSService({ apiKey, voice: this.voice });
  }

  /** Start voice conversation loop */
  async start(): Promise<void> {
    this.running = true;
    console.log('🎤 Voice conversation started. Ctrl+C to stop.\n');
    
    while (this.running) {
      try {
        const audio = await this.listenOnce();
        if (!audio || audio.length < 1000) continue;
        
        const text = await this.transcribe(audio);
        if (!text || text.trim().length < 2) continue;
        
        console.log(`👤 You: ${text}`);
        const response = await this.agent.chat(text);
        const responseText = typeof response === 'string' ? response : String((response as any).content || JSON.stringify(response).slice(0, 200));
        
        console.log(`🦆 Duck: ${responseText.slice(0, 100)}\n`);
        await this.speak(responseText);
      } catch (e) {
        console.error('[Voice] Error:', e);
      }
    }
  }

  stop(): void { this.running = false; }

  private async listenOnce(): Promise<Buffer> {
    return new Promise((resolve) => {
      const platform = process.platform;
      const tmpFile = '/tmp/duck_voice.wav';
      let audioData = Buffer.alloc(0);
      
      const timeout = setTimeout(() => {
        proc?.kill();
        resolve(audioData.length > 1000 ? audioData : Buffer.alloc(0));
      }, this.maxDuration);

      let proc: any;
      
      if (platform === 'darwin') {
        if (existsSync('/usr/local/bin/rec')) {
          proc = spawn('rec', ['-r', '16000', '-t', 'wav', tmpFile, 'silence', '1', '0.1', '5%', 'trim', '0', '10'], { stdio: 'ignore' });
        } else {
          clearTimeout(timeout); resolve(Buffer.alloc(0)); return;
        }
      } else if (platform === 'linux') {
        proc = spawn('ffmpeg', ['-loglevel', 'quiet', '-f', 'alsa', '-i', 'default', '-ar', '16000', '-ac', '1', '-t', '10', '-y', tmpFile], { stdio: 'ignore' });
      } else {
        clearTimeout(timeout); resolve(Buffer.alloc(0)); return;
      }

      proc.on('close', () => {
        clearTimeout(timeout);
        if (existsSync(tmpFile)) {
          try {
            const { readFileSync } = require('fs');
            audioData = readFileSync(tmpFile);
            unlinkSync(tmpFile);
          } catch {}
        }
        resolve(audioData.length > 1000 ? audioData : Buffer.alloc(0));
      });
      proc.on('error', () => { clearTimeout(timeout); resolve(Buffer.alloc(0)); });
    });
  }

  private async transcribe(audioData: Buffer): Promise<string> {
    const tmpFile = '/tmp/duck_voice.wav';
    const tmpPy = '/tmp/duck_transcribe.py';
    try {
      writeFileSync(tmpFile, audioData);
      
      if (existsSync('/usr/local/bin/whisper')) {
        try {
          const { stdout } = await execAsync(`whisper "${tmpFile}" --language English --model tiny.en --no-timestamps 2>/dev/null`);
          unlinkSync(tmpFile);
          return stdout.trim();
        } catch {}
      }
      
      const script = "import whisper\nmodel = whisper.load_model('tiny.en')\nresult = model.transcribe('" + tmpFile.replace(/'/g, "'\"'\"'") + "')\nprint(result['text'])";
      writeFileSync(tmpPy, script);
      const { stdout } = await execAsync('python3 "' + tmpPy + '"');
      unlinkSync(tmpFile); unlinkSync(tmpPy);
      return stdout.trim();
    } catch {
      try { unlinkSync(tmpFile); unlinkSync(tmpPy); } catch {}
      return '';
    }
  }

  private async speak(text: string): Promise<void> {
    try {
      await this.tts.speak({ text, voice: this.voice });
    } catch {}
  }
}

export default VoiceConversation;
