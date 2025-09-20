#!/usr/bin/env node

/**
 * Enhanced Security validation script for UpTrends app
 * Run this before deploying to ensure all security measures are in place
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 Running comprehensive security validation...\n');

const checks = [];
const criticalIssues = [];
const warnings = [];

// Check 1: Ensure .env file exists and is in .gitignore
function checkEnvFile() {
  const envExists = fs.existsSync('.env');
  const gitignoreExists = fs.existsSync('.gitignore');
  
  if (!envExists) {
    checks.push({ name: 'Environment file', status: '❌', message: '.env file not found' });
    return;
  }
  
  if (!gitignoreExists) {
    checks.push({ name: 'Gitignore file', status: '❌', message: '.gitignore file not found' });
    return;
  }
  
  const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
  const envIgnored = gitignoreContent.includes('.env');
  
  if (!envIgnored) {
    checks.push({ name: 'Environment security', status: '❌', message: '.env not in .gitignore' });
    return;
  }
  
  checks.push({ name: 'Environment security', status: '✅', message: '.env file secured' });
}

// Check 2: Validate no hardcoded API keys in source files
function checkHardcodedKeys() {
  let foundHardcodedKey = false;
  const foundKeys = [];
  
  const suspiciousPatterns = [
    { pattern: /AIza[0-9A-Za-z-_]{35}/g, name: 'Gemini API key' },
    { pattern: /AIza[0-9A-Za-z-_]{39}/g, name: 'Firebase API key' },
    { pattern: /sk-[a-zA-Z0-9]{48}/g, name: 'OpenAI API key' },
    { pattern: /ya29\.[0-9A-Za-z\-_]+/g, name: 'Google OAuth token' },
    { pattern: /"[0-9]{10,}"/g, name: 'Potential Firebase sender ID' },
    { pattern: /1:[0-9]+:web:[a-f0-9]+/g, name: 'Firebase App ID' }
  ];
  
  function scanFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    suspiciousPatterns.forEach(({ pattern, name }) => {
      const matches = content.match(pattern);
      if (matches) {
        foundHardcodedKey = true;
        foundKeys.push({ file: filePath, type: name, matches: matches.length });
        console.log(`🚨 CRITICAL: ${name} found in: ${filePath}`);
      }
    });
  }
  
  // Scan specific files
  const filesToScan = [
    'services/geminiService.ts',
    'services/wardrobeService.ts',
    'services/styleCheckService.ts',
    'services/analyticsService.ts',
    'firebaseConfig.js',
    'firebaseConfig.ts'
  ];
  
  filesToScan.forEach(scanFile);
  
  // Scan app directory
  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.')) {
        scanDirectory(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
        scanFile(filePath);
      }
    });
  }
  
  scanDirectory('app');
  scanDirectory('services');
  scanDirectory('config');
  
  if (foundHardcodedKey) {
    criticalIssues.push(`Hardcoded credentials found in ${foundKeys.length} locations`);
    checks.push({ 
      name: 'Hardcoded keys', 
      status: '🚨', 
      message: `CRITICAL: Found ${foundKeys.length} hardcoded credentials` 
    });
  } else {
    checks.push({ name: 'Hardcoded keys', status: '✅', message: 'No hardcoded keys detected' });
  }
}

// Check 3: Validate environment variables are used correctly
function checkEnvUsage() {
  const geminiServiceExists = fs.existsSync('services/geminiService.ts');
  const wardrobeServiceExists = fs.existsSync('services/wardrobeService.ts');
  
  if (!geminiServiceExists || !wardrobeServiceExists) {
    checks.push({ name: 'Service files', status: '❌', message: 'Service files not found' });
    return;
  }
  
  const geminiContent = fs.readFileSync('services/geminiService.ts', 'utf8');
  const wardrobeContent = fs.readFileSync('services/wardrobeService.ts', 'utf8');
  
  const usesEnvVar = (geminiContent.includes('getSecureApiKey') || geminiContent.includes('process.env.EXPO_PUBLIC_GEMINI_API_KEY')) &&
                    (wardrobeContent.includes('getSecureApiKey') || wardrobeContent.includes('process.env.EXPO_PUBLIC_GEMINI_API_KEY'));
  
  if (usesEnvVar) {
    checks.push({ name: 'Environment variables', status: '✅', message: 'Services use environment variables' });
  } else {
    checks.push({ name: 'Environment variables', status: '❌', message: 'Services not using environment variables' });
  }
}

// Check 4: Validate security config exists
function checkSecurityConfig() {
  const securityConfigExists = fs.existsSync('config/security.ts');
  
  if (securityConfigExists) {
    const content = fs.readFileSync('config/security.ts', 'utf8');
    const hasRateLimiting = content.includes('RateLimiter');
    const hasValidation = content.includes('validateEnvironment');
    
    if (hasRateLimiting && hasValidation) {
      checks.push({ name: 'Security configuration', status: '✅', message: 'Security config complete' });
    } else {
      checks.push({ name: 'Security configuration', status: '⚠️', message: 'Security config incomplete' });
    }
  } else {
    checks.push({ name: 'Security configuration', status: '❌', message: 'Security config not found' });
  }
}

// Check 5: Validate .gitignore completeness
function checkGitignore() {
  if (!fs.existsSync('.gitignore')) {
    checks.push({ name: 'Gitignore completeness', status: '❌', message: '.gitignore not found' });
    return;
  }
  
  const content = fs.readFileSync('.gitignore', 'utf8');
  const requiredEntries = ['.env', '*.env', '.env.local', 'config/keys.js'];
  const missingEntries = requiredEntries.filter(entry => !content.includes(entry));
  
  if (missingEntries.length === 0) {
    checks.push({ name: 'Gitignore completeness', status: '✅', message: 'All sensitive files ignored' });
  } else {
    checks.push({ name: 'Gitignore completeness', status: '⚠️', message: `Missing: ${missingEntries.join(', ')}` });
  }
}

// Run all checks
checkEnvFile();
checkHardcodedKeys();
checkEnvUsage();
checkSecurityConfig();
checkGitignore();
checkFirebaseConfig();
checkEnvStructure();

// Check 6: Validate Firebase config security
function checkFirebaseConfig() {
  const configFiles = ['firebaseConfig.js', 'firebaseConfig.ts'];
  let configFound = false;
  let usesEnvVars = false;
  
  configFiles.forEach(file => {
    if (fs.existsSync(file)) {
      configFound = true;
      const content = fs.readFileSync(file, 'utf8');
      
      // Check if using environment variables
      if (content.includes('process.env.EXPO_PUBLIC_FIREBASE_') && !content.includes('||')) {
        usesEnvVars = true;
      }
      
      // Check for hardcoded Firebase credentials
      if (content.includes('AIza') || content.includes('firebaseapp.com') || content.includes('1:')) {
        if (!content.includes('process.env')) {
          criticalIssues.push(`Hardcoded Firebase credentials in ${file}`);
        }
      }
    }
  });
  
  if (!configFound) {
    checks.push({ name: 'Firebase config', status: '❌', message: 'Firebase config not found' });
  } else if (usesEnvVars) {
    checks.push({ name: 'Firebase config', status: '✅', message: 'Using environment variables' });
  } else {
    checks.push({ name: 'Firebase config', status: '🚨', message: 'CRITICAL: Not using env vars' });
    criticalIssues.push('Firebase config not using environment variables');
  }
}

// Check 7: Validate .env file structure
function checkEnvStructure() {
  if (!fs.existsSync('.env')) {
    checks.push({ name: 'Environment file', status: '❌', message: '.env file missing' });
    criticalIssues.push('.env file not found');
    return;
  }
  
  const envContent = fs.readFileSync('.env', 'utf8');
  const requiredVars = [
    'EXPO_PUBLIC_GEMINI_API_KEY',
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID'
  ];
  
  const missingVars = requiredVars.filter(varName => !envContent.includes(varName));
  
  if (missingVars.length > 0) {
    warnings.push(`Missing environment variables: ${missingVars.join(', ')}`);
    checks.push({ 
      name: 'Environment structure', 
      status: '⚠️', 
      message: `Missing ${missingVars.length} required variables` 
    });
  } else {
    checks.push({ name: 'Environment structure', status: '✅', message: 'All required variables present' });
  }
}

// Display results
console.log('Security Validation Results:');
console.log('============================\n');

let hasCriticalIssues = false;
let hasWarnings = false;

checks.forEach(check => {
  console.log(`${check.status} ${check.name}: ${check.message}`);
  if (check.status === '🚨' || check.status === '❌') {
    hasCriticalIssues = true;
  }
  if (check.status === '⚠️') {
    hasWarnings = true;
  }
});

console.log('\n============================');

if (criticalIssues.length > 0) {
  console.log('\n🚨 CRITICAL SECURITY ISSUES:');
  criticalIssues.forEach(issue => console.log(`   • ${issue}`));
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:');
  warnings.forEach(warning => console.log(`   • ${warning}`));
}

console.log('\n============================');

if (hasCriticalIssues) {
  console.log('🚨 CRITICAL SECURITY ISSUES FOUND! DO NOT DEPLOY!');
  console.log('Please fix all critical issues before proceeding.');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  Some warnings found. Review before deploying.');
  process.exit(0);
} else {
  console.log('🎉 All security checks passed! Ready for deployment.');
  process.exit(0);
}