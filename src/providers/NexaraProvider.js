const axios = require('axios');
const FormData = require('form-data');
const TranscriptionProvider = require('./TranscriptionProvider');

/**
 * Nexara API Transcription Provider
 * Documentation: https://nexara.ru/
 * Available models: nexara-1 (default, experimental), whisper-1 (legacy)
 */
class NexaraProvider extends TranscriptionProvider {
  constructor(config) {
    super(config);

    if (!config.apiKey) {
      throw new Error('Nexara API key is required');
    }

    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || 'https://api.nexara.ru/api/v1/audio/transcriptions';
    this.model = config.model || 'nexara-1'; // Updated to use new Nexara experimental model
    this.timeout = config.timeout || 120000; // 2 minutes default
    this.maxRetries = config.maxRetries || 10;
  }

  async transcribe(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio buffer is required and cannot be empty');
    }

    console.log(`[${NexaraProvider.getProviderName()}] Transcribing audio...`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const formData = new FormData();
        formData.append('file', audioBuffer, {
          filename: 'audio.wav',
          contentType: 'audio/wav'
        });
        formData.append('model', this.model);

        const response = await axios.post(this.apiUrl, formData, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            ...formData.getHeaders()
          },
          timeout: this.timeout
        });

        const transcription = response.data.text;

        if (!transcription || transcription.trim().length === 0) {
          throw new Error('Empty transcription result');
        }

        console.log(`[${NexaraProvider.getProviderName()}] Transcribed: "${transcription}"`);
        return transcription.trim();

      } catch (error) {
        const isSSLError = error.message && (
          error.message.includes('SSL routines') ||
          error.message.includes('decryption failed') ||
          error.message.includes('bad record mac')
        );

        const isTimeoutError = error.code === 'ECONNABORTED' ||
                              error.message?.includes('timeout');

        // Retry on SSL/VPN errors
        if (isSSLError && attempt < this.maxRetries) {
          console.warn(`[${NexaraProvider.getProviderName()}] SSL/VPN error (attempt ${attempt}/${this.maxRetries}), retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        // Log timeout errors but don't retry (server likely overloaded)
        if (isTimeoutError) {
          console.error(`[${NexaraProvider.getProviderName()}] Timeout after ${this.timeout}ms - server may be overloaded`);
        }

        if (error.response) {
          console.error(`[${NexaraProvider.getProviderName()}] API Error:`, error.response.status, error.response.statusText);
          console.error(`[${NexaraProvider.getProviderName()}] Response data:`, error.response.data);
        } else if (error.request) {
          console.error(`[${NexaraProvider.getProviderName()}] Network error - no response received`);
        } else {
          console.error(`[${NexaraProvider.getProviderName()}] Request setup error:`, error.message);
        }

        throw error;
      }
    }
  }

  static validateConfig(config) {
    if (!config || typeof config !== 'object') {
      return false;
    }

    if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim().length === 0) {
      return false;
    }

    return true;
  }

  static getProviderName() {
    return 'Nexara';
  }

  static getRequirements() {
    return {
      name: this.getProviderName(),
      configKeys: ['NEXARA_API_KEY'],
      optionalKeys: ['NEXARA_API_URL', 'NEXARA_MODEL', 'NEXARA_TIMEOUT', 'NEXARA_MAX_RETRIES'],
      documentation: 'Get API key from https://nexara.ru/\nAvailable models: nexara-1 (default, experimental), whisper-1 (legacy)\nSet NEXARA_MODEL in .env to switch between models'
    };
  }
}

module.exports = NexaraProvider;
