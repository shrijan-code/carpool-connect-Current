# CarpoolConnect Codebase Cleanup Script
# Safely removes redundant documentation, logs, and legacy files
# Run this from the project root directory

Write-Host "🧹 CarpoolConnect Codebase Cleanup" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# Safety check
$currentDir = Get-Location
Write-Host "Current directory: $currentDir" -ForegroundColor Yellow
$confirm = Read-Host "This will delete ~70-80 redundant files. Continue? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "❌ Cleanup cancelled" -ForegroundColor Red
    exit
}

$deletedCount = 0
$errorCount = 0

# Function to safely delete file
function Remove-SafeFile {
    param($filePath)
    if (Test-Path $filePath) {
        try {
            Remove-Item $filePath -Force
            Write-Host "✅ Deleted: $filePath" -ForegroundColor Green
            $script:deletedCount++
        }
        catch {
            Write-Host "❌ Error deleting: $filePath" -ForegroundColor Red
            $script:errorCount++
        }
    }
}

Write-Host "`n📚 Deleting redundant documentation files..." -ForegroundColor Cyan

# Deployment Guides (Delete 14, Keep README.md)
$deploymentDocs = @(
    "BEFORE_AFTER_COMPARISON.md",
    "DEPLOYMENT_CHECKLIST.md",
    "DEPLOYMENT_FIX_INSTRUCTIONS.md",
    "DEPLOYMENT_GUIDE.md",
    "DEPLOYMENT_STATUS.md",
    "DEPLOY_FUNCTIONS_NOW.md",
    "DEPLOY_FUNCTIONS_QUICK_START.md",
    "SIMPLE_FUNCTIONS_DEPLOYMENT_GUIDE.md",
    "FIREBASE_FUNCTIONS_DEPLOYMENT_COMPLETE_FIX.md",
    "FIREBASE_FUNCTIONS_DEPLOYMENT_FINAL_FIX.md",
    "FIREBASE_FUNCTIONS_DEPLOYMENT_FIX_FINAL.md",
    "FIREBASE_FUNCTIONS_DEPLOYMENT_SOLUTION.md",
    "FUNCTIONS_DEPLOYMENT_COMPLETE_FIX.md",
    "FUNCTIONS_DEPLOYMENT_COMPLETE_SOLUTION.md",
    "FUNCTIONS_DEPLOYMENT_FIX.md",
    "FUNCTIONS_DEPLOYMENT_FIX_GUIDE.md"
)

foreach ($file in $deploymentDocs) {
    Remove-SafeFile $file
}

# Firebase Setup Guides (Delete 9, Keep FIREBASE_SETUP_GUIDE.md)
$firebaseDocs = @(
    "FIREBASE_AUTH_DOMAIN_FIX.md",
    "FIREBASE_FIXES_APPLIED.md",
    "FIREBASE_FUNCTIONS_EMAIL_SETUP.md",
    "FIREBASE_FUNCTIONS_PRODUCTION_READY.md",
    "FIREBASE_FUNCTIONS_READY.md",
    "FIREBASE_FUNCTIONS_TYPESCRIPT_FIX.md",
    "FIREBASE_STORAGE_FIXES.md",
    "FIRESTORE_INDEX_DEPLOYMENT.md",
    "LEGACY_FIREBASE_FUNCTIONS_GUIDE.md"
)

foreach ($file in $firebaseDocs) {
    Remove-SafeFile $file
}

# Implementation Summaries (Delete 15)
$summaryDocs = @(
    "CARPOOL_APP_FIXES_SUMMARY.md",
    "CARPOOL_BOOKING_SYSTEM.md",
    "COMPREHENSIVE_IMPROVEMENTS_SUMMARY.md",
    "CONCURRENCY_FIXES_SUMMARY.md",
    "DELIVERY_FEATURE_SETUP.md",
    "DELIVERY_FIXES_SUMMARY.md",
    "DELIVERY_UX_REDESIGN_SUMMARY.md",
    "DUPLICATE_BOOKING_FIXES_SUMMARY.md",
    "ENHANCED_BOOKING_PAYMENT_FLOW.md",
    "FILTERING_AND_RATING_SYSTEM_SUMMARY.md",
    "FILTERING_SYSTEM_GUIDE.md",
    "FIXES_APPLIED_SUMMARY.md",
    "FUNCTIONS_CLEANUP_SUMMARY.md",
    "IMPLEMENTATION_SUMMARY.md",
    "PRODUCTION_READY_SUMMARY.md"
)

foreach ($file in $summaryDocs) {
    Remove-SafeFile $file
}

