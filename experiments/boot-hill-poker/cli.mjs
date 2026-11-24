#!/usr/bin/env node
// Boot Hill Poker in the terminal. Same engine, controls and screen as the HTML page.
// Interactive in a TTY (single keypresses); piped input is read line by line,
// with each line's characters pressed in order followed by ENTER.

import readline from 'node:readline';
import { parseArgs } from 'node:util';
import { applyKey, startSession } from './controls.js';
import { viewState } from './engine.js';
import { renderScreen, toAnsi } from './render.js';

const USAGE = `Boot Hill Poker: five-card draw on a haunted Western BBS

Usage: node experiments/boot-hill-poker/cli.mjs [--seed N] [--first cowboy|wizard]
       [--strategy standard|pat] [--no-color]

You are the Cowboy; the Wizard is a deterministic local bot.
Keys: 1-5 mark or unmark a card to toss, ENTER (or D) draws,
      R replays the same deal, N deals a new hand, Q hangs up.`;

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      seed: { type: 'string', default: '17' },
      first: { type: 'string', default: 'cowboy' },
      strategy: { type: 'string', default: 'standard' },
      'no-color': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  }));
} catch (error) {
  console.error(`boot-hill-poker: ${error.message}\n\n${USAGE}`);
  process.exit(2);
}
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}

let session;
try {
  session = startSession({ seed: args.seed, first: args.first, strategy: args.strategy });
} catch (error) {
  console.error(`boot-hill-poker: ${error.message}`);
  process.exit(2);
}

const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const color = !args['no-color'] && !process.env.NO_COLOR && Boolean(process.stdout.isTTY);
let rl = null;
let done = false;

function paint() {
  const screen = toAnsi(renderScreen(viewState(session.state), session), { color });
  process.stdout.write(`${interactive ? '\x1b[2J\x1b[H' : '\n'}${screen}\n`);
}

function hangUp() {
  done = true;
  process.stdout.write(`${toAnsi([[['dim', '+++ATH0']], [['alert', 'NO CARRIER']]], { color })}\n`);
  if (interactive) {
    process.stdin.setRawMode(false);
    process.stdin.pause();
  } else {
    rl.close();
  }
}

function press(keys) {
  if (done) return;
  for (const key of keys) {
    session = applyKey(session, key);
    if (session.hungUp) return hangUp();
  }
  paint();
}

paint();
if (interactive) {
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    if (chunk.startsWith('\x1b')) return; // arrow keys and other escape sequences
    press([...chunk]);
  });
  process.stdin.resume();
} else {
  rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on('line', (text) => press([...text, '\n']));
}
