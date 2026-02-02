# Voice Input - Ubuntu Wayland Voice Input Tool

**Note: This project uses English for all code, comments, and documentation. Communication with users can be in any language, but all Git commits, code, and technical documentation must be in English.**

## Project Description

Voice Input is a Node.js application for Ubuntu 25.04 with Wayland that allows recording speech from a microphone, transcribing it to text via multiple transcription service providers, and automatically copying the result to clipboard for pasting.

## Features

- 🎤 **Audio Recording** from active microphone (start/stop via hotkey)
- 🗜️ **Audio Compression** - Opus/MP3 compression (~88% bandwidth savings)
- 🔊 **Speech Transcription** via multiple providers (Nexara, OpenAI, etc.)
- 🔄 **Provider System** - easily switch between transcription services
- 📋 **Clipboard Integration** (Ctrl+V in any application)
- 🔊 **Audio Notifications** - pleasant pop sounds for all events
- 🚀 **CLI Interface** with hotkey toggle (start/stop)
- 💾 **Auto Backup** - recordings saved before transcription

## Architecture

```
voice-input/
├── src/
│   ├── providers/               # Transcription providers (pluggable)
│   │   ├── TranscriptionProvider.js  # Abstract base class
│   │   ├── NexaraProvider.js         # Nexara/Whisper implementation
│   │   ├── ProviderFactory.js        # Factory for creating providers
│   │   └── index.js                  # Exports
│   ├── SimpleAudioRecorder.js   # Simple audio recording (start/stop)
│   ├── ClipboardManager.js      # Clipboard operations
│   ├── SimpleSoundNotifier.js   # Simple audio notifications
│   ├── ProcessManager.js        # Process management (start/stop)
│   ├── LogManager.js            # Logging with rotation
│   └── VoiceInputApp.js         # Main application logic
├── docs/
│   ├── ADDING_PROVIDERS.md      # Guide for adding new providers
│   └── PROVIDER_ARCHITECTURE.md # Provider system documentation
├── var/
│   ├── logs/                    # Session logs
│   └── recordings/              # Backup recordings
├── list-providers.js            # List available providers
├── test-provider.js             # Test transcription providers
├── package.json
└── index.js                     # CLI entry point
```

## Workflow

1. User assigns hotkey in Ubuntu Settings > Keyboard > Custom Shortcuts
2. **First hotkey press**: Starts recording `node /path/to/voice-input/index.js`
3. 🎬 **Short pop sound** - application starts recording audio from microphone
4. **Second hotkey press**: 🛑 **Long pop sound** - stops recording and starts processing
5. 🗜️ Audio is compressed via ffmpeg (WAV → Opus, ~88% smaller) if enabled
6. 💾 Compressed audio is automatically backed up to `var/recordings/`
7. Audio is sent to configured transcription provider (Palatine, Nexara, etc.)
8. Transcribed text is copied to clipboard
9. 📋 **Short pop sound** - notifies that text is ready
10. User presses Ctrl+V in any application to paste
11. 💾 Backup is kept in `var/recordings/` (configurable via `DELETE_BACKUP_AFTER_SUCCESS`)

## System Dependencies

### Ubuntu Packages
```bash
sudo apt update
sudo apt install -y xclip wl-clipboard alsa-utils pulseaudio-utils ffmpeg
```

**ffmpeg** is required for audio compression (Opus/MP3). Without it, the app will fall back to uncompressed WAV.

### Node.js Dependencies  
```bash
npm install node-microphone axios form-data dotenv
```

## Ubuntu Hotkey Setup

1. Open **Settings** > **Keyboard** > **View and Customize Shortcuts**
2. Click **Custom Shortcuts** > **+**
3. Name: `Voice Input`
4. Command: `node /home/user/voice-input/index.js`
5. Assign desired key combination

## Configuration

Create `.env` file in project root:

