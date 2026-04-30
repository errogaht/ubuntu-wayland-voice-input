const SimpleAudioRecorder = require('./SimpleAudioRecorder');
const ProviderFactory = require('./providers/ProviderFactory');
const ClipboardManager = require('./ClipboardManager');
const SimpleSoundNotifier = require('./SimpleSoundNotifier');
const AudioFileProcessor = require('./AudioFileProcessor');
const { createLogger } = require('./LogManager');
const fs = require('fs');
const path = require('path');

class VoiceInputApp {
  constructor(config = {}) {
    this.config = {
      recordingTimeoutMs: config.recordingTimeoutMs || 5000,
      typingDelay: config.typingDelay || 100,
      maxBackupRecordings: config.maxBackupRecordings || 5,
      deleteBackupAfterSuccess: config.deleteBackupAfterSuccess !== undefined
        ? config.deleteBackupAfterSuccess
        : (process.env.DELETE_BACKUP_AFTER_SUCCESS !== 'false'), // Default: true, unless explicitly set to 'false'
      transcriptionProvider: config.transcriptionProvider || process.env.TRANSCRIPTION_PROVIDER,
      ...config
    };

    // Lazy loading: Don't create transcription provider until needed
    // This saves ~50-100ms on startup
    this.transcriber = null;

    // Audio compression settings from environment
    const enableCompression = process.env.ENABLE_COMPRESSION !== 'false'; // Default: true
    const compressionFormat = process.env.COMPRESSION_FORMAT || 'opus';
    const compressionBitrate = process.env.COMPRESSION_BITRATE || '32k';

    this.audioRecorder = new SimpleAudioRecorder({
      device: 'default',
      enableCompression,
      compressionFormat,
      compressionBitrate
    });

    this.clipboardManager = new ClipboardManager();

    this.soundNotifier = new SimpleSoundNotifier({
      enabled: this.config.soundNotifications !== false // Default enabled
    });

    this.logger = createLogger();
    this.sessionId = this.generateSessionId();

    this.isRunning = false;
    this.backupFilePath = null;
    this.backupDir = path.join(__dirname, '../var/recordings');
    this.configFilePath = path.join(__dirname, '../config.json');
    this.vocabularyFilePath = path.join(__dirname, '../vocabulary.json');
    this.audioFileProcessor = new AudioFileProcessor({
      compressionFormat,
      compressionBitrate
    });

    // Load UI settings from config.json
    this.uiConfig = this.loadUIConfig();

    // Load custom vocabulary for post-processing
    this.vocabulary = this.loadVocabulary();
  }

  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Load UI configuration from config.json
   * @returns {Object} UI configuration
   */
  loadUIConfig() {
    const defaultUIConfig = {
      mode: 'normal',
      addPrefix: true,
      addReviewerPrefix: false,
      addSuffix: true,
      notebookBuffer: []
    };

    try {
      if (fs.existsSync(this.configFilePath)) {
        const configData = fs.readFileSync(this.configFilePath, 'utf8');
        return { ...defaultUIConfig, ...JSON.parse(configData) };
      }
    } catch (error) {
      console.error('[VoiceInputApp] Failed to load UI config:', error.message);
    }

    // Return default config if file doesn't exist or is invalid
    return defaultUIConfig;
  }

  /**
   * Load custom vocabulary from vocabulary.json for post-processing
   * @returns {Object|null} Vocabulary object with replacements or null
   */
  loadVocabulary() {
    try {
      if (fs.existsSync(this.vocabularyFilePath)) {
        const vocabData = fs.readFileSync(this.vocabularyFilePath, 'utf8');
        const vocab = JSON.parse(vocabData);
        if (vocab.replacements && Object.keys(vocab.replacements).length > 0) {
          console.log(`📖 Loaded vocabulary: ${Object.keys(vocab.replacements).length} replacements`);
          return vocab;
        }
      }
    } catch (error) {
      console.error('[VoiceInputApp] Failed to load vocabulary:', error.message);
    }
    return null;
  }

