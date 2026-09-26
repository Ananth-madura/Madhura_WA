const dns = require("dns").promises;
const urlParser = require("url");

/**
 * SSRF Protection Validator for Outbound Webhooks
 * Blocks private IP subnets, loopbacks, and cloud provider metadata IPs.
 */

const BLOCKED_HOSTNAMES = [
  "localhost",
  "metadata.google.internal",
  "169.254.169.254", // AWS/GCP/Azure link-local metadata
  "0.0.0.0",
];

function isPrivateIp(ip) {
  if (!ip) return true;
  
  // IPv6 loopback / local
  if (ip === "::1" || ip === "::" || ip.startsWith("fe80:") || ip.startsWith("fc00:")) {
    return true;
  }

  // IPv4 checks
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;
  // 10.0.0.0/8 (Private A)
  if (parts[0] === 10) return true;
  // 172.16.0.0/12 (Private B)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16 (Private C)
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 169.254.0.0/16 (Link-local / AWS metadata)
  if (parts[0] === 169 && parts[1] === 254) return true;
  // 0.0.0.0/8
  if (parts[0] === 0) return true;

  return false;
}

/**
 * Validates whether a target URL is safe to deliver outbound webhooks to.
 * Must be HTTPS (or HTTP in local development) and resolve to public IPs only.
 */
async function isDeliverableUrl(targetUrl) {
  if (!targetUrl || typeof targetUrl !== "string") return false;

  try {
    const parsed = new URL(targetUrl);
    const protocol = parsed.protocol.toLowerCase();

    // In production, force HTTPS. Allow HTTP only if explicitly set in dev
    if (protocol !== "https:" && (process.env.NODE_ENV === "production" || protocol !== "http:")) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    if (BLOCKED_HOSTNAMES.includes(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      return false;
    }

    // Resolve DNS and verify all returned addresses
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) return false;

    for (const record of addresses) {
      if (isPrivateIp(record.address)) {
        return false;
      }
    }

    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  isDeliverableUrl,
  isPrivateIp,
};
