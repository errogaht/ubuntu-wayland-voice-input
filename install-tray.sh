#!/bin/bash
# Install Voice Input system tray application

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
AUTOSTART_DIR="$HOME/.config/autostart"
DESKTOP_FILE="voice-input-tray.desktop"

echo "Installing Voice Input Tray..."

# Check Python dependencies
echo "Checking Python dependencies..."
python3 -c "import gi; gi.require_version('AyatanaAppIndicator3', '0.1')" 2>/dev/null || {
    echo "Error: AyatanaAppIndicator3 not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y gir1.2-ayatanaappindicator3-0.1 python3-gi
}

# Make tray script executable
chmod +x "$SCRIPT_DIR/tray-app.py"

# Create autostart directory if it doesn't exist
mkdir -p "$AUTOSTART_DIR"

# Update Exec path in desktop file with absolute path
sed "s|Exec=.*|Exec=$SCRIPT_DIR/tray-app.py|g" "$SCRIPT_DIR/$DESKTOP_FILE" > "$AUTOSTART_DIR/$DESKTOP_FILE"

echo "✅ Voice Input Tray installed successfully!"
echo ""
echo "The tray application will start automatically on login."
echo "To start it now, run:"
echo "  $SCRIPT_DIR/tray-app.py"
echo ""
echo "Or logout and login again for autostart to take effect."
