const axios = require('axios');
const FormData = require('form-data');
const TranscriptionProvider = require('./TranscriptionProvider');

/**
 * Palatine Speech API Provider
 * Russian speech-to-text service with high accuracy
 * Documentation: https://docs.speech.palatine.ru/
 */
class PalatineProvider extends TranscriptionProvider {
  constructor(config) {
    super(config);

    if (!config.apiKey) {
      throw new Error('Palatine API key is required');
    }

    this.apiKey = config.apiKey;
    // Correct API endpoint (OpenAI-compatible format)
    this.apiUrl = config.apiUrl || 'https://api.palatine.ru/api/v1/audio/transcriptions';
    this.model = config.model || 'palatine_audio';
    this.language = config.language || 'ru'; // Russian by default
    this.timeout = config.timeout || 180000; // 3 minutes default (longer for better reliability)
    this.maxRetries = config.maxRetries || 3;
  }

  async transcribe(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio buffer is required and cannot be empty');
    }

    console.log(`[${PalatineProvider.getProviderName()}] Transcribing audio...`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const formData = new FormData();
        formData.append('file', audioBuffer, {
          filename: 'audio.wav',
          contentType: 'audio/wav'
        });

        // Palatine uses OpenAI-compatible format
        formData.append('model', this.model);

        // Optional: language parameter for better accuracy
        if (this.language) {
          formData.append('language', this.language);
        }

        const response = await axios.post(this.apiUrl, formData, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            ...formData.getHeaders()
          },
          timeout: this.timeout
        });

        // Extract transcription from response
        const transcription = response.data.text || response.data.transcription;

        if (!transcription || transcription.trim().length === 0) {
          throw new Error('Empty transcription result');
        }

        console.log(`[${PalatineProvider.getProviderName()}] Transcribed: "${transcription}"`);
        return transcription.trim();

      } catch (error) {
        const isTimeoutError = error.code === 'ECONNABORTED' ||
                              error.message?.includes('timeout');

        const isServerError = error.response?.status >= 500;

        // Retry on timeout or server errors
        if ((isTimeoutError || isServerError) && attempt < this.maxRetries) {
          console.warn(
            `[${PalatineProvider.getProviderName()}] ` +
            `${isTimeoutError ? 'Timeout' : 'Server error'} ` +
            `(attempt ${attempt}/${this.maxRetries}), retrying...`
          );
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          continue;
        }

        // Log timeout errors
        if (isTimeoutError) {
          console.error(
            `[${PalatineProvider.getProviderName()}] ` +
            `Timeout after ${this.timeout}ms - server may be overloaded`
          );
        }

        if (error.response) {
          console.error(
            `[${PalatineProvider.getProviderName()}] API Error:`,
            error.response.status, error.response.statusText
          );
          if (error.response.data) {
            console.error(
              `[${PalatineProvider.getProviderName()}] Response:`,
              typeof error.response.data === 'object'
                ? JSON.stringify(error.response.data)
                : error.response.data
            );
          }
        } else if (error.request) {
          console.error(
            `[${PalatineProvider.getProviderName()}] ` +
            `Network error - no response received`
          );
        } else {
          console.error(
            `[${PalatineProvider.getProviderName()}] Error:`,
            error.message
          );
        }

        throw error;
      }
    }
  }

  static validateConfig(config) {
    if (!config || typeof config !== 'object') {
      return false;
    }

    if (!config.apiKey || typeof config.apiKey !== 'string' ||
        config.apiKey.trim().length === 0) {
      return false;
    }

    return true;
  }

  static getProviderName() {
    return 'Palatine';
  }

  static getRequirements() {
    return {
      name: this.getProviderName(),
      configKeys: ['PALATINE_API_KEY'],
      optionalKeys: [
        'PALATINE_API_URL',
        'PALATINE_MODEL',
        'PALATINE_LANGUAGE',
        'PALATINE_TIMEOUT',
        'PALATINE_MAX_RETRIES'
      ],
      documentation:
        'Russian Speech-to-Text service\n' +
        'Get API key from https://speech.palatine.ru/\n' +
        'High accuracy for Russian language\n' +
        'Supports 57 languages, 23+ file formats\n' +
        'Real-time processing with word timestamps'
    };
  }
}

module.exports = PalatineProvider;
