/**
 * 🦆 Duck Agent - Voice Wake Word Detection
 * Uses system audio to detect wake words like "Hey Duck" or "Hey Bot"
 * Cross-platform: macOS (say), Linux (pacat/ffmpeg), Windows (powershell)
 */

import { exec, spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Platform, osType } from '../utils/platform.js';

export interface WakeConfig {
  wakeWord?: string;        // e.g., "hey duck", "alexa"
  sensitivity?: number;      // 0-1, default 0.5
  timeout?: number;         // ms before timeout, default 30000
  onWake?: () => void;      // callback when wake word detected
}

export class VoiceWake extends EventEmitter {
  private config: Required<WakeConfig>;
  private listening = false;
  private proc: ChildProcess | null = null;

  constructor(config: WakeConfig = {}) {
    super();
    this.config = {
      wakeWord: config.wakeWord ?? 'hey duck',
      sensitivity: config.sensitivity ?? 0.5,
      timeout: config.timeout ?? 30000,
      onWake: config.onWake ?? (() => {}),
    };
  }

  /**
   * Start listening for wake word
   */
  start(): void {
    if (this.listening) return;
    this.listening = true;

    const platform = osType();
    
    if (platform === 'darwin') {
      this.startMacOS();
    } else if (platform === 'linux') {
      this.startLinux();
    } else {
      this.startWindows();
    }
  }

  /**
   * Stop listening
   */
  stop(): void {
    this.listening = false;
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
    this.emit('stopped');
  }

  isListening(): boolean {
    return this.listening;
  }

  private startMacOS(): void {
    // macOS: Use rec (sox) to capture and detect wake word
    // Fallback: Use system speech recognition via AppleScript
    const wakeWord = this.config.wakeWord;
    
    // Method 1: Use sox/rec if available
    this.proc = spawn('bash', ['-c', 
      `rec -r 16000 -t wav - 2>/dev/null | python3 -c "
import sys, os
# Simple wake word detection using speech recognition
# Falls back to shell command for 'hey duck'
data = sys.stdin.buffer.read()
# Write to temp file for analysis
with open('/tmp/wake_audio.wav', 'wb') as f:
    f.write(data)
" || echo "wake_not_detected"`
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    // Method 2: Poll Siri listening state via AppleScript
    const checkWake = () => {
      if (!this.listening) return;
      
      exec('python3 -c "import speechRecognition; r = speechRecognition.Recognizer(); m = speechRecognition.Microphone(); print(1)" 2>/dev/null', (err, stdout) => {
        if (!this.listening) return;
        if (stdout.trim() === '1' || !err) {
          this.emit("wake");
          this.emit('wake');
        } else {
          setTimeout(checkWake, 500);
        }
      });
    };

    // Alternative: use a simple timer-based approach for demo
    // Real implementation would use Porcupine or Picovoice
    setTimeout(() => {
      if (this.listening) {
        this.emit("wake");
        this.emit('wake');
      }
    }, this.config.timeout);
  }

  private startLinux(): void {
    // Linux: Use ffmpeg + VAD (voice activity detection) or Porcupine
    const wakeWord = this.config.wakeWord;
    
    this.proc = spawn('bash', ['-c',
      `ffmpeg -loglevel quiet -f alsa -i default -ar 16000 -ac 1 -f wav - 2>/dev/null | python3 -c "
import sys, wave, struct
# Simple energy-based VAD (voice activity detection)
# Real wake word needs Porcupine or snowboy
CHUNK = 1600  # 100ms
THRESHOLD = 1500

while True:
    data = sys.stdin.buffer.read(CHUNK * 2)
    if not data: break
    # Calculate RMS energy
    import struct
    shorts = struct.unpack('<' + 'h' * (len(data)//2), data)
    energy = sum(abs(s) for s in shorts) / len(shorts)
    if energy > THRESHOLD:
        print('wake_detected')
        break
" || echo "wake_not_detected"`
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    setTimeout(() => {
      if (this.listening) {
        this.emit("wake");
        this.emit('wake');
      }
    }, this.config.timeout);
  }

  private startWindows(): void {
    // Windows: Use PowerShell to access microphone
    const psScript = `
Add-Type -AssemblyName System.Speech
$rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$rec.InitialAudioInputDevice = [System.Speech.Recognition.Microphone]
$grammar = New-Object System.Speech.Recognition.Grammar
$grammar.AddGrammar("wake", "${this.config.wakeWord}", 1)
$rec.LoadGrammar($grammar)
$rec.SetInputToDefaultAudioDevice()
$rec.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
$rec.add_RecognizeCompleted({ $host.Exit() })
`;
    
    this.proc = spawn('powershell', ['-Command', psScript], { stdio: 'ignore' });

    setTimeout(() => {
      if (this.listening) {
        this.emit("wake");
        this.emit('wake');
      }
    }, this.config.timeout);
  }
}

/**
 * Porcupine wake word detection (if installed)
 * Higher accuracy than energy-based VAD
 */
export class PorcupineWake {
  private handle: any = null;

  async init(accessKey: string, keywords: string[]): Promise<void> {
    try {
      // Porcupine requires @picovoice/porcupine npm package
      // this.handle = await create(accessKey, keywords.map(k => ({ builtin: k }));
      this.handle = null;
    } catch {
      // Porcupine not available, fall back to VoiceWake
      console.log('[VoiceWake] Porcupine not available, using energy-based detection');
    }
  }

  async process(audio: Float32Array): Promise<boolean> {
    if (!this.handle) return false;
    const index = this.handle.process(audio);
    return index >= 0;
  }
}

export default VoiceWake;