```bash
# Transcription Provider (optional - auto-detected if not set)
TRANSCRIPTION_PROVIDER=nexara

# Nexara Provider Configuration
NEXARA_API_KEY=your_nexara_api_key_here
```

Or copy from template:
```bash
cp .env.example .env
# Edit .env file and configure your provider
```

### Switching Providers

To switch to a different transcription service:

1. **List available providers:**
   ```bash
   node list-providers.js
   ```

2. **Set provider in `.env`:**
   ```bash
   TRANSCRIPTION_PROVIDER=openai  # or nexara, assemblyai, etc.
   OPENAI_API_KEY=your_api_key
   ```

3. **Or let it auto-detect:**
   ```bash
   # Just provide API key, provider is auto-detected
   NEXARA_API_KEY=your_key
   ```

See `docs/ADDING_PROVIDERS.md` for adding new providers.

### Audio Compression (Optional)

Enable audio compression to reduce bandwidth usage by ~88%:

```bash
# Add to .env file
ENABLE_COMPRESSION=true        # Enable compression (default: true)
COMPRESSION_FORMAT=opus        # opus (recommended) or mp3
COMPRESSION_BITRATE=32k        # 32k is optimal for speech
```

**Benefits:**
- 🗜️ **88% smaller files** (54KB WAV → 6.6KB Opus)
- 🚀 **Faster uploads** to transcription API
- 💰 **Reduced bandwidth costs**
- ✅ **High quality** - optimized for speech

**Requirements:**
- ffmpeg must be installed: `sudo apt install ffmpeg`
- If ffmpeg is missing, app will automatically fall back to WAV

**Test compression:**
```bash
node test-compression.js
```

## Usage

### Via Hotkey (Recommended)
Simply press the assigned key combination

### Via Command Line
```bash
cd voice-input
node index.js
```

## Wayland Features

- Uses clipboard instead of direct typing (bypasses Wayland security restrictions)
- **Automatically detects active microphone** from Ubuntu settings via PulseAudio
- **Simple start/stop logic** - more reliable than VAD
- CLI approach for hotkey integration (Wayland security compatible)
- **Multi-language text support** via clipboard
- **Session logging** with automatic 1MB log rotation

## Technical Details

- **Audio Recording**: arecord → WAV file → Buffer
- **Audio Format**: WAV 16kHz mono (recording) → Opus/MP3 (compression)
- **Compression**: ffmpeg with libopus/libmp3lame (88% size reduction)
- **Clipboard**: xclip/wl-copy (auto-detection)
- **Transcription**: Pluggable provider system (Nexara, OpenAI, etc.)
- **Process Management**: PID files + SIGUSR1 signals
- **Audio Feedback**: MP3/WAV files via paplay/mpg123/aplay
- **Logging**: Structured session logs with rotation in var/logs/
- **Backup**: Automatic recording backup with cleanup (keeps last 5)

## Development Commands

```bash
# Install dependencies
npm install

# Provider Management
node list-providers.js              # List available transcription providers
node test-provider.js               # Test provider with latest recording
node test-provider.js nexara file.wav  # Test specific provider

# System Tests
arecord -l                          # Check microphone
echo "Test" | xclip -selection clipboard  # Test clipboard
node test-sound.js                  # Test audio notifications
node test-simple-flow.js            # Test recording flow
node test-logs.js                   # Test logging system
node test-compression.js            # Test audio compression (Opus/MP3)

# Run Application
node index.js                       # First press: start recording
node index.js                       # Second press: stop & transcribe

# Check Logs
tail -f var/logs/voice-input.log    # View session logs

# Check Backups
ls -lh var/recordings/              # List backup recordings
```

## Documentation

- **Provider Architecture**: `docs/PROVIDER_ARCHITECTURE.md`
- **Adding Providers**: `docs/ADDING_PROVIDERS.md`
- **Refactoring Summary**: `REFACTORING_SUMMARY.md`