import { execFileSync } from "node:child_process";
import { createWriteStream, mkdirSync, statSync } from "node:fs";
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

// 只发布 Git 已跟踪文件：自动遵守 .gitignore，避免把 .git、内部研发文档、
// 本地环境文件或构建产物混入公开发布包。
const files = listTrackedFiles(projectRoot);

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

function listTrackedFiles(dir) {
  const output = execFileSync("git", ["-C", dir, "ls-files", "-z"], { encoding: "utf8" });
  return output
    .split("\0")
    .filter(Boolean)
    .map((name) => join(dir, ...name.split("/")));
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
