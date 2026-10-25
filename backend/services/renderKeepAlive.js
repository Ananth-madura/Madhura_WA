/**
 * renderKeepAlive.js — Anti-sleep keep-alive loop for Render free-tier hosting.
 *
 * Render free instances spin down after 15 minutes of inactivity.
 * This service issues an outbound HTTP request every 7 minutes to the public /health
 * endpoint, resetting Render's inactivity timer and keeping the container awake 24/7.
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

let timer = null;
let initialTimer = null;

function pingServer(url) {
  try {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const start = Date.now();

    const req = client.request(
      parsed,
      {
        method: "GET",
        headers: {
          "User-Agent": "MadhuraCRM-RenderKeepAlive/1.0",
          "Accept": "*/*",
        },
        timeout: 15000,
      },
      (res) => {
        res.resume();
        const elapsed = Date.now() - start;
        if (res.statusCode >= 200 && res.statusCode < 400) {
          console.log(`[KeepAlive] ⚡ Heartbeat ping OK: ${url} (status: ${res.statusCode}, latency: ${elapsed}ms)`);
        } else {
          console.warn(`[KeepAlive] ⚠️ Heartbeat ping answered with status ${res.statusCode} (${elapsed}ms)`);
        }
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("Request timed out (15s)"));
    });

    req.on("error", (err) => {
      console.warn(`[KeepAlive] ⚠️ Heartbeat ping: ${err.message}`);
    });

    req.end();
  } catch (err) {
    console.warn(`[KeepAlive] ⚠️ Invalid keep-alive URL: ${err.message}`);
  }
}

/**
 * Start the keep-alive loop.
 * Runs every `intervalMinutes` (defaults to 7 minutes).
 */
function startKeepAlive(options = {}) {
  if (timer) return;
  if (process.env.ENABLE_RENDER_KEEP_ALIVE !== "1" || process.env.DISABLE_RENDER_KEEP_ALIVE === "1" || process.env.NODE_ENV === "test") {
    return;
  }

  const rawBase =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.PUBLIC_BASE_URL ||
    "https://madhura-wa-backend.onrender.com";

  const targetUrl = `${rawBase.trim().replace(/\/+$/, "")}/health`;
  const configuredMinutes=Number(process.env.RENDER_KEEP_ALIVE_MINUTES || options.intervalMinutes || 7);
  const intervalMinutes = Number.isFinite(configuredMinutes)?Math.max(1,configuredMinutes):7;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[KeepAlive] 🔄 Anti-sleep keep-alive loop active: pinging ${targetUrl} every ${intervalMinutes} min`);

  // Initial ping after 45 seconds to let server finish boot
  const initialDelay = options.initialDelayMs ?? 45000;
  initialTimer = setTimeout(() => {
    initialTimer=null;
    pingServer(targetUrl);
  }, initialDelay);
  if (initialTimer && initialTimer.unref) initialTimer.unref();

  // Recurring 7-minute interval
  timer = setInterval(() => {
    pingServer(targetUrl);
  }, intervalMs);

  if (timer && timer.unref) {
    timer.unref();
  }
}

function stopKeepAlive() {
  if(initialTimer){clearTimeout(initialTimer);initialTimer=null;}
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { startKeepAlive, stopKeepAlive, pingServer };