# Quick Start Guides (Delete 7, Keep START_HERE.md)
$quickStartDocs = @(
    "START_HERE_FINAL.md",
    "START_HERE_FUNCTIONS.md",
    "QUICK_START_FIX.md",
    "QUICK_START_PRODUCTION.md",
    "QUICK_REFERENCE.md",
    "FIX_NOW.md",
    "FUNCTIONS_FIX_GUIDE.md",
    "QUICK_FUNCTIONS_FIX.md"
)

foreach ($file in $quickStartDocs) {
    Remove-SafeFile $file
}

# Other Documentation (Delete 9)
$otherDocs = @(
    "CHANGELOG.md",
    "CODEBASE_FILE_MAP.md",
    "CODEBASE_OVERVIEW.md",
    "DOCUMENTATION.md",
    "PRODUCTION_CHECKLIST.md",
    "SECURITY_IMPLEMENTATION_GUIDE.md",
    "SOLUTION_DIAGRAM.md",
    "STRIPE_INTEGRATION_GUIDE.md",
    "PRICE_CONSISTENCY_FIX.md"
)

foreach ($file in $otherDocs) {
    Remove-SafeFile $file
}

Write-Host "`n🔧 Deleting redundant shell scripts..." -ForegroundColor Cyan

# Shell Scripts (Delete 13, Keep deploy-functions.sh and setup-functions.sh)
$scripts = @(
    "deploy-functions-fixed.sh",
    "deploy-functions-production.sh",
    "deploy-indexes.sh",
    "deploy-now.sh",
    "fix-and-deploy-functions.sh",
    "fix-and-deploy.sh",
    "fix-deployment.sh",
    "fix-functions-deployment.sh",
    "fix-functions.sh",
    "quick-fix.sh",
    "switch-to-js.sh",
    "test-functions-build.sh",
    "verify-deployment.sh"
)

foreach ($file in $scripts) {
    Remove-SafeFile $file
}

Write-Host "`n📄 Deleting log files..." -ForegroundColor Cyan

# Log Files (Delete ALL)
$logFiles = @(
    "deploy-debug.txt",
    "deploy-error.txt",
    "deploy-final-debug.txt",
    "deploy-final.txt",
    "deploy-log.txt",
    "deploy-log3.txt"
)

foreach ($file in $logFiles) {
    Remove-SafeFile $file
}

Write-Host "`n🗂️ Deleting legacy/test files..." -ForegroundColor Cyan

# Legacy Files (Delete 7)
$legacyFiles = @(
    "firebase-functions-booking-flow.js",
    "firebase-functions-complete.js",
    "firebase-functions-stripe.js",
    "fix-functions-types.js",
    "test-firebase.js",
    "test.js",
    "TSCONFIG_FOR_FUNCTIONS.json"
)

foreach ($file in $legacyFiles) {
    Remove-SafeFile $file
}

# Check for unnecessary directories
Write-Host "`n📁 Checking for unnecessary directories..." -ForegroundColor Cyan

if (Test-Path "Users") {
    $userFiles = Get-ChildItem "Users" -Recurse -File
    if ($userFiles.Count -eq 0) {
        Write-Host "⚠️  Found empty 'Users' directory - consider removing manually" -ForegroundColor Yellow
    }
    else {
        Write-Host "⚠️  'Users' directory contains files - review manually" -ForegroundColor Yellow
    }
}

# Summary
Write-Host "`n====================================")) -ForegroundColor Cyan
Write-Host "✨ Cleanup Complete!" -ForegroundColor Green
Write-Host "`n📊 Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Files deleted: $deletedCount" -ForegroundColor Green
if ($errorCount -gt 0) {
    Write-Host "  ❌ Errors: $errorCount" -ForegroundColor Red
}

Write-Host "`n📝 Files KEPT (important):" -ForegroundColor Yellow
Write-Host "  - README.md (main documentation)"
Write-Host "  - FIREBASE_SETUP_GUIDE.md (Firebase setup)"
Write-Host "  - START_HERE.md (getting started)"
Write-Host "  - deploy-functions.sh (deployment)"
Write-Host "  - setup-functions.sh (setup)"

Write-Host "`n🔍 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Run 'npm run build' to verify everything still works"
Write-Host "  2. Test the app to ensure functionality"
Write-Host "  3. Commit changes: git add . && git commit -m 'chore: remove redundant files'"
Write-Host "  4. Review remaining codebase for unused imports"

Write-Host "`n✅ Safe to proceed with app development!" -ForegroundColor Green
