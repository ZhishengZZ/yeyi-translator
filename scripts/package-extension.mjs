import { createWriteStream, mkdirSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(root);
const outputDir = join(projectRoot, "dist");
const outputFile = join(outputDir, "yeyi-translator-source.tar.gz");

mkdirSync(outputDir, { recursive: true });
await validateManifest();

const files = listFiles(projectRoot).filter((file) => {
  const rel = relative(projectRoot, file).replace(/\\/g, "/");
  return !rel.startsWith("dist/") && !rel.startsWith("node_modules/");
});

await writeTarGz(files, outputFile);
console.log(`Packaged ${files.length} files -> ${outputFile}`);

async function validateManifest() {
  const manifest = JSON.parse(await readFile(join(projectRoot, "manifest.json"), "utf8"));
  const required = ["manifest_version", "name", "version", "background", "action"];
  for (const key of required) {
    if (!manifest[key]) throw new Error(`manifest.json missing ${key}`);
  }
  if (manifest.manifest_version !== 3) {
    throw new Error("manifest.json must use manifest_version 3");
  }
}

function listFiles(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      result.push(...listFiles(full));
    } else {
      result.push(full);
    }
  }
  return result;
}

async function writeTarGz(files, output) {
  const gzip = createGzip();
  const stream = createWriteStream(output);
  gzip.pipe(stream);

  for (const file of files) {
    const rel = relative(projectRoot, file).replace(/\\/g, "/");
    const stat = statSync(file);
    const content = await readFile(file);
    const header = createTarHeader(rel, stat.size, Math.floor(stat.mtimeMs / 1000));
    gzip.write(header);
    gzip.write(content);
    gzip.write(Buffer.alloc((512 - (stat.size % 512)) % 512));
  }

  gzip.end(Buffer.alloc(1024));
  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

function createTarHeader(name, size, mtime) {
  const buffer = Buffer.alloc(512);
  writeString(buffer, 0, 100, name);
  writeOctal(buffer, 100, 8, 0o644);
  writeOctal(buffer, 108, 8, 0);
  writeOctal(buffer, 116, 8, 0);
  writeOctal(buffer, 124, 12, size);
  writeOctal(buffer, 136, 12, mtime);
  buffer.fill(" ", 148, 156);
  buffer[156] = "0".charCodeAt(0);
  writeString(buffer, 257, 6, "ustar");
  writeString(buffer, 263, 2, "00");

  let checksum = 0;
  for (const byte of buffer) checksum += byte;
  writeOctal(buffer, 148, 8, checksum);
  return buffer;
}

function writeString(buffer, offset, length, value) {
  buffer.write(String(value).slice(0, length), offset, length, "utf8");
}

function writeOctal(buffer, offset, length, value) {
  const text = value.toString(8).padStart(length - 1, "0").slice(0, length - 1);
  buffer.write(text, offset, length - 1, "ascii");
  buffer[offset + length - 1] = 0;
}

