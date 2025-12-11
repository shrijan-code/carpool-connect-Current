#!/bin/bash

echo "Setting up Firebase Functions..."

# Navigate to functions directory
cd functions || exit 1

# Create package.json
echo "Creating package.json..."
cat > package.json << 'EOF'
{
  "name": "functions",
  "version": "2.0.0",
  "description": "Cloud Functions for Carpool App",
  "scripts": {
    "lint": "echo 'Skipping lint for deployment'",
    "build": "tsc --skipLibCheck",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "start": "npm run shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log"
  },
  "engines": {
    "node": "18"
  },
  "main": "lib/index.js",
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^4.5.0",
    "nodemailer": "^6.9.7"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/nodemailer": "^6.4.14",
    "typescript": "^5.3.3"
  },
  "private": true
}
EOF

# Create tsconfig.json
echo "Creating tsconfig.json..."
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": false,
    "outDir": "lib",
    "sourceMap": true,
    "strict": false,
    "target": "es2017",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "lib": ["es2017"]
  },
  "compileOnSave": true,
  "include": [
    "src"
  ],
  "exclude": [
    "node_modules"
  ]
}
EOF

# Install dependencies
echo "Installing dependencies..."
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. (Optional) Configure email: firebase functions:config:set email.user='your-email@gmail.com' email.password='your-app-password'"
echo "2. Build functions: cd functions && npm run build"
echo "3. Deploy: firebase deploy --only functions"
echo ""
