const SimpleAudioRecorder = require('./SimpleAudioRecorder');
const NexaraTranscriber = require('./NexaraTranscriber');
const ClipboardManager = require('./ClipboardManager');
const SimpleSoundNotifier = require('./SimpleSoundNotifier');
const { createLogger } = require('./LogManager');

class VoiceInputApp {
  constructor(config = {}) {
    this.config = {
      recordingTimeoutMs: config.recordingTimeoutMs || 5000,
      typingDelay: config.typingDelay || 100,
      nexaraApiKey: config.nexaraApiKey || process.env.NEXARA_API_KEY,
      ...config
    };

    if (!this.config.nexaraApiKey) {
      throw new Error('NEXARA_API_KEY environment variable is required or pass nexaraApiKey in config');
    }

    this.audioRecorder = new SimpleAudioRecorder({
      device: 'default'
    });
    
    this.transcriber = new NexaraTranscriber(this.config.nexaraApiKey);
    
    this.clipboardManager = new ClipboardManager();

    this.soundNotifier = new SimpleSoundNotifier({
      enabled: this.config.soundNotifications !== false // Default enabled
    });

    this.logger = createLogger();
    this.sessionId = this.generateSessionId();
    this.isRunning = false;
  }

  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  async initialize() {
    console.log('🎤 Initializing...');
    this.logger.logSession(this.sessionId, 'INIT_START');
    
    try {
      // Detecting microphone
      
      // Get the default microphone from Ubuntu settings
      const defaultDevice = await SimpleAudioRecorder.getDefaultMicrophone();
      
      // Recreate SimpleAudioRecorder with the correct device
      this.audioRecorder = new SimpleAudioRecorder({
        device: defaultDevice
      });
      
      // Checking system
      
      const microphoneOk = await SimpleAudioRecorder.checkMicrophoneAccess();
      if (!microphoneOk) {
        throw new Error('Microphone access failed. Please check microphone permissions and PulseAudio configuration.');
      }

      const clipboardOk = await ClipboardManager.checkInstallation();
      if (!clipboardOk) {
        throw new Error('wl-clipboard not available. Install: sudo apt install wl-clipboard');
      }

      await this.soundNotifier.initialize();

      console.log('✅ Ready');
      this.logger.logSession(this.sessionId, 'INIT_SUCCESS');
      
    } catch (error) {
      console.error('[VoiceInputApp] Initialization failed:', error.message);
      this.logger.logError(this.sessionId, error, 'initialization');
      throw error;
    }
  }

  async run(stopCallback) {
    if (this.isRunning) {
      console.log('⚠️ Already running');
      return;
    }

    this.isRunning = true;
    
    try {
      console.log('🎤 Starting recording...');
      console.log('🔴 Press hotkey again to stop recording');
      this.logger.logSession(this.sessionId, 'RECORDING_START');
      
      // Start recording and wait for manual stop
      const startTime = Date.now();
      const audioBuffer = await this.startRecordingAndWaitForStop(stopCallback);
      const recordingDuration = Date.now() - startTime;
      
      if (!audioBuffer) {
        console.log('⚠️ No audio recorded');
        this.logger.logSession(this.sessionId, 'RECORDING_EMPTY', { duration: recordingDuration });
        return;
      }
      
      this.logger.logSession(this.sessionId, 'RECORDING_SUCCESS', { 
        duration: recordingDuration,
        audioSize: audioBuffer.length 
      });
      
      const transcription = await this.transcribeAudio(audioBuffer);
      await this.copyText(transcription);
      
      console.log('✅ Completed');
      this.logger.logSession(this.sessionId, 'SESSION_COMPLETE');
      
    } catch (error) {
      console.error('[VoiceInputApp] Voice input session failed:', error.message);
      this.logger.logError(this.sessionId, error, 'session');
      
      // Play error sound
      try {
        await this.soundNotifier.playError();
      } catch (soundError) {
        console.error('[VoiceInputApp] Error playing error sound:', soundError.message);
      }
      
      throw error;
      
    } finally {
      this.isRunning = false;
      this.cleanup();
    }
  }

