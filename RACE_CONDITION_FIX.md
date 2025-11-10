# Race Condition Fix - Notebook Buffer

## Problem

When using **Notebook Mode**, changing any checkbox option (prefix/suffix) in the tray menu would **reset the accumulated buffer**, losing all recorded transcriptions.

### Scenario:
1. User enables Notebook Mode
2. Makes 4 voice recordings → buffer contains 4 transcriptions
3. User toggles suffix checkbox in tray menu
4. **Buffer gets cleared** - all 4 recordings lost!

## Root Cause

**Race condition** between tray app and voice input app:

1. Tray app loads config at startup into memory (`self.config`)
2. User makes recordings → VoiceInputApp writes to `config.json` updating `notebookBuffer`
3. User toggles checkbox → Tray app calls `save_config()`
4. **Problem**: Tray app saves its **in-memory** config, which has empty `notebookBuffer`
5. File gets overwritten → buffer is lost!

```python
# OLD CODE - BUGGY
def save_config(self, config=None):
    if config is None:
        config = self.config  # Uses stale in-memory config!

    with open(self.config_path, 'w') as f:
        json.dump(config, f, indent=2)  # Overwrites entire file
```

## Solution

**Always read from file before saving** to preserve `notebookBuffer`:

```python
# NEW CODE - FIXED
def save_config(self, config=None):
    if config is None:
        config = self.config

    try:
        # 1. Read current config from file
        current_config = {}
        try:
            with open(self.config_path, 'r') as f:
                current_config = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            pass

        # 2. Merge: update UI fields, preserve notebookBuffer
        merged_config = {
            "mode": config.get('mode', 'normal'),
            "addPrefix": config.get('addPrefix', True),
            "addSuffix": config.get('addSuffix', True),
            "notebookBuffer": current_config.get('notebookBuffer', [])
        }

        # 3. Write merged config
        with open(self.config_path, 'w') as f:
            json.dump(merged_config, f, indent=2)

    except Exception as e:
        print(f"Error saving config: {e}")
```

### Key Changes:
1. ✅ **Read file first** - get latest `notebookBuffer`
2. ✅ **Merge configs** - update only UI fields (mode, prefix, suffix)
3. ✅ **Preserve buffer** - always keep `notebookBuffer` from file
4. ✅ **Same fix for clear_buffer** - also reads file first

## Testing

Created test script that simulates the race condition:

```bash
./test-notebook-race-condition.sh
```

### Test Steps:
1. Set Notebook Mode, no prefix/suffix
2. Add 4 recordings to buffer (simulated)
3. Toggle suffix checkbox (simulated tray app behavior)
4. Verify buffer is **preserved**

### Test Results:
```
✅ SUCCESS: Buffer preserved after checkbox toggle!
   All 4 recordings are still in the buffer
```

## Files Modified

- **tray-app.py**:
  - `save_config()` - now preserves `notebookBuffer`
  - `on_clear_buffer()` - reads file first before clearing

## Verification

To verify the fix works:

1. **Enable Notebook Mode** in tray menu
2. Make 2-3 voice recordings
3. **Toggle any checkbox** (prefix or suffix)
4. Make another recording
5. **Paste with Ctrl+V** - should see ALL recordings

Expected result:
```
[Voice - verify]: First Second Third. ultrathink
```

All recordings should be present, not just the last one.

## Status

✅ **Race condition fixed**
✅ **Buffer preserved** across checkbox changes
✅ **Tested** with automated script
✅ **Documented**
