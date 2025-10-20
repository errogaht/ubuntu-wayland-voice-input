/**
 * Abstract base class for transcription providers
 * All transcription services must extend this class
 */
class TranscriptionProvider {
  constructor(config) {
    if (this.constructor === TranscriptionProvider) {
      throw new Error('TranscriptionProvider is abstract and cannot be instantiated directly');
    }

    this.config = config;
  }

  /**
   * Transcribe audio buffer to text
   * @param {Buffer} audioBuffer - Audio data in WAV format
   * @returns {Promise<string>} - Transcribed text
   * @throws {Error} - If transcription fails
   */
  async transcribe(audioBuffer) {
    throw new Error('transcribe() must be implemented by subclass');
  }

  /**
   * Validate provider configuration
   * @param {Object} config - Provider configuration
   * @returns {boolean} - True if valid
   */
  static validateConfig(config) {
    throw new Error('validateConfig() must be implemented by subclass');
  }

  /**
   * Get provider name
   * @returns {string}
   */
  static getProviderName() {
    throw new Error('getProviderName() must be implemented by subclass');
  }

  /**
   * Get provider requirements/documentation
   * @returns {Object}
   */
  static getRequirements() {
    return {
      name: this.getProviderName(),
      configKeys: [],
      documentation: 'No documentation available'
    };
  }
}

module.exports = TranscriptionProvider;
