// Bundle the reviewed public catalog + run payloads as static, gzip-compressed
// files for the anonymous GitHub Pages build. Strips every external storage
// identifier so the published site references no third-party data store.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const [,, sourceDir, outDir] = process.argv;
if (!sourceDir || !outDir) {
  console.error("usage: node scripts/bundle_anonymous_public_data.mjs <sourceDir> <outDir>");
  process.exit(1);
}
const ID_FIELDS = ["run_json_file_id", "raw_csv_file_id", "metadata_json_file_id", "request_timeline_file_id"];
const scrub = (run, key) => {
  const out = { ...run };
  for (const f of ID_FIELDS) out[f] = null;
  out.run_json_file_id = key;
  for (const f of ["trace_path", "meta_path"]) if (typeof out[f] === "string") out[f] = out[f].replace(/^Google Drive \/ /, "");
  if (out.storage && typeof out.storage === "object") out.storage = { ...out.storage, provider: "static-bundle" };
  if (typeof out.source_directory === "string") out.source_directory = out.source_directory.replace(/Google Drive public data store( \/ )?/, "Public data store$1").replace(/\s*\/\s*$/, "");
  return out;
};
const catalog = JSON.parse(fs.readFileSync(path.join(sourceDir, "catalog.json"), "utf8"));
fs.mkdirSync(path.join(outDir, "runs"), { recursive: true });
const keys = new Set();
const scrubbedCatalog = catalog.map((run) => {
  const key = run.run_id.replace(/[^A-Za-z0-9._-]/g, "_");
  if (keys.has(key)) throw new Error(`duplicate run key ${key}`);
  keys.add(key);
  const src = path.join(sourceDir, "runs", `${run.run_json_file_id}.json`);
  const detail = JSON.parse(fs.readFileSync(src, "utf8"));
  detail.run = scrub(detail.run ?? run, key);
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(detail)), { level: 9 });
  fs.writeFileSync(path.join(outDir, "runs", `${key}.json.gz`), gz);
  return scrub(run, key);
});
fs.writeFileSync(path.join(outDir, "catalog.json"), JSON.stringify(scrubbedCatalog));
const text = fs.readFileSync(path.join(outDir, "catalog.json"), "utf8");
const leak = /google|drive|\b1(?=[A-Za-z0-9_-]{32}\b)(?=[A-Za-z0-9_-]*[A-Z_-])[A-Za-z0-9_-]{32}\b/i;
if (leak.test(text)) console.warn("WARNING: catalog still references external storage");
console.log(`bundled ${scrubbedCatalog.length} runs -> ${outDir}`);
