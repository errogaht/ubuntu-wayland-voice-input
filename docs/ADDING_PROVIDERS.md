# Adding New Transcription Providers

This guide explains how to add new transcription service providers to Voice Input.

## Architecture Overview

The transcription system uses a provider pattern:

```
TranscriptionProvider (abstract base class)
    ↓
NexaraProvider, OpenAIProvider, etc. (concrete implementations)
    ↓
ProviderFactory (creates providers based on configuration)
    ↓
VoiceInputApp (uses provider via factory)
```

## Step 1: Create Provider Class

Create a new file in `src/providers/` (e.g., `OpenAIProvider.js`):

```javascript
const axios = require('axios');
const FormData = require('form-data');
const TranscriptionProvider = require('./TranscriptionProvider');

/**
 * OpenAI Whisper API Provider
 * Documentation: https://platform.openai.com/docs/guides/speech-to-text
 */
class OpenAIProvider extends TranscriptionProvider {
  constructor(config) {
    super(config);

    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || 'https://api.openai.com/v1/audio/transcriptions';
    this.model = config.model || 'whisper-1';
    this.timeout = config.timeout || 60000;
  }

  async transcribe(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio buffer is required and cannot be empty');
    }

    console.log(`[${OpenAIProvider.getProviderName()}] Transcribing audio...`);

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

      console.log(`[${OpenAIProvider.getProviderName()}] Transcribed: "${transcription}"`);
      return transcription.trim();

    } catch (error) {
      if (error.response) {
        console.error(`[${OpenAIProvider.getProviderName()}] API Error:`,
          error.response.status, error.response.statusText);
        console.error(`[${OpenAIProvider.getProviderName()}] Response:`,
          error.response.data);
      } else if (error.request) {
        console.error(`[${OpenAIProvider.getProviderName()}] Network error`);
      } else {
        console.error(`[${OpenAIProvider.getProviderName()}] Error:`,
          error.message);
      }

      throw error;
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
    return 'OpenAI';
  }

  static getRequirements() {
    return {
      name: this.getProviderName(),
      configKeys: ['OPENAI_API_KEY'],
      optionalKeys: ['OPENAI_API_URL', 'OPENAI_MODEL', 'OPENAI_TIMEOUT'],
      documentation: 'Get API key from https://platform.openai.com/api-keys\n' +
                    'Supports Whisper model for speech recognition'
    };
  }
}

module.exports = OpenAIProvider;
```

## Step 2: Register Provider in Factory

Edit `src/providers/ProviderFactory.js` and add your provider:

```javascript
const NexaraProvider = require('./NexaraProvider');
const OpenAIProvider = require('./OpenAIProvider'); // Add this

class ProviderFactory {
  static providers = {
    'nexara': NexaraProvider,
    'openai': OpenAIProvider, // Add this
  };

  // ... rest of the code
}
```

## Step 3: Add Auto-Detection Logic

In `ProviderFactory.js`, update the `autoDetect()` method:

```javascript
static autoDetect(env) {
  const providerName = env.TRANSCRIPTION_PROVIDER || env.PROVIDER;

  if (providerName) {
    const config = this._buildConfigFromEnv(providerName, env);
    return this.create(providerName, config);
  }

  // Try to auto-detect based on available API keys
  if (env.NEXARA_API_KEY) {
    return this.create('nexara', { /* ... */ });
  }

  // Add your provider auto-detection here
  if (env.OPENAI_API_KEY) {
    return this.create('openai', {
      apiKey: env.OPENAI_API_KEY,
      apiUrl: env.OPENAI_API_URL,
      model: env.OPENAI_MODEL,
      timeout: env.OPENAI_TIMEOUT ? parseInt(env.OPENAI_TIMEOUT) : undefined
    });
  }

  throw new Error('No transcription provider configured...');
}
```

## Step 4: Add Config Mapping

In `ProviderFactory.js`, update the `_buildConfigFromEnv()` method:

```javascript
static _buildConfigFromEnv(providerName, env) {
  const normalizedName = providerName.toLowerCase().trim();

  const configMaps = {
    nexara: { /* ... */ },
    openai: { // Add this
      apiKey: env.OPENAI_API_KEY,
      apiUrl: env.OPENAI_API_URL,
      model: env.OPENAI_MODEL,
      timeout: env.OPENAI_TIMEOUT ? parseInt(env.OPENAI_TIMEOUT) : undefined
    }
  };

  return configMaps[normalizedName] || {};
}
```

## Step 5: Update .env.example

Add configuration examples to `.env.example`:

```bash
# OpenAI Whisper API
# TRANSCRIPTION_PROVIDER=openai
# OPENAI_API_KEY=your_openai_api_key_here
# OPENAI_MODEL=whisper-1
# OPENAI_TIMEOUT=60000
```

## Step 6: Test Your Provider

Create a test file `test-openai-provider.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
require('dotenv').config();
const OpenAIProvider = require('./src/providers/OpenAIProvider');

async function test() {
  const audioFile = './var/recordings/test.wav';
  const audioBuffer = fs.readFileSync(audioFile);

  const provider = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY
  });

  const text = await provider.transcribe(audioBuffer);
  console.log('Transcribed:', text);
}

test().catch(console.error);
```

## Provider Requirements

### Must Implement

1. **`constructor(config)`** - Initialize with configuration
2. **`async transcribe(audioBuffer)`** - Main transcription method
3. **`static validateConfig(config)`** - Validate configuration
4. **`static getProviderName()`** - Return provider name
5. **`static getRequirements()`** - Return provider requirements

### Audio Format

Providers must accept audio in **WAV format, 16kHz mono**:

```
Format: WAV (Microsoft)
Codec: PCM S 16 LE (s16l)
Channels: 1 (mono)
Sample Rate: 16000 Hz
```

### Error Handling

Providers should:
- Throw descriptive errors
- Log errors with provider name prefix
- Handle network timeouts gracefully
- Validate input before API calls

## Testing Checklist

- [ ] Provider class extends `TranscriptionProvider`
- [ ] All required methods implemented
- [ ] Configuration validation works
- [ ] Auto-detection works in factory
- [ ] Manual provider selection works
- [ ] Transcription succeeds with test audio
- [ ] Error handling is comprehensive
- [ ] Logging includes provider name
- [ ] Documentation is complete

## Common Providers to Add

### Priority Providers

1. **OpenAI Whisper API** - High quality, good pricing
2. **AssemblyAI** - Fast, accurate, good for production
3. **Deepgram** - Real-time capable, very fast
4. **Google Cloud Speech-to-Text** - Enterprise grade
5. **Azure Speech Services** - Microsoft's offering

### Free/Open Providers

1. **Faster Whisper (local)** - Local transcription
2. **Vosk (local)** - Offline speech recognition
3. **Coqui STT (local)** - Open source alternative

## Example: Local Provider

For local transcription providers (like Faster Whisper), you don't need API keys:

```javascript
class FasterWhisperProvider extends TranscriptionProvider {
  constructor(config) {
    super(config);
    this.modelPath = config.modelPath || './models/whisper-base';
  }

  async transcribe(audioBuffer) {
    // Run local inference
    const { exec } = require('child_process');
    // ... implementation
  }

  static validateConfig(config) {
    return true; // No API key needed for local providers
  }

  static getProviderName() {
    return 'FasterWhisper';
  }
}
```

## Questions?

Check existing providers like `NexaraProvider.js` for reference implementations.