  /**
   * Apply vocabulary replacements to transcription text
   * Case-insensitive matching, preserves original case boundaries
   * @param {string} text - Transcription text
   * @returns {string} - Text with replacements applied
   */
  applyVocabulary(text) {
    if (!this.vocabulary || !this.vocabulary.replacements || !text) {
      return text;
    }

    let result = text;
    let replacementCount = 0;

    for (const [pattern, replacement] of Object.entries(this.vocabulary.replacements)) {
      // Create case-insensitive regex with word boundaries
      const regex = new RegExp(`\\b${this.escapeRegex(pattern)}\\b`, 'gi');
      const before = result;
      result = result.replace(regex, replacement);
      if (result !== before) {
        replacementCount++;
      }
    }

    if (replacementCount > 0) {
      console.log(`📖 Applied ${replacementCount} vocabulary replacements`);
    }

    return result;
  }

  /**
   * Escape special regex characters in a string
   * @param {string} string - String to escape
   * @returns {string} - Escaped string
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Save UI configuration to config.json
   */
  saveUIConfig() {
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.uiConfig, null, 2), 'utf8');
    } catch (error) {
      console.error('[VoiceInputApp] Failed to save UI config:', error.message);
    }
  }

  /**
   * Save recording to backup directory
   * @param {Buffer} audioBuffer - The audio data to save
   */
  async saveRecordingBackup(audioBuffer) {
    try {
      // Ensure backup directory exists
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      // Detect file extension from buffer metadata (set by compression)
      const audioExtension = audioBuffer._audioExtension || 'wav';
      const audioFormat = audioBuffer._audioFormat || 'wav';

      // Save recording with session ID and correct extension
      this.backupFilePath = path.join(this.backupDir, `${this.sessionId}.${audioExtension}`);
      fs.writeFileSync(this.backupFilePath, audioBuffer);

      console.log(`💾 Recording backed up: ${this.backupFilePath} (${audioFormat})`);
      this.logger.logSession(this.sessionId, 'BACKUP_SAVED', {
        path: this.backupFilePath,
        size: audioBuffer.length,
        format: audioFormat
      });

      // Cleanup old backups
      await this.cleanupOldBackups();

    } catch (error) {
      console.error('[VoiceInputApp] Failed to save recording backup:', error.message);
      this.logger.logError(this.sessionId, error, 'backup');
    }
  }

  /**
   * Cleanup old backups, keeping only the latest N recordings
   */
  async cleanupOldBackups() {
    try {
      // Support all audio formats (wav, ogg, mp3, etc.)
      const audioExtensions = ['.wav', '.ogg', '.mp3', '.opus', '.m4a', '.flac'];
      const files = fs.readdirSync(this.backupDir)
        .filter(file => audioExtensions.some(ext => file.endsWith(ext)))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          time: fs.statSync(path.join(this.backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Sort by time, newest first

      // Keep only the latest N recordings
      const toDelete = files.slice(this.config.maxBackupRecordings);

      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(`🗑️ Deleted old backup: ${file.name}`);
      }

    } catch (error) {
      console.error('[VoiceInputApp] Failed to cleanup old backups:', error.message);
    }
  }

  /**
   * Delete backup recording after successful transcription
   */
  deleteBackup() {
    if (this.backupFilePath && fs.existsSync(this.backupFilePath)) {
      try {
        fs.unlinkSync(this.backupFilePath);
        console.log(`🗑️ Backup deleted after successful transcription`);
        this.backupFilePath = null;
      } catch (error) {
        console.error('[VoiceInputApp] Failed to delete backup:', error.message);
      }
    }
  }

  async initialize() {
    console.log('🎤 Initializing...');
    this.logger.logSession(this.sessionId, 'INIT_START');

    try {
      // Get the default microphone from Ubuntu settings
      const defaultDevice = await SimpleAudioRecorder.getDefaultMicrophone();

      // Recreate SimpleAudioRecorder with the correct device
      this.audioRecorder = new SimpleAudioRecorder({
        device: defaultDevice
      });

      // Skip system checks on startup - they'll fail naturally if something is wrong
      // This saves ~20-30ms on each start
      // Old code checked: checkMicrophoneAccess(), checkClipboardInstallation()

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

      // Save backup before transcription
      await this.saveRecordingBackup(audioBuffer);

      const transcription = await this.transcribeAudio(audioBuffer);
      await this.copyTranscriptionToClipboard(transcription);

      // Delete backup after successful transcription (if enabled)
      if (this.config.deleteBackupAfterSuccess) {
        this.deleteBackup();
      } else {
        console.log('💾 Backup retained:', this.backupFilePath);
      }

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

  /**
   * Transcribe one or more existing audio files without touching microphone
   * recording state. This is the Nautilus/right-click entrypoint, so it keeps
   * the same transcription, vocabulary, notebook, clipboard, and sound behavior
   * as the hotkey flow while intentionally skipping backup creation.
   *
   * @param {string[]} filePaths - User-selected audio files.
   * @returns {Promise<string>} Raw transcription text before clipboard prefixes.
   */
  async runFromAudioFiles(filePaths) {
    if (this.isRunning) {
      console.log('⚠️ Already running');
      return '';
    }

    this.isRunning = true;
    let temporaryMergedPath = null;

    try {
      await this.soundNotifier.initialize();

      const sortedFiles = AudioFileProcessor.validateAndSortFiles(filePaths);
      console.log(`📁 Transcribing ${sortedFiles.length} selected audio file(s)`);
      sortedFiles.forEach((filePath, index) => {
        console.log(`  ${index + 1}. ${filePath}`);
      });

      this.logger.logSession(this.sessionId, 'FILE_TRANSCRIPTION_START', {
        fileCount: sortedFiles.length,
        files: sortedFiles
      });

      let audioBuffer;

      if (sortedFiles.length === 1) {
        audioBuffer = this.audioFileProcessor.readAudioBuffer(sortedFiles[0]);
        this.logger.logSession(this.sessionId, 'FILE_TRANSCRIPTION_INPUT', {
          path: sortedFiles[0],
          size: audioBuffer.length,
          format: audioBuffer._audioFormat
        });
      } else {
        const merged = await this.audioFileProcessor.mergeAudioFiles(sortedFiles);
        temporaryMergedPath = merged.path;
        audioBuffer = fs.readFileSync(merged.path);
        audioBuffer._audioFormat = merged.format;
        audioBuffer._audioExtension = merged.extension;

        this.logger.logSession(this.sessionId, 'FILE_TRANSCRIPTION_MERGED', {
          path: merged.path,
          size: audioBuffer.length,
          format: merged.format,
          sourceCount: sortedFiles.length
        });
      }

      const transcription = await this.transcribeAudio(audioBuffer);
      await this.copyTranscriptionToClipboard(transcription);

      console.log('✅ File transcription completed');
      this.logger.logSession(this.sessionId, 'FILE_TRANSCRIPTION_COMPLETE', {
        fileCount: sortedFiles.length
      });

      return transcription;

    } catch (error) {
      console.error('[VoiceInputApp] File transcription failed:', error.message);
      this.logger.logError(this.sessionId, error, 'file-transcription');

      try {
        await this.soundNotifier.playError();
      } catch (soundError) {
        console.error('[VoiceInputApp] Error playing error sound:', soundError.message);
      }

      throw error;

    } finally {
      if (temporaryMergedPath && fs.existsSync(temporaryMergedPath)) {
        try {
          fs.unlinkSync(temporaryMergedPath);
        } catch (error) {
          console.error('[VoiceInputApp] Failed to cleanup merged temp file:', error.message);
        }
      }

      this.isRunning = false;
      this.cleanup();
    }
  }

  /**
   * Keep all clipboard-facing post-processing in one place so microphone and
   * file transcription modes cannot drift in notebook/prefix/suffix behavior.
   *
   * @param {string} transcription - Raw provider output after vocabulary fixes.
   */
  async copyTranscriptionToClipboard(transcription) {
    // Reload config to check current mode
    this.uiConfig = this.loadUIConfig();

    if (this.uiConfig.mode === 'notebook') {
      // Notebook mode: accumulate transcriptions
      console.log('📓 Notebook mode: adding to buffer');
      this.uiConfig.notebookBuffer.push(transcription);
      this.saveUIConfig();

      // Copy accumulated buffer (join with newline)
      const accumulatedText = this.uiConfig.notebookBuffer.join('\n');
      await this.copyText(accumulatedText);

      console.log(`📓 Buffer size: ${this.uiConfig.notebookBuffer.length} recordings`);
    } else {
      // Normal mode: copy single transcription
      await this.copyText(transcription);
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


  /**
   * Lazy-load transcription provider when first needed
   * @private
   */
  _ensureTranscriberLoaded() {
    if (this.transcriber) {
      return; // Already loaded
    }

    try {
      if (this.config.transcriptionProvider) {
        // Use explicitly specified provider
        this.transcriber = ProviderFactory.create(
          this.config.transcriptionProvider,
          ProviderFactory._buildConfigFromEnv(this.config.transcriptionProvider, process.env),
          this.logger,
          this.sessionId
        );
      } else {
        // Auto-detect provider from environment
        this.transcriber = ProviderFactory.autoDetect(process.env, this.logger, this.sessionId);
      }
    } catch (error) {
      console.error('[VoiceInputApp] Transcription provider initialization failed:', error.message);
      console.error('\nAvailable providers:', ProviderFactory.getAvailableProviders().join(', '));
      console.error('\nProvider requirements:');
      ProviderFactory.getAllRequirements().forEach(req => {
        console.error(`\n${req.name}:`);
        console.error(`  Required: ${req.configKeys.join(', ')}`);
        if (req.optionalKeys) {
          console.error(`  Optional: ${req.optionalKeys.join(', ')}`);
        }
        console.error(`  ${req.documentation}`);
      });
      throw error;
    }
  }

  async transcribeAudio(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('No audio data recorded');
    }

    // Lazy load transcription provider
    this._ensureTranscriberLoaded();

    console.log('🔄 Transcribing...');

    try {
      let transcription = await this.transcriber.transcribe(audioBuffer);

      // Apply vocabulary replacements (IT terms, etc.)
      transcription = this.applyVocabulary(transcription);

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
   * Preserves existing line breaks (important for Notebook Mode)
   * @param {string} text - The text to format
   * @returns {string} - Formatted multi-line text
   */
  formatTextToMultiLine(text) {
    if (!text || text.trim().length === 0) {
      return text;
    }

    const maxLineLength = 120; // Maximum line length for readability

    // Split by newlines first to preserve them (Notebook Mode)
    const existingLines = text.split('\n');
    const formattedLines = [];

    // Process each existing line separately
    for (const line of existingLines) {
      if (!line.trim()) {
        formattedLines.push(''); // Preserve empty lines
        continue;
      }

      const words = line.split(/\s+/); // Split by whitespace (but not newlines)
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
            formattedLines.push(currentLine);
            currentLine = word;
          }
        }
      }

      // Add the last line
      if (currentLine.length > 0) {
        formattedLines.push(currentLine);
      }
    }

    return formattedLines.join('\n');
  }

  async copyText(text) {
    if (!text || text.trim().length === 0) {
      console.log('⚠️ No text to copy');
      return;
    }

    // Reload config to get latest settings from tray
    this.uiConfig = this.loadUIConfig();

    // Format text into multiple lines for better readability
    const formattedText = this.formatTextToMultiLine(text);

    // Apply prefix/suffix based on config
    let finalText = formattedText;

    if (this.uiConfig.addReviewerPrefix) {
      finalText = '[Reviewer comment]: ' + finalText;
    } else if (this.uiConfig.addPrefix) {
      finalText = '[Voice - verify]: ' + finalText;
    }

    if (this.uiConfig.addSuffix) {
      finalText = finalText + '. ultrathink';
    }

    console.log(`💬 Text: "${finalText}"`);

    try {
      // Copy text to clipboard
      await this.clipboardManager.copyText(finalText);

      // Play ready sound - double beep indicates text is ready to paste
      console.log('🔊 Playing ready sound...');
      await this.soundNotifier.playTextReady();

      console.log('📋 Text copied! Press Ctrl+V to paste anywhere.');
      this.logger.logSession(this.sessionId, 'CLIPBOARD_SUCCESS', { textLength: finalText.length });

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
