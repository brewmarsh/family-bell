#!/bin/bash
# build.sh

# Create the dist directory if it doesn't exist
mkdir -p custom_components/family_bell/frontend/dist

# Bundle the frontend assets using esbuild
npx esbuild ./custom_components/family_bell/frontend/src/family_bell_panel.js --bundle --outfile=./custom_components/family_bell/frontend/dist/family_bell_panel.js --allow-overwrite --log-level=verbose

echo "Build complete."