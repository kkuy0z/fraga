#!/usr/bin/env node

/**
 * Generate VAPID keys for push notifications
 * Run with: node generate-vapid-keys.js
 */

import webPush from 'web-push';

const keys = webPush.generateVAPIDKeys();

console.log('=== VAPID Keys for Push Notifications ===\n');
console.log('Add these to your .env file:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:admin@fragalanches.com`);
console.log('\n=== Public Key (for client) ===');
console.log(keys.publicKey);
console.log('\n=== Private Key (keep secret!) ===');
console.log(keys.privateKey);