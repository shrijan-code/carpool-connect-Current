#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting custom build process...');

const tsconfigPath = path.join(__dirname, 'tsconfig.json');
const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));

tsconfig.compilerOptions = tsconfig.compilerOptions || {};
tsconfig.compilerOptions.skipLibCheck = true;
tsconfig.compilerOptions.noImplicitReturns = false;
tsconfig.compilerOptions.strict = false;

const tempTsconfigPath = path.join(__dirname, 'tsconfig.build.json');
fs.writeFileSync(tempTsconfigPath, JSON.stringify(tsconfig, null, 2));

try {
  console.log('Compiling TypeScript with custom config...');
  execSync(`npx tsc --project ${tempTsconfigPath} --noEmitOnError`, {
    stdio: 'inherit',
    cwd: __dirname
  });
  console.log('Build successful!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
} finally {
  if (fs.existsSync(tempTsconfigPath)) {
    fs.unlinkSync(tempTsconfigPath);
  }
}
