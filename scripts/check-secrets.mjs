#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DETECTORS = [
  {
    name: 'GitHub personal access token',
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g,
  },
  {
    name: 'GitHub fine-grained personal access token',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g,
  },
  {
    name: 'OpenAI-style secret key',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: 'AWS access key ID',
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    name: 'Private key block',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    name: 'Azure Storage account key',
    pattern: /\bAccountKey=[A-Za-z0-9+/]{40,}={0,2}\b/g,
  },
];

function lineNumberAt(text, index) {
  let line = 1;
  for (let position = 0; position < index; position++) {
    if (text.charCodeAt(position) === 10) line++;
  }
  return line;
}

export function scanText(text) {
  const findings = [];
  for (const detector of DETECTORS) {
    detector.pattern.lastIndex = 0;
    for (const match of text.matchAll(detector.pattern)) {
      findings.push({
        detector: detector.name,
        line: lineNumberAt(text, match.index),
      });
    }
  }
  return findings;
}

function isBinary(buffer) {
  const sampleLength = Math.min(buffer.length, 8_192);
  for (let index = 0; index < sampleLength; index++) {
    if (buffer[index] === 0) return true;
  }
  return false;
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);
}

function main() {
  const findings = [];
  let scannedFiles = 0;

  for (const file of trackedFiles()) {
    const contents = readFileSync(file);
    if (isBinary(contents)) continue;
    scannedFiles++;

    const text = contents.toString('utf8');
    for (const finding of scanText(text)) {
      findings.push({ file, ...finding });
    }
  }

  if (findings.length > 0) {
    console.error(`Secret pattern check failed with ${findings.length} finding(s).`);
    for (const finding of findings) {
      console.error(`- ${finding.file}:${finding.line}: ${finding.detector}`);
    }
    console.error('Matched values are intentionally not printed.');
    process.exitCode = 1;
    return;
  }

  console.log(`Secret pattern check passed (${scannedFiles} tracked text files).`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
