# Provider Architecture

## Overview

Voice Input uses a **provider pattern** for transcription services. This allows easy switching between different transcription APIs without changing application code.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      VoiceInputApp                          │
│                                                             │
│  constructor() {                                            │
│    this.transcriber = ProviderFactory.autoDetect(env)       │
│  }                                                          │
│                                                             │
│  async run() {                                              │
│    const text = await this.transcriber.transcribe(audio)    │
│  }                                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ creates
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    ProviderFactory                          │
│                                                             │
│  static providers = {                                       │
│    'nexara': NexaraProvider,                                │
│    'openai': OpenAIProvider,                                │
│    'assemblyai': AssemblyAIProvider                         │
│  }                                                          │
│                                                             │
│  static autoDetect(env) {                                   │
│    // Auto-detect based on API keys                        │
│  }                                                          │
│                                                             │
│  static create(name, config) {                              │
│    return new providers[name](config)                       │
│  }                                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ instantiates
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              TranscriptionProvider (abstract)               │
│                                                             │
│  async transcribe(audioBuffer) {                            │
│    throw new Error('Must implement')                        │
│  }                                                          │
│                                                             │
│  static validateConfig(config) {                            │
│    throw new Error('Must implement')                        │
│  }                                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ extended by
         ┌───────────┴──────────┬──────────────┐
         ▼                      ▼              ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ NexaraProvider   │  │ OpenAIProvider   │  │ AssemblyAI...    │
│                  │  │                  │  │                  │
│ transcribe()     │  │ transcribe()     │  │ transcribe()     │
│ validateConfig() │  │ validateConfig() │  │ validateConfig() │
│ getProviderName()│  │ getProviderName()│  │ getProviderName()│
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

## Key Components

### 1. TranscriptionProvider (Base Class)

**Location:** `src/providers/TranscriptionProvider.js`

Abstract base class that all providers must extend. Defines the interface:

```javascript
class TranscriptionProvider {
  async transcribe(audioBuffer)       // Main transcription method
  static validateConfig(config)       // Validate provider config
  static getProviderName()            // Return provider name
  static getRequirements()            // Return config requirements
}
```

### 2. ProviderFactory

**Location:** `src/providers/ProviderFactory.js`

Factory class that creates provider instances:

```javascript
// Auto-detect provider from environment
const provider = ProviderFactory.autoDetect(process.env);

// Or explicitly create a provider
const provider = ProviderFactory.create('nexara', {
  apiKey: 'your-api-key'
});

// List available providers
const providers = ProviderFactory.getAvailableProviders();
// => ['nexara', 'openai', 'assemblyai']
```

### 3. Concrete Providers

**Location:** `src/providers/NexaraProvider.js`, etc.

Each provider implements the `TranscriptionProvider` interface:

```javascript
class NexaraProvider extends TranscriptionProvider {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    // ... provider-specific setup
  }

  async transcribe(audioBuffer) {
    // Provider-specific transcription logic
    return transcribedText;
  }

  static validateConfig(config) {
    return config.apiKey ? true : false;
  }

  static getProviderName() {
    return 'Nexara';
  }
}
```

## Configuration Flow

### 1. Environment Variables

User sets variables in `.env`:

```bash
TRANSCRIPTION_PROVIDER=nexara
NEXARA_API_KEY=your_api_key_here
```

### 2. Auto-Detection

If `TRANSCRIPTION_PROVIDER` is not set, factory auto-detects:

```javascript
static autoDetect(env) {
  if (env.NEXARA_API_KEY) {
    return this.create('nexara', {...});
  }
  if (env.OPENAI_API_KEY) {
    return this.create('openai', {...});
  }
  // ... more providers
  throw new Error('No provider configured');
}
```

### 3. Provider Creation

Factory validates config and creates instance:

```javascript
static create(providerName, config) {
  const ProviderClass = this.providers[providerName];

  if (!ProviderClass.validateConfig(config)) {
    throw new Error('Invalid config');
  }

  return new ProviderClass(config);
}
```

### 4. Usage in App

VoiceInputApp uses the provider transparently:

```javascript
constructor() {
  this.transcriber = ProviderFactory.autoDetect(process.env);
}

async run() {
  const text = await this.transcriber.transcribe(audioBuffer);
  // ... use text
}
```

## Benefits

### 1. Easy Provider Switching

Change provider with one line in `.env`:

```bash
# Before
TRANSCRIPTION_PROVIDER=nexara

# After (if Nexara is down)
TRANSCRIPTION_PROVIDER=openai
```

### 2. No Code Changes

Application code doesn't change when adding/switching providers.

### 3. Auto-Detection

System automatically uses available provider based on API keys.

### 4. Extensibility

Add new providers by:
1. Creating provider class
2. Registering in factory
3. Updating `.env.example`

### 5. Type Safety

All providers implement same interface, ensuring consistent behavior.

## Provider Lifecycle

```
┌──────────────┐
│ Application  │
│   Starts     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Load .env    │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ ProviderFactory      │
│  .autoDetect(env)    │
└──────┬───────────────┘
       │
       ├─ Check TRANSCRIPTION_PROVIDER
       │  ├─ If set: use specified provider
       │  └─ If not set: auto-detect from API keys
       │
       ▼
┌──────────────────────┐
│ Validate Config      │
└──────┬───────────────┘
       │
       ├─ Valid: Create provider instance
       └─ Invalid: Throw error with requirements
       │
       ▼
┌──────────────────────┐
│ Provider Instance    │
│   Ready to Use       │
└──────────────────────┘
```

## Error Handling

```javascript
try {
  const transcriber = ProviderFactory.autoDetect(process.env);
} catch (error) {
  console.error('Provider initialization failed:', error.message);

  // Show available providers
  console.error('Available:', ProviderFactory.getAvailableProviders());

  // Show requirements
  ProviderFactory.getAllRequirements().forEach(req => {
    console.error(`${req.name}: ${req.configKeys.join(', ')}`);
  });

  process.exit(1);
}
```

## Testing

### Test Specific Provider

```javascript
const NexaraProvider = require('./src/providers/NexaraProvider');

const provider = new NexaraProvider({
  apiKey: 'test-key'
});

const text = await provider.transcribe(audioBuffer);
```

### Test Factory

```javascript
const ProviderFactory = require('./src/providers/ProviderFactory');

// Test auto-detection
const provider1 = ProviderFactory.autoDetect({
  NEXARA_API_KEY: 'test-key'
});

// Test explicit creation
const provider2 = ProviderFactory.create('nexara', {
  apiKey: 'test-key'
});
```

## Adding New Providers

See [ADDING_PROVIDERS.md](./ADDING_PROVIDERS.md) for detailed guide.

Quick steps:
1. Create `src/providers/YourProvider.js`
2. Extend `TranscriptionProvider`
3. Implement required methods
4. Register in `ProviderFactory`
5. Add to `.env.example`
6. Update documentation

## Commands

```bash
# List available providers
node list-providers.js

# Test provider
node test-nexara-retry.js

# Run with specific provider
TRANSCRIPTION_PROVIDER=nexara node index.js
```

## Future Enhancements

- [ ] Provider health checks
- [ ] Automatic failover to backup provider
- [ ] Provider performance metrics
- [ ] Rate limiting support
- [ ] Caching layer
- [ ] Local/offline providers
- [ ] Provider-specific optimizations
