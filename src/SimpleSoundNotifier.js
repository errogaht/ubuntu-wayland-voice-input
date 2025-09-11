const { spawn } = require('child_process');
const path = require('path');

class SimpleSoundNotifier {
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled !== false,
      volume: options.volume || 0.5,
      startSound: path.join(__dirname, '..', 'notification.mp3'),
      endSound: path.join(__dirname, '..', 'end-recording.wav'),
      errorSound: path.join(__dirname, '..', 'error.wav'),
      ...options
    };
  }

  async initialize() {
    if (!this.options.enabled) {
      console.log('[SimpleSoundNotifier] Sound notifications disabled');
      return;
    }
    
    console.log('[SimpleSoundNotifier] Sound notifications enabled 🔊');
  }

  async playSound(soundFile) {
    if (!this.options.enabled) return;
    
    return new Promise((resolve) => {
      // Try paplay first (works with both MP3 and WAV)
      // Use lower volume for error sound
      const volume = soundFile.includes('error') ? '16384' : '32768';
      const playProcess = spawn('paplay', ['--volume', volume, soundFile], {
        stdio: 'ignore'
      });

      playProcess.on('close', () => {
        resolve();
      });

      playProcess.on('error', () => {
        // Fallback to mpg123 for MP3 files
        if (soundFile.endsWith('.mp3')) {
          const fallbackProcess = spawn('mpg123', ['-q', soundFile], {
            stdio: 'ignore'
          });
          
          fallbackProcess.on('close', () => {
            resolve();
          });
          
          fallbackProcess.on('error', () => {
            resolve(); // Silent fail
          });
        } else {
          // For WAV files, try aplay
          const fallbackProcess = spawn('aplay', ['-q', soundFile], {
            stdio: 'ignore'
          });
          
          fallbackProcess.on('close', () => {
            resolve();
          });
          
          fallbackProcess.on('error', () => {
            resolve(); // Silent fail
          });
        }
      });
    });
  }

  // Event-specific sound methods
  async playStartRecording() {
    await this.playSound(this.options.startSound);
  }

  async playEndRecording() {
    await this.playSound(this.options.endSound);
  }

  async playTextReady() {
    await this.playSound(this.options.startSound); // Same as start for text ready
  }

  async playError() {
    await this.playSound(this.options.errorSound);
  }

  cleanup() {
    // No cleanup needed for simple sound
  }
}

module.exports = SimpleSoundNotifier;