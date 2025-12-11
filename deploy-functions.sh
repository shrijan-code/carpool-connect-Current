#!/bin/bash

echo "========================================="
echo "Firebase Functions Deployment Script"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    echo -e "${RED}Error: firebase.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Checking Firebase CLI...${NC}"
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}Firebase CLI not found. Please install it with: npm install -g firebase-tools${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Firebase CLI found${NC}"
echo ""

echo -e "${YELLOW}Step 2: Checking functions directory...${NC}"
if [ ! -d "functions" ]; then
    echo -e "${RED}Error: functions directory not found${NC}"
    exit 1
fi

if [ ! -f "functions/index.js" ]; then
    echo -e "${RED}Error: functions/index.js not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Functions directory and index.js found${NC}"
echo ""

echo -e "${YELLOW}Step 3: Checking functions/package.json...${NC}"
cd functions

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}node_modules not found. Running npm install...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}npm install failed${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

cd ..

echo -e "${YELLOW}Step 4: Deploying functions to Firebase...${NC}"
echo ""
firebase deploy --only functions

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}✓ Deployment successful!${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    echo "Your functions are now live at:"
    echo "https://us-central1-carpoolconnect1-0.cloudfunctions.net/"
    echo ""
    echo "Available endpoints:"
    echo "  - ridesApi"
    echo "  - stripeApi"
    echo "  - stripeWebhook"
    echo "  - deliveryApi"
    echo "  - emergencyContactsApi"
    echo "  - safetyReportsApi"
    echo "  - healthCheck"
    echo ""
else
    echo ""
    echo -e "${RED}=========================================${NC}"
    echo -e "${RED}✗ Deployment failed${NC}"
    echo -e "${RED}=========================================${NC}"
    echo ""
    echo "Please check the error messages above."
    echo "Common issues:"
    echo "  1. Not logged in: Run 'firebase login'"
    echo "  2. Wrong project: Run 'firebase use carpoolconnect1-0'"
    echo "  3. Missing permissions: Check your Firebase project permissions"
    echo ""
    exit 1
fi
