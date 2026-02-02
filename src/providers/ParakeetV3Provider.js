const TranscriptionProvider = require('./TranscriptionProvider');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Parakeet V3 Local Transcription Provider
 * Uses sherpa-onnx-node (native bindings) for CPU-based offline speech recognition
 *
 * Model: nvidia/parakeet-tdt-0.6b-v3 (INT8 quantized)
 * Supports 25 European languages including English, Russian, German, French, etc.
 *
 * Setup:
 *   1. Install packages: npm install sherpa-onnx-node sherpa-onnx-linux-x64
 *   2. Download model:
 *      wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2
 *      tar xvf sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2
 *   3. Set PARAKEET_MODEL_PATH in .env
 *   4. Set LD_LIBRARY_PATH (add to run.sh or .bashrc)
 *
 * Important: Model stays loaded in RAM for fast subsequent transcriptions!
 */

// Singleton recognizer - keeps model in RAM
let recognizerInstance = null;
let recognizerModelPath = null;

class ParakeetV3Provider extends TranscriptionProvider {
  constructor(config, logger = null, sessionId = null) {
    super(config, logger, sessionId);

    // Model path is required
    this.modelPath = config.modelPath;
    if (!this.modelPath) {
      throw new Error('Parakeet V3 model path is required. Set PARAKEET_MODEL_PATH in .env');
    }

    // Resolve to absolute path
    if (!path.isAbsolute(this.modelPath)) {
      this.modelPath = path.resolve(process.cwd(), this.modelPath);
    }

    // Verify model directory exists
    if (!fs.existsSync(this.modelPath)) {
      throw new Error(
        `Parakeet V3 model not found at: ${this.modelPath}\n` +
        'Download with:\n' +
        '  mkdir -p models && cd models\n' +
        '  wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2\n' +
        '  tar xvf sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2'
      );
    }

    // Define model file paths for verification
    this.encoderPath = path.join(this.modelPath, 'encoder.int8.onnx');
    this.decoderPath = path.join(this.modelPath, 'decoder.int8.onnx');
    this.joinerPath = path.join(this.modelPath, 'joiner.int8.onnx');
    this.tokensPath = path.join(this.modelPath, 'tokens.txt');

    // Verify all model files exist
    this._verifyModelFiles();

    // Number of threads for CPU inference
    this.numThreads = config.numThreads || 4;

    // Lazy load sherpa-onnx-node
    this.sherpa = null;
  }

  /**
   * Verify all required model files exist
   * @private
   */
  _verifyModelFiles() {
    const requiredFiles = [
      { path: this.encoderPath, name: 'encoder.int8.onnx' },
      { path: this.decoderPath, name: 'decoder.int8.onnx' },
      { path: this.joinerPath, name: 'joiner.int8.onnx' },
      { path: this.tokensPath, name: 'tokens.txt' }
    ];

    const missing = requiredFiles.filter(f => !fs.existsSync(f.path));
    if (missing.length > 0) {
      throw new Error(
        `Missing model files in ${this.modelPath}:\n` +
        missing.map(f => `  - ${f.name}`).join('\n')
      );
    }
  }

  /**
   * Get or create singleton recognizer (keeps model in RAM)
   * @private
   */
  _getRecognizer() {
    // Return cached recognizer if model path matches
    if (recognizerInstance && recognizerModelPath === this.modelPath) {
      return recognizerInstance;
    }

    // Load sherpa-onnx-node
    if (!this.sherpa) {
      try {
        this.sherpa = require('sherpa-onnx-node');
      } catch (error) {
        throw new Error(
          'sherpa-onnx-node not installed or LD_LIBRARY_PATH not set.\n' +
          'Install with: npm install sherpa-onnx-node sherpa-onnx-linux-x64\n' +
          'Then set: export LD_LIBRARY_PATH=./node_modules/sherpa-onnx-linux-x64:$LD_LIBRARY_PATH\n\n' +
          `Original error: ${error.message}`
        );
      }
    }

    console.log(`[${ParakeetV3Provider.getProviderName()}] Loading model from ${this.modelPath}...`);
    console.log(`[${ParakeetV3Provider.getProviderName()}] Using ${this.numThreads} CPU threads`);

    const config = {
      modelConfig: {
        transducer: {
          encoder: this.encoderPath,
          decoder: this.decoderPath,
          joiner: this.joinerPath,
        },
        tokens: this.tokensPath,
        numThreads: this.numThreads,
        debug: 0,
      },
    };

    recognizerInstance = new this.sherpa.OfflineRecognizer(config);
    recognizerModelPath = this.modelPath;

    console.log(`[${ParakeetV3Provider.getProviderName()}] Model loaded and cached in RAM`);

    return recognizerInstance;
  }

