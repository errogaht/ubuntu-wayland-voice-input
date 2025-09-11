const axios = require('axios');
const FormData = require('form-data');

class NexaraTranscriber {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Nexara API key is required');
    }
    
    this.apiKey = apiKey;
    this.apiUrl = 'https://api.nexara.ru/api/v1/audio/transcriptions';
  }

  async transcribe(audioBuffer, maxRetries = 10) {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio buffer is required and cannot be empty');
    }

    console.log('[Nexara] Transcribing audio...');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const formData = new FormData();
        formData.append('file', audioBuffer, {
          filename: 'audio.wav',
          contentType: 'audio/wav'
        });
        formData.append('model', 'whisper-1');

        const response = await axios.post(this.apiUrl, formData, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            ...formData.getHeaders()
          },
          timeout: 30000
        });

        const transcription = response.data.text;
        
        if (!transcription || transcription.trim().length === 0) {
          throw new Error('Empty transcription result');
        }
        
        console.log(`[Nexara] Transcribed: "${transcription}"`);
        return transcription.trim();
        
      } catch (error) {
        const isSSLError = error.message && (
          error.message.includes('SSL routines') ||
          error.message.includes('decryption failed') ||
          error.message.includes('bad record mac')
        );

        if (isSSLError && attempt < maxRetries) {
          console.warn(`[Nexara] SSL/VPN error (attempt ${attempt}/${maxRetries}), retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        if (error.response) {
          console.error('[Nexara] API Error:', error.response.status, error.response.statusText);
          console.error('[Nexara] Response data:', error.response.data);
        } else if (error.request) {
          console.error('[Nexara] Network error - no response received');
        } else {
          console.error('[Nexara] Request setup error:', error.message);
        }
        
        throw error;
      }
    }
  }

  static validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return false;
    }
    
    return true;
  }
}

module.exports = NexaraTranscriber;