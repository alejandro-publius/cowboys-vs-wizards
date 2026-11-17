#!/usr/bin/env node
// Issue #124: compare one T1 and one BASE trap lab report on this machine.
//   node experiments/trap-playtest-compare/run.mjs <T1.json> <BASE.json> [--notes]
// Either file order works. Reads only the two named local files, prints
// Markdown to stdout and writes nothing. No network, telemetry or storage.
// File names and paths never appear in the output or in error messages.
// --notes adds the reports' humanNotes, Markdown-escaped; without it no note
// text is read into the comparison.
import { readFile, stat } from "node:fs/promises";
import { CompareError, compareReports, formatMarkdown } from "./compare.js";

const USAGE = "usage: node experiments/trap-playtest-compare/run.mjs <T1.json> <BASE.json> [--notes]";
const MAX_BYTES = 1024 * 1024; // a full exported report is well under 100 KB

async function load(file, label) {
  let info;
  try {
    info = await stat(file);
  } catch {
    throw new CompareError(`${label}: cannot be read`);
  }
  if (!info.isFile()) throw new CompareError(`${label}: is not a regular file`);
  if (info.size > MAX_BYTES) throw new CompareError(`${label}: larger than ${MAX_BYTES} bytes; not a lab report`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new CompareError(`${label}: is not valid JSON`);
  }
}

async function main(argv) {
  const notes = argv.filter((a) => a === "--notes").length;
  const files = argv.filter((a) => a !== "--notes");
  if (notes > 1 || files.length !== 2 || files.some((f) => f.startsWith("-"))) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  try {
    const [first, second] = [await load(files[0], "first file"), await load(files[1], "second file")];
    process.stdout.write(formatMarkdown(compareReports(first, second, { includeNotes: notes === 1 })));
    return 0;
  } catch (error) {
    if (!(error instanceof CompareError)) throw error;
    process.stderr.write(`Cannot compare: ${error.message}\n`);
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
