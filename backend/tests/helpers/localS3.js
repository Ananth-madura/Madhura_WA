"use strict";
const http = require("node:http");
const { S3Client } = require("@aws-sdk/client-s3");

async function start() {
  const objects = new Map(), requests = [];
  const fixture = { denied: false };
  const server = http.createServer(async (req, res) => {
    const key = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    requests.push({ method: req.method, key, signed: String(req.headers.authorization).startsWith("AWS4-HMAC-SHA256 ") });
    if (fixture.denied) return res.writeHead(403, { "Content-Type": "application/xml" }).end("<Error><Code>AccessDenied</Code></Error>");
    if (req.method === "HEAD") return res.writeHead(200).end();
    if (req.method === "PUT") {
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      objects.set(key, { body: Buffer.concat(chunks), type: req.headers["content-type"], cache: req.headers["cache-control"] });
      return res.writeHead(200, { ETag: '"fixture"' }).end();
    }
    if (req.method === "DELETE") { objects.delete(key); return res.writeHead(204).end(); }
    const object = objects.get(key);
    if (!object) return res.writeHead(404, { "Content-Type": "application/xml" }).end("<Error><Code>NoSuchKey</Code></Error>");
    res.writeHead(200, { "Content-Type": object.type, "Content-Length": object.body.length });res.end(object.body);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const client = new S3Client({ region: "auto", endpoint: `http://127.0.0.1:${server.address().port}`, forcePathStyle: true, maxAttempts: 1, credentials: { accessKeyId: "fixture-access", secretAccessKey: "fixture-secret" } });
  return Object.assign(fixture, { client, objects, requests, close: async () => { client.destroy();await new Promise(resolve => server.close(resolve)); } });
}
module.exports = { start };