  /**
   * Convert WAV buffer to float32 samples
   * @param {Buffer} wavBuffer - WAV file buffer
   * @returns {Object} - { samples: Float32Array, sampleRate: number }
   * @private
   */
  _wavBufferToSamples(wavBuffer) {
    // Parse WAV header
    const riff = wavBuffer.toString('ascii', 0, 4);
    if (riff !== 'RIFF') {
      throw new Error('Invalid WAV file: missing RIFF header');
    }

    const wave = wavBuffer.toString('ascii', 8, 12);
    if (wave !== 'WAVE') {
      throw new Error('Invalid WAV file: missing WAVE format');
    }

    // Find fmt and data chunks
    let offset = 12;
    let sampleRate = 16000;
    let bitsPerSample = 16;
    let numChannels = 1;

    while (offset < wavBuffer.length - 8) {
      const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
      const chunkSize = wavBuffer.readUInt32LE(offset + 4);

      if (chunkId === 'fmt ') {
        const audioFormat = wavBuffer.readUInt16LE(offset + 8);
        numChannels = wavBuffer.readUInt16LE(offset + 10);
        sampleRate = wavBuffer.readUInt32LE(offset + 12);
        bitsPerSample = wavBuffer.readUInt16LE(offset + 22);

        if (audioFormat !== 1) {
          throw new Error('Only PCM WAV format is supported');
        }
      } else if (chunkId === 'data') {
        const dataStart = offset + 8;
        const dataEnd = dataStart + chunkSize;
        const audioData = wavBuffer.slice(dataStart, Math.min(dataEnd, wavBuffer.length));

        // Convert to float32 samples
        const bytesPerSample = bitsPerSample / 8;
        const numSamples = Math.floor(audioData.length / bytesPerSample / numChannels);
        const samples = new Float32Array(numSamples);

        for (let i = 0; i < numSamples; i++) {
          if (bitsPerSample === 16) {
            const sample = audioData.readInt16LE(i * bytesPerSample * numChannels);
            samples[i] = sample / 32768.0;
          } else if (bitsPerSample === 32) {
            samples[i] = audioData.readFloatLE(i * 4 * numChannels);
          }
        }

        return { samples, sampleRate };
      }

      offset += 8 + chunkSize;
    }

    throw new Error('Invalid WAV file: data chunk not found');
  }

