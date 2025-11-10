# Voice Input System Tray

System tray application for configuring Voice Input settings on Ubuntu 25 with Wayland.

## Features

- 🎯 **System Tray Icon** - Always accessible from Ubuntu top bar
- 📓 **Notebook Mode** - Accumulate multiple recordings into one buffer
- ⚙️ **Configurable Prefix/Suffix** - Toggle "[Voice - verify]:" and ". ultrathink"
- 💾 **Persistent Settings** - Configuration saved to `config.json`
- 🚀 **Autostart** - Starts automatically on login

## Installation

### Quick Install

```bash
./install-tray.sh
```

This will:
1. Check Python dependencies (AyatanaAppIndicator3)
2. Make tray script executable
3. Install autostart configuration

### Manual Installation

If you prefer to install manually:

```bash
# 1. Install dependencies (if needed)
sudo apt-get install gir1.2-ayatanaappindicator3-0.1 python3-gi

# 2. Make script executable
chmod +x tray-app.py

# 3. Copy to autostart
mkdir -p ~/.config/autostart
cp voice-input-tray.desktop ~/.config/autostart/

# 4. Update Exec path in desktop file
sed -i "s|Exec=.*|Exec=$(pwd)/tray-app.py|g" ~/.config/autostart/voice-input-tray.desktop
```

## Usage

### Starting the Tray Application

**Option 1: Start manually**
```bash
./tray-app.py
```

**Option 2: Logout and login** (autostart will launch it)

### Accessing the Menu

1. Look for the microphone icon (🎤) in the Ubuntu top bar (right side)
2. Right-click the icon to open the settings menu

### Configuration Options

#### Mode Selection

**Normal Mode** (default)
- Each recording is transcribed and copied to clipboard independently
- Simple workflow: Record → Transcribe → Paste

**Notebook Mode**
- Recordings accumulate in a buffer
- Each new recording adds to the previous ones
- Useful for long tasks (reading articles, taking notes)
- Buffer is automatically copied after each recording
- Clear buffer via tray menu when done

#### Options

**Add Prefix "[Voice - verify]:"**
- ✅ Enabled: Text starts with `[Voice - verify]: `
- ❌ Disabled: No prefix added

**Add Suffix ". ultrathink"**
- ✅ Enabled: Text ends with `. ultrathink`
- ❌ Disabled: No suffix added

#### Notebook Actions

**Clear Notebook Buffer**
- Only visible in Notebook Mode
- Clears all accumulated recordings
- Shows desktop notification when cleared

## Configuration File

Settings are stored in `config.json`:

```json
{
  "mode": "normal",
  "addPrefix": true,
  "addSuffix": true,
  "notebookBuffer": []
}
```

- **mode**: `"normal"` or `"notebook"`
- **addPrefix**: `true` or `false`
- **addSuffix**: `true` or `false`
- **notebookBuffer**: Array of accumulated transcriptions (in notebook mode)

## Examples

### Example 1: Default Configuration

**Settings:**
- Mode: Normal
- Add Prefix: ✅
- Add Suffix: ✅

**Input:** "Hello world"

**Output:** `[Voice - verify]: Hello world. ultrathink`

---

### Example 2: Notebook Mode

**Settings:**
- Mode: Notebook
- Add Prefix: ✅
- Add Suffix: ✅

**Recording 1:** "This is the first note"
**Recording 2:** "This is the second note"
**Recording 3:** "This is the third note"

**Final buffer:** `[Voice - verify]: This is the first note This is the second note This is the third note. ultrathink`

---

### Example 3: No Prefix/Suffix

**Settings:**
- Mode: Normal
- Add Prefix: ❌
- Add Suffix: ❌

**Input:** "Hello world"

**Output:** `Hello world`

## Workflow Examples

### Reading Long Articles (Notebook Mode)

1. **Enable Notebook Mode** via tray menu
2. Start reading article
3. When you want to add a note:
   - Press hotkey
   - Speak your note (5-10 seconds)
   - Press hotkey again
4. Repeat step 3 for each note
5. When finished reading:
   - **Clear Notebook Buffer** via tray menu
   - Or continue using for next article

**Result:** All your notes are accumulated and ready to paste with Ctrl+V

### Quick Voice Input (Normal Mode)

1. **Use Normal Mode** (default)
2. Press hotkey
3. Speak your text
4. Press hotkey again
5. Paste with Ctrl+V

**Result:** Single transcription ready to paste

## Testing

### Test Configuration Loading

```bash
node test-config.js
```

This will test:
- Config file loading
- Prefix/suffix toggling
- Notebook mode simulation

### Test System Integration

1. Start tray application: `./tray-app.py`
2. Change settings in tray menu
3. Run voice input: `node index.js`
4. Verify settings are applied

## Troubleshooting

### Tray icon doesn't appear

**Check if dependencies are installed:**
```bash
python3 -c "import gi; gi.require_version('AyatanaAppIndicator3', '0.1')"
```

If error, install:
```bash
sudo apt-get install gir1.2-ayatanaappindicator3-0.1 python3-gi
```

### Settings not persisting

**Check config.json exists and is writable:**
```bash
ls -la config.json
```

**Check tray app output:**
```bash
./tray-app.py
# Look for config loading messages
```

### Notebook buffer not clearing

1. Open tray menu
2. Ensure you're in **Notebook Mode**
3. Click **Clear Notebook Buffer**
4. Check for desktop notification
5. Verify `config.json` shows empty array:
   ```bash
   cat config.json | grep notebookBuffer
   ```

### Config changes not applied to recordings

The config is reloaded before each transcription copy. If changes aren't applied:

1. Verify config.json is updated after changing settings in tray
2. Check VoiceInputApp.js:410 - config reload happens there
3. Test with: `node test-config.js`

## Technical Details

### Architecture

```
┌─────────────────┐
│   tray-app.py   │  Python + GTK + AyatanaAppIndicator3
│  (System Tray)  │  Manages user settings via GUI menu
└────────┬────────┘
         │ Writes
         ▼
    config.json ◄────────┐
         │ Reads         │
         ▼               │ Reloads before
┌─────────────────┐     │ each copy
│ VoiceInputApp.js│─────┘
│  (Node.js Core) │
└─────────────────┘
```

### Components

- **tray-app.py**: GTK3 application with AyatanaAppIndicator3
- **config.json**: Shared configuration file
- **VoiceInputApp.js**: Reads config on each transcription

### Dependencies

- Python 3
- PyGObject (gi)
- AyatanaAppIndicator3 (Ubuntu 25 system tray)
- GTK 3

## See Also

- [Main README](README.md) - Voice Input overview
- [CLAUDE.md](CLAUDE.md) - Project documentation
- [Provider Architecture](docs/PROVIDER_ARCHITECTURE.md)
