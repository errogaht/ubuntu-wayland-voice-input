#!/bin/bash
trap '' HUP
cd /home/errogaht/aiprojects/voice-input

# Set LD_LIBRARY_PATH for sherpa-onnx-node (Parakeet V3 local transcription)
export LD_LIBRARY_PATH="$PWD/node_modules/sherpa-onnx-linux-x64:$LD_LIBRARY_PATH"

exec /home/errogaht/.nvm/versions/node/v22.20.0/bin/node index.js
