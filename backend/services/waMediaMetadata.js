"use strict";
const fs = require("fs");
const path = require("path");
const TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", txt: "text/plain", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", zip: "application/zip" };
function mimeFromFilename(filename) { return TYPES[path.extname(filename || "").slice(1).toLowerCase()] || "application/octet-stream"; }
function cachedMedia(cacheDir, id, urlPrefix) {
  try {
    const filename = fs.readdirSync(cacheDir).find((file) => file.startsWith(`${id}.`) && !file.endsWith(".metadata.json"));
    if (!filename) return null;
    let metadata = {};
    try { metadata = JSON.parse(fs.readFileSync(path.join(cacheDir, `${filename}.metadata.json`), "utf8")); } catch (_) {}
    return { url: `${urlPrefix}/${encodeURIComponent(filename)}`, filename: metadata.filename || filename, mimetype: metadata.mimetype || mimeFromFilename(filename) };
  } catch (_) { return null; }
}
function saveMediaMetadata(filePath, metadata) { fs.writeFileSync(`${filePath}.metadata.json`, JSON.stringify(metadata)); }
module.exports = { cachedMedia, saveMediaMetadata, mimeFromFilename };
