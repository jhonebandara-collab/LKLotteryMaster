#!/usr/bin/env node
/**
 * Generates a self-signed certificate so the app can be served over HTTPS.
 *
 * Why this matters: mobile browsers refuse to expose the camera API
 * (`navigator.mediaDevices.getUserMedia`) on plain http:// origins. Testing the
 * QR scanner from a phone on the local network therefore needs HTTPS.
 *
 * Usage:
 *   npm run cert            # creates certs/key.pem and certs/cert.pem
 *   HTTPS=1 npm run dev     # serves the app over https
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';

const certDir = path.resolve(process.cwd(), process.env.CERT_DIR || 'certs');
const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

function localAddresses() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const item of list || []) {
      if (item.family === 'IPv4' && !item.internal) out.push(item.address);
    }
  }
  return out;
}

if (existsSync(keyPath) && existsSync(certPath)) {
  console.log(`Certificate already exists in ${certDir}`);
} else {
  mkdirSync(certDir, { recursive: true });

  const addresses = localAddresses();
  const san = [
    'DNS:localhost',
    'IP:127.0.0.1',
    ...addresses.map((ip) => `IP:${ip}`)
  ].join(',');

  const args = [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    keyPath,
    '-out',
    certPath,
    '-days',
    '825',
    '-subj',
    '/CN=lk-lottery-local',
    '-addext',
    `subjectAltName=${san}`
  ];

  try {
    execFileSync('openssl', args, { stdio: 'inherit' });
    console.log(`\nCreated:\n  ${keyPath}\n  ${certPath}`);
  } catch (error) {
    console.error('\nCould not create the certificate automatically.');
    console.error('Install OpenSSL, or run this manually inside the project:');
    console.error(
      `  openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/key.pem -out certs/cert.pem -days 825 -subj "/CN=lk-lottery-local" -addext "subjectAltName=${san}"`
    );
    process.exit(1);
  }
}

console.log('\nStart the HTTPS server with:');
console.log('  HTTPS=1 npm run dev');
console.log('\nThen open one of these on your phone (same Wi-Fi):');
for (const ip of localAddresses()) console.log(`  https://${ip}:3000`);
console.log('\nThe browser will warn about the self-signed certificate — accept it once.');
