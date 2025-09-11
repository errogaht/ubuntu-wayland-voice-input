const EventEmitter = require('events');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class SimpleAudioRecorder extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      device: options.device || 'default',
      sampleRate: options.sampleRate || 16000,
      channels: options.channels || 1,
      format: options.format || 'wav',
      ...options
    };

    this.isRecording = false;
    this.recordingProcess = null;
    this.audioBuffer = [];
    this.tempFile = null;
  }

  async startRecording() {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('🔴 Recording started - press hotkey again to stop');
        
        // Create temporary file for recording
        this.tempFile = path.join('/tmp', `voice-input-${Date.now()}.wav`);
        
        // Start arecord process
        const arecordArgs = [
          '-D', this.options.device,
          '-f', 'S16_LE',
          '-c', this.options.channels.toString(),
          '-r', this.options.sampleRate.toString(),
          this.tempFile
        ];

        this.recordingProcess = spawn('arecord', arecordArgs, {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        this.isRecording = true;

        this.recordingProcess.on('error', (error) => {
          console.error('[SimpleAudioRecorder] Recording error:', error);
          this.isRecording = false;
          this.cleanup();
          reject(error);
        });

        this.recordingProcess.stderr.on('data', (data) => {
          const errorText = data.toString();
          if (errorText.includes('overrun')) {
            // Audio overruns are common and not critical
            return;
          }
          console.error('[SimpleAudioRecorder] arecord stderr:', errorText.trim());
        });

        // Recording started successfully
        this.emit('recordingStarted');
        resolve();

      } catch (error) {
        console.error('[SimpleAudioRecorder] Failed to start recording:', error);
        this.isRecording = false;
        reject(error);
      }
    });
  }

  async stopRecording() {
    if (!this.isRecording || !this.recordingProcess) {
      console.log('⚠️ No recording in progress');
      return null;
    }

    return new Promise((resolve, reject) => {
      console.log('🔴 Stopping recording...');

      const cleanup = (audioData) => {
        this.isRecording = false;
        this.recordingProcess = null;
        
        if (this.tempFile && fs.existsSync(this.tempFile)) {
          try {
            fs.unlinkSync(this.tempFile);
          } catch (error) {
            console.error('⚠️ Failed to cleanup temp file:', error.message);
          }
        }
        
        this.emit('recordingStopped', audioData);
        resolve(audioData);
      };

      // Gracefully terminate arecord
      if (this.recordingProcess && !this.recordingProcess.killed) {
        this.recordingProcess.on('exit', () => {
          // Read the recorded file
          if (this.tempFile && fs.existsSync(this.tempFile)) {
            try {
              const audioData = fs.readFileSync(this.tempFile);
              if (audioData.length > 44) { // WAV header is 44 bytes
                cleanup(audioData);
              } else {
                console.log('⚠️ Recording too short');
                cleanup(null);
              }
            } catch (error) {
              console.error('❌ Failed to read recorded file:', error);
              cleanup(null);
            }
          } else {
            console.log('⚠️ No recorded file found');
            cleanup(null);
          }
        });

        // Send SIGTERM to arecord
        this.recordingProcess.kill('SIGTERM');
        
      } else {
        cleanup(null);
      }
    });
  }

  cleanup() {
    if (this.recordingProcess && !this.recordingProcess.killed) {
      try {
        this.recordingProcess.kill('SIGKILL');
      } catch (error) {
        // Process might already be dead
      }
    }
    
    if (this.tempFile && fs.existsSync(this.tempFile)) {
      try {
        fs.unlinkSync(this.tempFile);
      } catch (error) {
        // File might already be deleted
      }
    }
    
    this.isRecording = false;
    this.recordingProcess = null;
    this.tempFile = null;
  }

  // Static methods for compatibility
  static async getDefaultMicrophone() {
    // Return default ALSA device
    return 'default';
  }

  static async checkMicrophoneAccess() {
    return new Promise((resolve) => {
      // Test if arecord is available
      const testProcess = spawn('which', ['arecord'], {
        stdio: 'ignore'
      });

      testProcess.on('close', (code) => {
        resolve(code === 0);
      });

      testProcess.on('error', () => {
        resolve(false);
      });
    });
  }
}

module.exports = SimpleAudioRecorder;