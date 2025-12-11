@echo off
echo Deleting redundant files...

REM Documentation files
del /F /Q "BEFORE_AFTER_COMPARISON.md" 2>nul
del /F /Q "CARPOOL_APP_FIXES_SUMMARY.md" 2>nul
del /F /Q "CARPOOL_BOOKING_SYSTEM.md" 2>nul
del /F /Q "CHANGELOG.md" 2>nul
del /F /Q "CODEBASE_FILE_MAP.md" 2>nul
del /F /Q "CODEBASE_OVERVIEW.md" 2>nul
del /F /Q "COMPREHENSIVE_IMPROVEMENTS_SUMMARY.md" 2>nul
del /F /Q "CONCURRENCY_FIXES_SUMMARY.md" 2>nul
del /F /Q "DELIVERY_FEATURE_SETUP.md" 2>nul
del /F /Q "DELIVERY_FIXES_SUMMARY.md" 2>nul
del /F /Q "DELIVERY_UX_REDESIGN_SUMMARY.md" 2>nul
del /F /Q "DEPLOYMENT_CHECKLIST.md" 2>nul
del /F /Q "DEPLOYMENT_FIX_INSTRUCTIONS.md" 2>nul
del /F /Q "DEPLOYMENT_GUIDE.md" 2>nul
del /F /Q "DEPLOYMENT_STATUS.md" 2>nul
del /F /Q "DEPLOY_FUNCTIONS_NOW.md" 2>nul
del /F /Q "DEPLOY_FUNCTIONS_QUICK_START.md" 2>nul
del /F /Q "DOCUMENTATION.md" 2>nul
del /F /Q "DUPLICATE_BOOKING_FIXES_SUMMARY.md" 2>nul
del /F /Q "ENHANCED_BOOKING_PAYMENT_FLOW.md" 2>nul
del /F /Q "FILTERING_AND_RATING_SYSTEM_SUMMARY.md" 2>nul
del /F /Q "FILTERING_SYSTEM_GUIDE.md" 2>nul
del /F /Q "FIREBASE_AUTH_DOMAIN_FIX.md" 2>nul
del /F /Q "FIREBASE_FIXES_APPLIED.md" 2>nul
del /F /Q "FIREBASE_FUNCTIONS_DEPLOYMENT_COMPLETE_FIX.md" 2>nul
del /F /Q "FIREBASE_FUNCTIONS_DEPLOYMENT_FINAL_FIX.md" 2>nul
del /F /Q "FIREBASE_FUNCTIONS_DEPLOYMENT_FIX_FINAL.md" 2>nul
del /F /Q "FIREBASE_FUNCTIONS_DEPLOYMENT_SOLUTION.md" 2>nul
del /F /Q "FIREBASE_FUNCTIONS_EMAIL_SETUP.md" 2>nul
del /F /Q "FIREBASE_FUNCTIONS_PRODUCTION_READY.md" 2>nul
del /F /Q "FIREBASE_FUNCTIONS_READY.md" 2>nul
del /F /Q "FIREBASE_FUNCTIONS_TYPESCRIPT_FIX.md" 2>nul
del /F /Q "FIREBASE_STORAGE_FIXES.md" 2>nul
del /F /Q "FIRESTORE_INDEX_DEPLOYMENT.md" 2>nul
del /F /Q "FIXES_APPLIED_SUMMARY.md" 2>nul
del /F /Q "FIX_NOW.md" 2>nul
del /F /Q "FUNCTIONS_CLEANUP_SUMMARY.md" 2>nul
del /F /Q "FUNCTIONS_DEPLOYMENT_COMPLETE_FIX.md" 2>nul
del /F /Q "FUNCTIONS_DEPLOYMENT_COMPLETE_SOLUTION.md" 2>nul
del /F /Q "FUNCTIONS_DEPLOYMENT_FIX.md" 2>nul
del /F /Q "FUNCTIONS_DEPLOYMENT_FIX_GUIDE.md" 2>nul
del /F /Q "FUNCTIONS_FIX_GUIDE.md" 2>nul
del /F /Q "IMPLEMENTATION_SUMMARY.md" 2>nul
del /F /Q "LEGACY_FIREBASE_FUNCTIONS_GUIDE.md" 2>nul
del /F /Q "PRICE_CONSISTENCY_FIX.md" 2>nul
del /F /Q "PRODUCTION_CHECKLIST.md" 2>nul
del /F /Q "PRODUCTION_READY_SUMMARY.md" 2>nul
del /F /Q "QUICK_FUNCTIONS_FIX.md" 2>nul
del /F /Q "QUICK_REFERENCE.md" 2>nul
del /F /Q "QUICK_START_FIX.md" 2>nul
del /F /Q "QUICK_START_PRODUCTION.md" 2>nul
del /F /Q "SECURITY_IMPLEMENTATION_GUIDE.md" 2>nul
del /F /Q "SIMPLE_FUNCTIONS_DEPLOYMENT_GUIDE.md" 2>nul
del /F /Q "SOLUTION_DIAGRAM.md" 2>nul
del /F /Q "START_HERE_FINAL.md" 2>nul
del /F /Q "START_HERE_FUNCTIONS.md" 2>nul
del /F /Q "STRIPE_INTEGRATION_GUIDE.md" 2>nul

REM Shell scripts
del /F /Q "deploy-functions-fixed.sh" 2>nul
del /F /Q "deploy-functions-production.sh" 2>nul
del /F /Q "deploy-indexes.sh" 2>nul
del /F /Q "deploy-now.sh" 2>nul
del /F /Q "fix-and-deploy-functions.sh" 2>nul
del /F /Q "fix-and-deploy.sh" 2>nul
del /F /Q "fix-deployment.sh" 2>nul
del /F /Q "fix-functions-deployment.sh" 2>nul
del /F /Q "fix-functions.sh" 2>nul
del /F /Q "quick-fix.sh" 2>nul
del /F /Q "switch-to-js.sh" 2>nul
del /F /Q "test-functions-build.sh" 2>nul
del /F /Q "verify-deployment.sh" 2>nul

REM Log files
del /F /Q "deploy-debug.txt" 2>nul
del /F /Q "deploy-error.txt" 2>nul
del /F /Q "deploy-final-debug.txt" 2>nul
del /F /Q "deploy-final.txt" 2>nul
del /F /Q "deploy-log.txt" 2>nul
del /F /Q "deploy-log3.txt" 2>nul

REM Legacy files
del /F /Q "firebase-functions-booking-flow.js" 2>nul
del /F /Q "firebase-functions-complete.js" 2>nul
del /F /Q "firebase-functions-stripe.js" 2>nul
del /F /Q "fix-functions-types.js" 2>nul
del /F /Q "test-firebase.js" 2>nul
del /F /Q "test.js" 2>nul
del /F /Q "TSCONFIG_FOR_FUNCTIONS.json" 2>nul

echo.
echo ✅ Cleanup complete!
echo.
echo Files KEPT:
echo - README.md
echo - FIREBASE_SETUP_GUIDE.md
echo - START_HERE.md
echo - deploy-functions.sh
echo - setup-functions.sh
echo.
echo ✅ All redundant files removed successfully!
