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
      enableCompression: options.enableCompression !== false, // Default: enabled
      compressionFormat: options.compressionFormat || 'opus', // opus, mp3, etc.
      compressionBitrate: options.compressionBitrate || '32k', // Good for speech
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

  /**
   * Compress WAV audio file using ffmpeg
   * @param {string} inputPath - Path to input WAV file
   * @returns {Promise<{buffer: Buffer, format: string, extension: string}>} Compressed audio data
   */
  async compressAudio(inputPath) {
    return new Promise((resolve, reject) => {
      const format = this.options.compressionFormat;
      const extension = format === 'opus' ? 'ogg' : format; // Opus uses OGG container
      const outputPath = inputPath.replace('.wav', `.${extension}`);

      console.log(`🗜️ Compressing audio: WAV → ${format.toUpperCase()}...`);

      // Build ffmpeg command based on format
      const ffmpegArgs = [
        '-i', inputPath,
        '-vn', // No video
        '-ar', this.options.sampleRate.toString(), // Sample rate
        '-ac', this.options.channels.toString(), // Channels
        '-b:a', this.options.compressionBitrate, // Bitrate
        '-y' // Overwrite output
      ];

      // Format-specific options
      if (format === 'opus') {
        ffmpegArgs.push('-c:a', 'libopus'); // Opus codec
        ffmpegArgs.push('-application', 'voip'); // Optimize for speech
      } else if (format === 'mp3') {
        ffmpegArgs.push('-c:a', 'libmp3lame'); // MP3 codec
      }

      ffmpegArgs.push(outputPath);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderrOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        stderrOutput += data.toString();
      });

      ffmpeg.on('error', (error) => {
        console.error('❌ ffmpeg not found. Please install: sudo apt install ffmpeg');
        reject(new Error(`ffmpeg error: ${error.message}`));
      });

      ffmpeg.on('exit', (code) => {
        if (code === 0) {
          try {
            const originalSize = fs.statSync(inputPath).size;
            const compressedSize = fs.statSync(outputPath).size;
            const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

            console.log(`✅ Compressed: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${compressionRatio}% smaller)`);

            const buffer = fs.readFileSync(outputPath);

            // Cleanup compressed file
            try {
              fs.unlinkSync(outputPath);
            } catch (error) {
              console.error('⚠️ Failed to cleanup compressed file:', error.message);
            }

            resolve({
              buffer,
              format,
              extension
            });
          } catch (error) {
            reject(new Error(`Failed to read compressed file: ${error.message}`));
          }
        } else {
          console.error('❌ ffmpeg stderr:', stderrOutput);
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });
    });
  }

  async stopRecording() {
    if (!this.isRecording || !this.recordingProcess) {
      console.log('⚠️ No recording in progress');
      return null;
    }

    return new Promise((resolve, reject) => {
      console.log('🔴 Stopping recording...');

      const cleanup = async (audioData) => {
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
        this.recordingProcess.on('exit', async () => {
          // Read the recorded file
          if (this.tempFile && fs.existsSync(this.tempFile)) {
            try {
              const wavData = fs.readFileSync(this.tempFile);
              if (wavData.length <= 44) { // WAV header is 44 bytes
                console.log('⚠️ Recording too short');
                cleanup(null);
                return;
              }

              // Compress audio if enabled
              if (this.options.enableCompression) {
                try {
                  const compressed = await this.compressAudio(this.tempFile);
                  // Attach metadata for providers to use correct content-type
                  compressed.buffer._audioFormat = compressed.format;
                  compressed.buffer._audioExtension = compressed.extension;
                  cleanup(compressed.buffer);
                } catch (error) {
                  console.error('⚠️ Compression failed, using original WAV:', error.message);
                  cleanup(wavData);
                }
              } else {
                cleanup(wavData);
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