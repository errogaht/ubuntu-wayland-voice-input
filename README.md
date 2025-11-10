# Voice Input for Ubuntu Wayland

Simple voice input tool for Ubuntu 25.04 with Wayland. Record speech with hotkey, transcribe using multiple providers (Nexara, Palatine, OpenAI), and copy text to clipboard.

## ✨ Features

- 🎤 **Hotkey Recording** - Start/stop recording with custom hotkey
- 🎯 **System Tray** - Ubuntu top bar menu for quick settings
- 📓 **Notebook Mode** - Accumulate multiple recordings into one buffer
- 🔊 **Speech Transcription** - Multiple providers (Nexara, Palatine, OpenAI, etc.)
- 📋 **Clipboard Integration** - Text copied automatically (Ctrl+V anywhere)
- 🔊 **Audio Feedback** - Sound notifications for each step
- ⚙️ **Configurable Prefix/Suffix** - Toggle "[Voice - verify]:" and ". ultrathink"
- 🚀 **Wayland Compatible** - Works perfectly with Ubuntu 25.04
- 🌍 **Multi-language** - Supports Russian and other languages
- 💾 **Auto Backup** - Recordings saved before transcription

## 🚀 Quick Start

### Prerequisites (Ubuntu 25.04)

```bash
# Install system dependencies
sudo apt update
sudo apt install -y \
  xclip wl-clipboard \
  alsa-utils pulseaudio-utils \
  gir1.2-ayatanaappindicator3-0.1 python3-gi

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

1. **Choose transcription provider** (Nexara, Palatine, OpenAI, etc.)
   ```bash
   # List available providers
   node list-providers.js
   ```

2. **Add API key** to `.env` file:
   ```bash
   # Nexara (default)
   NEXARA_API_KEY=your_api_key_here

   # Or Palatine (Russian provider)
   PALATINE_API_KEY=your_api_key_here

   # Or OpenAI
   OPENAI_API_KEY=your_api_key_here
   ```

3. **Install System Tray** (optional but recommended):
   ```bash
   ./install-tray.sh
   ```
   This installs the system tray icon for quick settings access.

### Setup Hotkey

1. Open **Settings** → **Keyboard** → **View and Customize Shortcuts**
2. Click **Custom Shortcuts** → **+**
3. Name: `Voice Input`
4. Command: `node /path/to/voice-input/index.js`
5. Assign your preferred hotkey (e.g., `Ctrl+Alt+V`)

## 📖 How to Use

### Basic Workflow

1. **Press hotkey once** → 🎬 Recording starts (short beep)
2. **Speak your message**
3. **Press hotkey again** → 🛑 Recording stops (long beep)
4. **Wait for transcription** → 📋 Text ready (short beep)
5. **Press Ctrl+V** in any app to paste

### System Tray Menu

Look for the microphone icon 🎤 in Ubuntu top bar (right side):

**Mode Selection:**
- **Normal Mode** - Each recording is independent
- **Notebook Mode** - Recordings accumulate (perfect for reading articles and taking notes)

**Options:**
- ☑️ **Add Prefix "[Voice - verify]:"** - Toggle prefix
- ☑️ **Add Suffix ". ultrathink"** - Toggle suffix

**Notebook Actions:**
- **Clear Notebook Buffer** - Reset accumulated recordings (only in Notebook Mode)

### Notebook Mode Usage

Perfect for reading long articles and taking notes:

1. **Enable Notebook Mode** in tray menu
2. Read your article
3. When you want to add a note:
   - Press hotkey
   - Speak your note (5-10 seconds)
   - Press hotkey again
4. Repeat step 3 for each note
5. When finished:
   - Press Ctrl+V to paste all accumulated notes
   - Or **Clear Notebook Buffer** in tray menu to start fresh

Each recording will be on a separate line in the final output.

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
│   ├── providers/                      # Transcription providers
│   │   ├── TranscriptionProvider.js   # Base class
│   │   ├── NexaraProvider.js          # Nexara/Whisper
│   │   ├── PalatineProvider.js        # Palatine (Russian)
│   │   ├── ProviderFactory.js         # Factory for providers
│   │   └── index.js
│   ├── SimpleAudioRecorder.js          # Audio recording
│   ├── ClipboardManager.js             # Clipboard operations (wl-copy/xclip)
│   ├── SimpleSoundNotifier.js          # Sound notifications
│   ├── ProcessManager.js               # Process management
│   ├── LogManager.js                   # Session logging with rotation
│   └── VoiceInputApp.js                # Main application logic
├── tray-app.py                         # System tray application (Python + GTK)
├── config.json                         # User settings (mode, prefix/suffix)
├── install-tray.sh                     # System tray installer
├── voice-input-tray.desktop            # Autostart configuration
├── notification.mp3                    # Start recording sound
├── end-recording.wav                   # End recording sound
├── list-providers.js                   # List available providers
├── index.js                            # CLI entry point
└── package.json
```

## ⚙️ Technical Details

- **Audio Format**: WAV 16kHz mono
- **Transcription**: Pluggable provider system (Nexara, Palatine, OpenAI, etc.)
- **Clipboard**: xclip/wl-copy auto-detection with Wayland workaround
- **System Tray**: Python + GTK3 + AyatanaAppIndicator3 (Ubuntu 25 standard)
- **Process Control**: PID files + SIGUSR1 signals
- **Sounds**: MP3/WAV playback via paplay/mpg123/aplay
- **Logging**: Session logs with 1MB rotation in var/logs/
- **Config**: JSON file shared between tray app and voice input
- **Notebook Mode**: Recordings joined with newlines, buffer preserved on settings change

## 🐛 Troubleshooting

### System Tray Not Showing

```bash
# Check if tray app is running
ps aux | grep tray-app.py

# Check dependencies
python3 -c "import gi; gi.require_version('AyatanaAppIndicator3', '0.1')"

# Restart tray app
pkill -f tray-app.py
./tray-app.py
```

### Microphone Issues
```bash
# List audio devices
arecord -l

# Test microphone
arecord -d 3 test.wav && aplay test.wav
```

### Clipboard Not Working
```bash
# Check clipboard tool
which wl-copy wl-paste xclip

# Test clipboard
echo "test" | wl-copy
wl-paste
```

### Settings Not Persisting

```bash
# Check config file
cat config.json

# Ensure tray app has write permissions
ls -la config.json
```

### Permission Issues
```bash
# Add user to audio group
sudo usermod -a -G audio $USER
# Logout and login again
```

## 📚 Documentation

- **[SYSTEM_TRAY.md](SYSTEM_TRAY.md)** - System tray documentation
- **[PROVIDER_ARCHITECTURE.md](docs/PROVIDER_ARCHITECTURE.md)** - Provider system details
- **[ADDING_PROVIDERS.md](docs/ADDING_PROVIDERS.md)** - Guide for adding new providers
- **[BUGFIX_SUMMARY.md](BUGFIX_SUMMARY.md)** - Clipboard fix details
- **[RACE_CONDITION_FIX.md](RACE_CONDITION_FIX.md)** - Notebook buffer fix details

## 📜 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Pull requests welcome! Please ensure:
- Code follows existing style
- Test your changes
- Update documentation if needed
- All code and commits in English

## ⭐ Show Your Support

If this project helped you, please give it a star! ⭐
