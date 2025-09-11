# Voice Input for Ubuntu Wayland

Simple voice input tool for Ubuntu 25.04 with Wayland. Record speech with hotkey, transcribe using Nexara API, and copy text to clipboard.

## ✨ Features

- 🎤 **Hotkey Recording** - Start/stop recording with custom hotkey
- 🔊 **Speech Transcription** - Powered by Nexara API (Whisper)
- 📋 **Clipboard Integration** - Text copied automatically (Ctrl+V anywhere)
- 🔊 **Audio Feedback** - Sound notifications for each step
- 🚀 **Wayland Compatible** - Works perfectly with Ubuntu 25.04
- 🌍 **Multi-language** - Supports Russian and other languages

## 🚀 Quick Start

### Prerequisites

```bash
# Install system dependencies
sudo apt update
sudo apt install -y xclip wl-clipboard alsa-utils pulseaudio-utils

# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/voice-input.git
cd voice-input

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env and add your Nexara API key
```

### Configuration

1. Get Nexara API key from [nexara.ru](https://nexara.ru/)
2. Add to `.env` file:
   ```
   NEXARA_API_KEY=your_api_key_here
   ```

### Setup Hotkey

1. Open **Settings** → **Keyboard** → **View and Customize Shortcuts**
2. Click **Custom Shortcuts** → **+**
3. Name: `Voice Input`
4. Command: `node /path/to/voice-input/index.js`
5. Assign your preferred hotkey (e.g., `Ctrl+Alt+V`)

## 📖 How to Use

1. **Press hotkey once** → 🎬 Recording starts (short beep)
2. **Speak your message**
3. **Press hotkey again** → 🛑 Recording stops (long beep)
4. **Wait for transcription** → 📋 Text ready (short beep)
5. **Press Ctrl+V** in any app to paste

## 🧪 Testing

```bash
# Test sound notifications
npm test

# Test recording (without hotkey)
node index.js

# Test logging system
node test-logs.js
```

## 📁 Project Structure

```
voice-input/
├── src/
│   ├── SimpleAudioRecorder.js   # Audio recording
│   ├── NexaraTranscriber.js     # Speech-to-text
│   ├── ClipboardManager.js      # Clipboard operations
│   ├── SimpleSoundNotifier.js   # Sound notifications
│   ├── ProcessManager.js        # Process management
│   ├── LogManager.js            # Session logging with rotation
│   └── VoiceInputApp.js         # Main application
├── notification.mp3             # Start recording sound
├── end-recording.wav            # End recording sound
├── index.js                     # Entry point
└── package.json
```

## ⚙️ Technical Details

- **Audio Format**: WAV 16kHz mono
- **API**: Nexara Whisper API
- **Clipboard**: xclip/wl-copy auto-detection
- **Process Control**: PID files + SIGUSR1 signals
- **Sounds**: MP3/WAV playback via paplay/aplay
- **Logging**: Session logs with 1MB rotation in var/logs/

## 🐛 Troubleshooting

### Microphone Issues
```bash
# List audio devices
arecord -l

# Test microphone
arecord -d 3 test.wav && aplay test.wav
```

### Clipboard Issues
```bash
# Test clipboard
echo "test" | xclip -selection clipboard
# Then paste with Ctrl+V
```

### Permission Issues
```bash
# Add user to audio group
sudo usermod -a -G audio $USER
# Logout and login again
```

## 📜 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Pull requests welcome! Please ensure:
- Code follows existing style
- Test your changes
- Update documentation if needed

## ⭐ Show Your Support

If this project helped you, please give it a star! ⭐
