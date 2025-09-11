# Voice Input - Ubuntu Wayland Voice Input Tool

**Note: This project uses English for all code, comments, and documentation. Communication with users can be in any language, but all Git commits, code, and technical documentation must be in English.**

## Project Description

Voice Input is a Node.js application for Ubuntu 25.04 with Wayland that allows recording speech from a microphone, transcribing it to text via Nexara API, and automatically copying the result to clipboard for pasting.

## Features

- 🎤 **Audio Recording** from active microphone (start/stop via hotkey)
- 🔊 **Speech Transcription** via Nexara API (Whisper)  
- 📋 **Clipboard Integration** (Ctrl+V in any application)
- 🔊 **Audio Notifications** - pleasant pop sounds for all events
- 🚀 **CLI Interface** with hotkey toggle (start/stop)

## Architecture

```
voice-input/
├── src/
│   ├── SimpleAudioRecorder.js   # Simple audio recording (start/stop)
│   ├── NexaraTranscriber.js     # Nexara API integration
│   ├── ClipboardManager.js      # Clipboard operations
│   ├── SimpleSoundNotifier.js   # Simple audio notifications
│   ├── ProcessManager.js        # Process management (start/stop)
│   ├── LogManager.js            # Logging with rotation
│   └── VoiceInputApp.js         # Main application logic
├── package.json
└── index.js                     # CLI entry point
```

## Workflow

1. User assigns hotkey in Ubuntu Settings > Keyboard > Custom Shortcuts
2. **First hotkey press**: Starts recording `node /path/to/voice-input/index.js`
3. 🎬 **Short pop sound** - application starts recording audio from microphone
4. **Second hotkey press**: 🛑 **Long pop sound** - stops recording and starts processing
5. Audio is sent to Nexara API for transcription  
6. Transcribed text is copied to clipboard
7. 📋 **Short pop sound** - notifies that text is ready
8. User presses Ctrl+V in any application to paste

## System Dependencies

### Ubuntu Packages
```bash
sudo apt update
sudo apt install -y xclip wl-clipboard alsa-utils pulseaudio-utils
```

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
NEXARA_API_KEY=your_nexara_api_key_here
```

Or copy from template:
```bash
cp .env.example .env
# Edit .env file and add your API key
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
- **Audio Format**: WAV 16kHz mono for Nexara API  
- **Clipboard**: xclip/wl-copy (auto-detection)
- **API**: Nexara Whisper API for transcription
- **Process Management**: PID files + SIGUSR1 signals
- **Audio Feedback**: MP3/WAV files via paplay/mpg123/aplay
- **Logging**: Structured session logs with rotation in var/logs/

## Development Commands

```bash
# Install dependencies
npm install

# Check microphone
arecord -l

# Test clipboard
echo "Hello World" | xclip -selection clipboard

# Test audio notifications
node test-sound.js

# Test simple recording flow
node test-simple-flow.js

# Test logging system
node test-logs.js

# Run application (first time - start recording)
node index.js

# Run application (second time - stop recording)  
node index.js
```