  async startRecordingAndWaitForStop(stopCallback) {
    return new Promise((resolve, reject) => {
      let audioBuffer = null;

      // Setup stop handler
      const handleStop = async () => {
        try {
          audioBuffer = await this.audioRecorder.stopRecording();
          resolve(audioBuffer);
        } catch (error) {
          reject(error);
        }
      };

      // Call the callback to setup external stop handler
      if (stopCallback) {
        stopCallback(handleStop);
      }

      // Start recording
      this.audioRecorder.once('recordingStarted', () => {
        // Play start recording sound
        this.soundNotifier.playStartRecording().catch(console.error);
      });

      this.audioRecorder.once('recordingStopped', (audioData) => {
        // Play end recording sound
        this.soundNotifier.playEndRecording().catch(console.error);
      });

      // Start the recording
      this.audioRecorder.startRecording()
        .catch((error) => {
          console.error('[VoiceInputApp] Recording start failed:', error.message);
          reject(error);
        });
    });
  }


  async transcribeAudio(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('No audio data recorded');
    }

    console.log('🔄 Transcribing...');
    
    try {
      const transcription = await this.transcriber.transcribe(audioBuffer);
      console.log(`✅ "${transcription}"`);
      this.logger.logTranscription(this.sessionId, transcription);
      return transcription;
      
    } catch (error) {
      console.error('[VoiceInputApp] ❌ Transcription failed:', error.message);
      this.logger.logError(this.sessionId, error, 'transcription');
      
      // Play error sound for transcription failures
      try {
        await this.soundNotifier.playError();
      } catch (soundError) {
        console.error('[VoiceInputApp] Error playing error sound:', soundError.message);
      }
      
      throw error;
    }
  }

  /**
   * Format text into multiple lines by wrapping at word boundaries
   * Keeps lines around 120 characters for comfortable reading
   * @param {string} text - The text to format
   * @returns {string} - Formatted multi-line text
   */
  formatTextToMultiLine(text) {
    if (!text || text.trim().length === 0) {
      return text;
    }

    const maxLineLength = 120; // Maximum line length for readability
    const words = text.split(/\s+/); // Split by whitespace
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if (!word) continue;

      // If current line is empty, start with this word
      if (currentLine.length === 0) {
        currentLine = word;
      } else {
        // Check if adding this word would exceed the recommended length
        const potentialLine = currentLine + ' ' + word;

        if (potentialLine.length <= maxLineLength) {
          // Fits on current line
          currentLine = potentialLine;
        } else {
          // Current line is full, save it and start a new line
          lines.push(currentLine);
          currentLine = word;
        }
      }
    }

    // Add the last line
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  }

  async copyText(text) {
    if (!text || text.trim().length === 0) {
      console.log('⚠️ No text to copy');
      return;
    }

    // Format text into multiple lines for better readability
    const formattedText = this.formatTextToMultiLine(text);
    const textWithPrefixAndSuffix = '[Voice - verify]: ' + formattedText + '. ultrathink';
    console.log(`💬 Text: "${textWithPrefixAndSuffix}"`);

    try {
      // Copy text to clipboard
      await this.clipboardManager.copyText(textWithPrefixAndSuffix);

      // Play ready sound - double beep indicates text is ready to paste
      console.log('🔊 Playing ready sound...');
      await this.soundNotifier.playTextReady();

      console.log('📋 Text copied! Press Ctrl+V to paste anywhere.');
      this.logger.logSession(this.sessionId, 'CLIPBOARD_SUCCESS', { textLength: textWithPrefixAndSuffix.length });

    } catch (error) {
      console.error('❌ Clipboard copy failed:', error.message);
      this.logger.logError(this.sessionId, error, 'clipboard');

      // Play error sound for clipboard failures
      try {
        await this.soundNotifier.playError();
      } catch (soundError) {
        console.error('[VoiceInputApp] Error playing error sound:', soundError.message);
      }

      throw error;
    }
  }

  cleanup() {
    // Cleanup
    
    try {
      this.audioRecorder.cleanup();
    } catch (error) {
      console.error('[VoiceInputApp] Error during cleanup:', error.message);
    }
    
    try {
      this.soundNotifier.cleanup();
    } catch (error) {
      console.error('[VoiceInputApp] Error during sound cleanup:', error.message);
    }
  }

  stop() {
    // Stopping
    this.isRunning = false;
    this.cleanup();
  }
}

module.exports = VoiceInputApp;