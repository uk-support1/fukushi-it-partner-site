"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");

function isPublicFile(file) {
  if (file.split("/").some(part => part === "..")) return false;
  return /^[^/]+\.html$/i.test(file) ||
    /^(assets|blog|course|subsidy-support)\//.test(file) ||
    ["CNAME", ".nojekyll", "favicon.ico", "robots.txt", "sitemap.xml", "site.webmanifest", "data/blog-index.json", "data/course-index.json"].includes(file);
}

function prepare(destination) {
  const out = path.resolve(destination);
  if (out === ROOT || ROOT.startsWith(out + path.sep) || out.startsWith(ROOT + path.sep)) {
    throw new Error("Use a new output directory outside the repository");
  }
  if (fs.existsSync(out)) throw new Error("Output directory already exists; refusing to overwrite");
  // Generated files are committed by the workflow before this step. Untracked files are never published.
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean).filter(isPublicFile);
  for (const file of files) {
    const from = path.join(ROOT, file);
    let cursor = ROOT;
    for (const segment of file.split("/")) {
      cursor = path.join(cursor, segment);
      if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error("Symlinks cannot be deployed: " + file);
    }
    if (!fs.statSync(from).isFile()) throw new Error("Not a public file: " + file);
  }
  for (const file of files) {
    const target = path.join(out, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), target);
  }
  console.log("Prepared " + files.length + " public files");
  return files;
}
if (require.main === module) {
  if (!process.argv[2]) throw new Error("Pass a fresh output directory");
  prepare(process.argv[2]);
}
module.exports = { isPublicFile, prepare };
