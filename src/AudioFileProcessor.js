const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Prepares existing audio files for transcription providers.
 *
 * This helper never edits source files selected from Nautilus. Single-file
 * transcription passes original bytes through with metadata; multi-file
 * transcription creates one temporary speech-optimized audio file so providers
 * still receive a single upload/buffer.
 */
class AudioFileProcessor {
  constructor(options = {}) {
    this.options = {
      sampleRate: options.sampleRate || 16000,
      channels: options.channels || 1,
      compressionFormat: options.compressionFormat || 'opus',
      compressionBitrate: options.compressionBitrate || '32k',
      ...options
    };
  }

  static supportedExtensions = new Set([
    '.wav',
    '.ogg',
    '.opus',
    '.mp3',
    '.m4a',
    '.flac',
    '.webm',
    '.aac'
  ]);

  /**
   * Validate and order user-selected paths before audio processing starts.
   * Basename sorting mirrors folder ordering, and the full-path tie-break keeps
   * ordering deterministic when duplicate basenames are selected.
   *
   * @param {string[]} filePaths - Candidate audio file paths from CLI/Nautilus.
   * @returns {string[]} Existing supported files sorted for transcription.
   */
  static validateAndSortFiles(filePaths) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      throw new Error('At least one audio file is required');
    }

    const normalized = filePaths
      .map(filePath => path.resolve(String(filePath)))
      .filter((filePath, index, all) => all.indexOf(filePath) === index);

    const invalid = [];
    for (const filePath of normalized) {
      if (!fs.existsSync(filePath)) {
        invalid.push(`${filePath} (missing)`);
        continue;
      }

      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        invalid.push(`${filePath} (not a file)`);
        continue;
      }

      const extension = path.extname(filePath).toLowerCase();
      if (!AudioFileProcessor.supportedExtensions.has(extension)) {
        invalid.push(`${filePath} (unsupported extension)`);
      }
    }

    if (invalid.length > 0) {
      throw new Error(
        'Unsupported audio selection:\n' +
        invalid.map(item => `  - ${item}`).join('\n') +
        `\nSupported extensions: ${AudioFileProcessor.getSupportedExtensions().join(', ')}`
      );
    }

    return normalized.sort((left, right) => {
      const baseCompare = path.basename(left).localeCompare(
        path.basename(right),
        undefined,
        { numeric: true, sensitivity: 'base' }
      );

      return baseCompare || left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  static getSupportedExtensions() {
    return Array.from(AudioFileProcessor.supportedExtensions);
  }

  /**
   * Read one source file and attach metadata consumed by provider uploads.
   * This keeps file mode compatible with the microphone buffer contract.
   *
   * @param {string} filePath - Valid audio file path.
   * @returns {Buffer} Audio bytes with _audioFormat/_audioExtension metadata.
   */
  readAudioBuffer(filePath) {
    const buffer = fs.readFileSync(filePath);
    const extension = path.extname(filePath).slice(1).toLowerCase();
    buffer._audioExtension = extension;
    buffer._audioFormat = extension === 'ogg' ? 'opus' : extension;
    return buffer;
  }

  /**
   * Merge many files into one temporary compressed audio file.
   * ffmpeg decodes each source format, concatenates sequentially, and normalizes
   * the output to mono 16kHz speech settings for transcription.
   *
   * @param {string[]} filePaths - Already validated and sorted audio files.
   * @returns {Promise<{path: string, format: string, extension: string}>}
   */
  async mergeAudioFiles(filePaths) {
    if (!Array.isArray(filePaths) || filePaths.length < 2) {
      throw new Error('At least two audio files are required for merge');
    }

    const format = this.options.compressionFormat;
    const extension = format === 'opus' ? 'ogg' : format;
    const tempBase = path.join(os.tmpdir(), `voice-input-files-${process.pid}-${Date.now()}`);
    const listPath = `${tempBase}.txt`;
    const outputPath = `${tempBase}.${extension}`;

    const listContent = filePaths
      .map(filePath => `file '${filePath.replace(/'/g, "'\\''")}'`)
      .join('\n');
    fs.writeFileSync(listPath, listContent, 'utf8');

    try {
      await this.runFfmpeg(listPath, outputPath, format);
    } finally {
      try {
        fs.unlinkSync(listPath);
      } catch (error) {
        // Best-effort cleanup; the merged output is owned by the caller.
      }
    }

    return { path: outputPath, format, extension };
  }

  /**
   * Execute the ffmpeg concat/transcode step and surface stderr on failure.
   * Keeping process handling isolated makes mergeAudioFiles responsible only
   * for path ownership and cleanup.
   */
  runFfmpeg(listPath, outputPath, format) {
    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-vn',
        '-ar', this.options.sampleRate.toString(),
        '-ac', this.options.channels.toString(),
        '-b:a', this.options.compressionBitrate,
        '-y'
      ];

      if (format === 'opus') {
        ffmpegArgs.push('-c:a', 'libopus', '-application', 'voip');
      } else if (format === 'mp3') {
        ffmpegArgs.push('-c:a', 'libmp3lame');
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
        reject(new Error(`ffmpeg error: ${error.message}`));
      });

      ffmpeg.on('exit', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve();
          return;
        }

        reject(new Error(`ffmpeg exited with code ${code}: ${stderrOutput.trim()}`));
      });
    });
  }
}

module.exports = AudioFileProcessor;