  /**
   * Convert compressed audio (Opus/MP3) to WAV using ffmpeg
   * @param {Buffer} audioBuffer - Compressed audio buffer
   * @param {string} format - Audio format (opus, mp3, ogg)
   * @returns {Promise<Buffer>} WAV audio buffer
   * @private
   */
  async _convertToWav(audioBuffer, format) {
    return new Promise((resolve, reject) => {
      const ext = format === 'opus' ? 'ogg' : format;
      const inputPath = path.join(os.tmpdir(), `parakeet-input-${Date.now()}.${ext}`);
      const outputPath = path.join(os.tmpdir(), `parakeet-output-${Date.now()}.wav`);

      // Write compressed audio to temp file
      fs.writeFileSync(inputPath, audioBuffer);

      console.log(`[${ParakeetV3Provider.getProviderName()}] Converting ${format.toUpperCase()} → WAV...`);

      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-ar', '16000',  // 16kHz sample rate
        '-ac', '1',      // Mono
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',  // Normalize audio for better recognition
        '-f', 'wav',
        '-y',
        outputPath
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      ffmpeg.on('error', (error) => {
        fs.unlinkSync(inputPath);
        reject(new Error(`ffmpeg error: ${error.message}`));
      });

      ffmpeg.on('exit', (code) => {
        // Cleanup input
        try { fs.unlinkSync(inputPath); } catch (e) {}

        if (code === 0 && fs.existsSync(outputPath)) {
          const wavBuffer = fs.readFileSync(outputPath);
          try { fs.unlinkSync(outputPath); } catch (e) {}
          resolve(wavBuffer);
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });
    });
  }

  async transcribe(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio buffer is required and cannot be empty');
    }

    // Check audio format and convert if needed
    const audioFormat = audioBuffer._audioFormat || 'wav';
    let wavBuffer = audioBuffer;

    if (audioFormat !== 'wav') {
      // Convert compressed audio to WAV
      wavBuffer = await this._convertToWav(audioBuffer, audioFormat);
    }

    const startTime = Date.now();
    const fileSizeKB = (wavBuffer.length / 1024).toFixed(1);

    console.log(`[${ParakeetV3Provider.getProviderName()}] Transcribing ${fileSizeKB} KB audio on CPU...`);

    try {
      // Get recognizer (from cache or create new)
      const recognizer = this._getRecognizer();

      // Parse WAV buffer
      const { samples, sampleRate } = this._wavBufferToSamples(wavBuffer);

      // Create stream and process
      const stream = recognizer.createStream();
      stream.acceptWaveform({ samples, sampleRate });

      // Decode
      recognizer.decode(stream);

      // Get result
      const result = recognizer.getResult(stream);
      const transcription = result.text ? result.text.trim() : '';

      const elapsed = Date.now() - startTime;
      console.log(`[${ParakeetV3Provider.getProviderName()}] Completed in ${elapsed}ms`);

      if (!transcription) {
        console.warn(`[${ParakeetV3Provider.getProviderName()}] Empty transcription result`);
        return '';
      }

      console.log(`[${ParakeetV3Provider.getProviderName()}] Transcribed: "${transcription}"`);
      return transcription;

    } catch (error) {
      console.error(`[${ParakeetV3Provider.getProviderName()}] Transcription error:`, error.message);
      throw error;
    }
  }

  static validateConfig(config) {
    if (!config || typeof config !== 'object') {
      return false;
    }

    if (!config.modelPath || typeof config.modelPath !== 'string') {
      return false;
    }

    return true;
  }

  static getProviderName() {
    return 'ParakeetV3';
  }

  static getRequirements() {
    return {
      name: this.getProviderName(),
      configKeys: ['PARAKEET_MODEL_PATH'],
      optionalKeys: ['PARAKEET_NUM_THREADS'],
      documentation:
        'Local CPU transcription using Parakeet V3 (nvidia/parakeet-tdt-0.6b-v3)\n' +
        'Supports 25 European languages. Model stays in RAM for fast transcription!\n\n' +
        'Setup:\n' +
        '  1. Install npm packages:\n' +
        '     npm install sherpa-onnx-node sherpa-onnx-linux-x64\n\n' +
        '  2. Download model (~640MB):\n' +
        '     mkdir -p models && cd models\n' +
        '     wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2\n' +
        '     tar xvf sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2\n\n' +
        '  3. Configure .env:\n' +
        '     TRANSCRIPTION_PROVIDER=parakeetv3\n' +
        '     PARAKEET_MODEL_PATH=./models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8\n' +
        '     ENABLE_COMPRESSION=false\n\n' +
        '  4. Set LD_LIBRARY_PATH before running:\n' +
        '     export LD_LIBRARY_PATH=./node_modules/sherpa-onnx-linux-x64:$LD_LIBRARY_PATH\n' +
        '     node index.js\n\n' +
        'Note: Requires WAV input (compression must be disabled)'
    };
  }
}

module.exports = ParakeetV3Provider;
