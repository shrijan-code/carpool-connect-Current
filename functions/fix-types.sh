#!/bin/bash

echo "Fixing TypeScript type issues..."

cd "$(dirname "$0")"

echo "Removing problematic type packages..."
npm uninstall @types/rimraf @types/glob --save-dev

echo "Installing compatible versions..."
npm install --save-dev typescript@4.9.5

echo "Cleaning build artifacts..."
rm -rf lib node_modules/.cache

echo "Rebuilding..."
npm run build

echo "Done! You can now deploy with: firebase deploy --only functions"
