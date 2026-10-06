#!/usr/bin/env node
/**
 * Guard against silently-dropped Tailwind opacity modifiers.
 *
 * Tailwind emits *nothing* for an opacity modifier outside its scale. That is
 * how `bg-void-900/96` ended up producing no background at all, and a
 * full-screen overlay rendered completely transparent over the live UI — a bug
 * that is invisible in code review and obvious only on screen.
 *
 * Run with: node scripts/check-opacity.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED = new Set([
  0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,
  100,
]);

const PREFIXES =
  'bg|text|border|ring|fill|stroke|divide|from|via|to|shadow|outline|accent|caret|decoration|placeholder';
const PATTERN = new RegExp(`\\b(?:${PREFIXES})-[A-Za-z0-9[\\]()#_.,%-]*?/(\\d{1,3})\\b`, 'g');

const ROOTS = ['app', 'components', 'lib'];
const problems = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(tsx?|css)$/.test(entry)) check(path);
  }
}

function check(file) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(PATTERN)) {
      // Arbitrary values in square brackets accept any precision.
      if (match[0].includes('[')) continue;
      const value = Number(match[1]);
      if (!ALLOWED.has(value)) {
        problems.push(
          `${file}:${index + 1}  ${match[0]}  — /${value} is not in Tailwind's opacity scale`,
        );
      }
    }
  });
}

for (const root of ROOTS) walk(root);

if (problems.length > 0) {
  console.error('\nInvalid Tailwind opacity modifiers. These emit NO css:\n');
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    '\nUse a value from the scale, or an arbitrary value such as bg-[rgb(4_5_7/0.96)].\n',
  );
  process.exit(1);
}

console.log('opacity modifiers ok');
