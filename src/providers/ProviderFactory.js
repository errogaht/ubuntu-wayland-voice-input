const NexaraProvider = require('./NexaraProvider');

/**
 * Factory for creating transcription providers
 */
class ProviderFactory {
  static providers = {
    'nexara': NexaraProvider,
    // Add more providers here as they are implemented
    // 'openai': OpenAIProvider,
    // 'assemblyai': AssemblyAIProvider,
    // 'deepgram': DeepgramProvider,
  };

  /**
   * Create a transcription provider instance
   * @param {string} providerName - Name of the provider (case-insensitive)
   * @param {Object} config - Provider configuration
   * @returns {TranscriptionProvider}
   * @throws {Error} If provider not found or invalid
   */
  static create(providerName, config) {
    if (!providerName) {
      throw new Error('Provider name is required');
    }

    const normalizedName = providerName.toLowerCase().trim();
    const ProviderClass = this.providers[normalizedName];

    if (!ProviderClass) {
      const availableProviders = Object.keys(this.providers).join(', ');
      throw new Error(
        `Unknown transcription provider: "${providerName}". ` +
        `Available providers: ${availableProviders}`
      );
    }

    if (!ProviderClass.validateConfig(config)) {
      const requirements = ProviderClass.getRequirements();
      throw new Error(
        `Invalid configuration for ${ProviderClass.getProviderName()} provider. ` +
        `Required keys: ${requirements.configKeys.join(', ')}`
      );
    }

    return new ProviderClass(config);
  }

  /**
   * Get list of available providers
   * @returns {string[]}
   */
  static getAvailableProviders() {
    return Object.keys(this.providers);
  }

  /**
   * Get requirements for a specific provider
   * @param {string} providerName
   * @returns {Object|null}
   */
  static getProviderRequirements(providerName) {
    const normalizedName = providerName.toLowerCase().trim();
    const ProviderClass = this.providers[normalizedName];

    if (!ProviderClass) {
      return null;
    }

    return ProviderClass.getRequirements();
  }

  /**
   * Get all providers requirements
   * @returns {Object[]}
   */
  static getAllRequirements() {
    return Object.values(this.providers).map(ProviderClass =>
      ProviderClass.getRequirements()
    );
  }

  /**
   * Register a new provider
   * @param {string} name - Provider name
   * @param {Class} ProviderClass - Provider class extending TranscriptionProvider
   */
  static register(name, ProviderClass) {
    if (!name || typeof name !== 'string') {
      throw new Error('Provider name must be a non-empty string');
    }

    if (typeof ProviderClass.prototype.transcribe !== 'function') {
      throw new Error('Provider class must implement transcribe() method');
    }

    const normalizedName = name.toLowerCase().trim();
    this.providers[normalizedName] = ProviderClass;
  }

  /**
   * Auto-detect and create provider from environment variables
   * @param {Object} env - Environment variables
   * @returns {TranscriptionProvider}
   * @throws {Error} If no provider can be auto-detected
   */
  static autoDetect(env) {
    const providerName = env.TRANSCRIPTION_PROVIDER || env.PROVIDER;

    if (providerName) {
      // Use explicitly specified provider
      const config = this._buildConfigFromEnv(providerName, env);
      return this.create(providerName, config);
    }

    // Try to auto-detect based on available API keys
    if (env.NEXARA_API_KEY) {
      return this.create('nexara', {
        apiKey: env.NEXARA_API_KEY,
        apiUrl: env.NEXARA_API_URL,
        model: env.NEXARA_MODEL,
        timeout: env.NEXARA_TIMEOUT ? parseInt(env.NEXARA_TIMEOUT) : undefined,
        maxRetries: env.NEXARA_MAX_RETRIES ? parseInt(env.NEXARA_MAX_RETRIES) : undefined
      });
    }

    // Add more auto-detection logic here for other providers
    // if (env.OPENAI_API_KEY) { ... }
    // if (env.ASSEMBLYAI_API_KEY) { ... }

    throw new Error(
      'No transcription provider configured. ' +
      'Set TRANSCRIPTION_PROVIDER in .env or provide a valid API key. ' +
      `Available providers: ${this.getAvailableProviders().join(', ')}`
    );
  }

  /**
   * Build provider config from environment variables
   * @private
   */
  static _buildConfigFromEnv(providerName, env) {
    const normalizedName = providerName.toLowerCase().trim();

    // Provider-specific configuration mapping
    const configMaps = {
      nexara: {
        apiKey: env.NEXARA_API_KEY,
        apiUrl: env.NEXARA_API_URL,
        model: env.NEXARA_MODEL,
        timeout: env.NEXARA_TIMEOUT ? parseInt(env.NEXARA_TIMEOUT) : undefined,
        maxRetries: env.NEXARA_MAX_RETRIES ? parseInt(env.NEXARA_MAX_RETRIES) : undefined
      }
      // Add more provider configs here
    };

    return configMaps[normalizedName] || {};
  }
}

module.exports = ProviderFactory;
