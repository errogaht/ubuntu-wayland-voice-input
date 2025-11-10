#!/usr/bin/env python3
"""
Voice Input System Tray Application
Ubuntu 25 Wayland compatible system tray with AppIndicator3
"""

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('AyatanaAppIndicator3', '0.1')
from gi.repository import Gtk, GLib
from gi.repository import AyatanaAppIndicator3 as AppIndicator3
import json
import os
import signal
import sys

class VoiceInputTray:
    def __init__(self):
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.config_path = os.path.join(self.script_dir, 'config.json')
        self.icon_path = os.path.join(self.script_dir, 'assets', 'icon.png')

        # Load configuration
        self.config = self.load_config()

        # Create the indicator
        self.indicator = AppIndicator3.Indicator.new(
            "voice-input-indicator",
            "microphone-sensitivity-high",  # Default icon from system theme
            AppIndicator3.IndicatorCategory.APPLICATION_STATUS
        )
        self.indicator.set_status(AppIndicator3.IndicatorStatus.ACTIVE)

        # Build and set the menu
        self.build_menu()

    def load_config(self):
        """Load configuration from config.json"""
        try:
            with open(self.config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            # Create default config if not exists
            default_config = {
                "mode": "normal",
                "addPrefix": True,
                "addSuffix": True,
                "notebookBuffer": []
            }
            self.save_config(default_config)
            return default_config
        except json.JSONDecodeError:
            print("Error: config.json is corrupted. Using defaults.")
            return {
                "mode": "normal",
                "addPrefix": True,
                "addSuffix": True,
                "notebookBuffer": []
            }

    def save_config(self, config=None):
        """Save configuration to config.json - preserves notebookBuffer"""
        if config is None:
            config = self.config

        try:
            # Read current config from file to preserve notebookBuffer
            current_config = {}
            try:
                with open(self.config_path, 'r') as f:
                    current_config = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                pass

            # Update only the fields we care about, preserve notebookBuffer
            merged_config = {
                "mode": config.get('mode', 'normal'),
                "addPrefix": config.get('addPrefix', True),
                "addSuffix": config.get('addSuffix', True),
                "notebookBuffer": current_config.get('notebookBuffer', [])
            }

            # Write merged config
            with open(self.config_path, 'w') as f:
                json.dump(merged_config, f, indent=2)

        except Exception as e:
            print(f"Error saving config: {e}")

    def build_menu(self):
        """Build the system tray menu"""
        menu = Gtk.Menu()

        # ===== Mode Selection =====
        mode_label = Gtk.MenuItem(label="Mode:")
        mode_label.set_sensitive(False)  # Make it a label, not clickable
        menu.append(mode_label)

        # Normal mode radio button
        self.normal_mode_item = Gtk.RadioMenuItem(label="Normal Mode")
        self.normal_mode_item.set_active(self.config['mode'] == 'normal')
        self.normal_mode_item.connect("activate", self.on_mode_changed, "normal")
        menu.append(self.normal_mode_item)

        # Notebook mode radio button
        self.notebook_mode_item = Gtk.RadioMenuItem(group=self.normal_mode_item, label="Notebook Mode")
        self.notebook_mode_item.set_active(self.config['mode'] == 'notebook')
        self.notebook_mode_item.connect("activate", self.on_mode_changed, "notebook")
        menu.append(self.notebook_mode_item)

        # Separator
        menu.append(Gtk.SeparatorMenuItem())

        # ===== Prefix/Suffix Toggles =====
        options_label = Gtk.MenuItem(label="Options:")
        options_label.set_sensitive(False)
        menu.append(options_label)

        # Add prefix checkbox
        self.prefix_item = Gtk.CheckMenuItem(label='Add Prefix "[Voice - verify]:"')
        self.prefix_item.set_active(self.config['addPrefix'])
        self.prefix_item.connect("toggled", self.on_prefix_toggled)
        menu.append(self.prefix_item)

        # Add suffix checkbox
        self.suffix_item = Gtk.CheckMenuItem(label='Add Suffix ". ultrathink"')
        self.suffix_item.set_active(self.config['addSuffix'])
        self.suffix_item.connect("toggled", self.on_suffix_toggled)
        menu.append(self.suffix_item)

        # Separator
        menu.append(Gtk.SeparatorMenuItem())

        # ===== Notebook Actions =====
        # Clear notebook buffer (only visible in notebook mode)
        self.clear_buffer_item = Gtk.MenuItem(label="Clear Notebook Buffer")
        self.clear_buffer_item.connect("activate", self.on_clear_buffer)
        menu.append(self.clear_buffer_item)

        # Update visibility based on current mode
        self.update_menu_visibility()

        # Separator
        menu.append(Gtk.SeparatorMenuItem())

        # ===== Quit =====
        quit_item = Gtk.MenuItem(label="Quit")
        quit_item.connect("activate", self.quit)
        menu.append(quit_item)

        menu.show_all()
        self.indicator.set_menu(menu)
        self.menu = menu  # Keep reference for updates

    def update_menu_visibility(self):
        """Update menu items visibility based on current mode"""
        is_notebook = self.config['mode'] == 'notebook'
        self.clear_buffer_item.set_visible(is_notebook)

    def on_mode_changed(self, widget, mode):
        """Handle mode change"""
        if widget.get_active():
            self.config['mode'] = mode
            self.save_config()
            self.update_menu_visibility()
            print(f"Mode changed to: {mode}")

    def on_prefix_toggled(self, widget):
        """Handle prefix toggle"""
        self.config['addPrefix'] = widget.get_active()
        self.save_config()
        print(f"Add prefix: {self.config['addPrefix']}")

    def on_suffix_toggled(self, widget):
        """Handle suffix toggle"""
        self.config['addSuffix'] = widget.get_active()
        self.save_config()
        print(f"Add suffix: {self.config['addSuffix']}")

    def on_clear_buffer(self, widget):
        """Clear the notebook buffer"""
        try:
            # Read current config, clear buffer, save back
            with open(self.config_path, 'r') as f:
                current_config = json.load(f)

            current_config['notebookBuffer'] = []

            with open(self.config_path, 'w') as f:
                json.dump(current_config, f, indent=2)

            print("Notebook buffer cleared")

            # Show notification (optional)
            try:
                import subprocess
                subprocess.run([
                    'notify-send',
                    'Voice Input',
                    'Notebook buffer cleared',
                    '-i', 'edit-clear',
                    '-t', '2000'
                ], check=False)
            except:
                pass  # Notification is optional

        except Exception as e:
            print(f"Error clearing buffer: {e}")

    def quit(self, widget):
        """Quit the application"""
        print("Quitting Voice Input Tray")
        Gtk.main_quit()

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully"""
    print("\nShutting down...")
    Gtk.main_quit()

def main():
    # Handle Ctrl+C
    signal.signal(signal.SIGINT, signal_handler)

    # Create tray application
    tray = VoiceInputTray()

    print("Voice Input Tray started")
    print("Configuration file:", tray.config_path)
    print("Current mode:", tray.config['mode'])

    # Start GTK main loop
    # Use GLib timeout to allow signal handling
    GLib.timeout_add(100, lambda: True)

    try:
        Gtk.main()
    except KeyboardInterrupt:
        print("\nShutting down...")
        sys.exit(0)

if __name__ == '__main__':
    main()
