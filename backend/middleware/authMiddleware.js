const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Users (by first_name, case-insensitive) who can edit/add/delete call reports
const CALL_REPORT_EDITORS = ["malarvannan", "priyanka"];

// Length-safe, content-constant-time comparison. `===` on a secret lets an
// attacker recover it one character at a time from response timing.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so length isn't leaked either.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

const verifyToken = (req, res, next) => {
  // No source-code fallback. It used to be `|| "wa_crm_secret_key_2026"`, so any
  // environment that forgot to set WA_API_KEY accepted a publicly known string
  // as a full admin credential.
  const configuredApiKey = process.env.WA_API_KEY || null;

  // Header only. The query-string forms leaked the key into access logs,
  // browser history and Referer headers.
  const incomingApiKey = req.headers["x-api-key"] || null;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader;

  // 1. Direct API Key check (for external CRM connections)
  if (configuredApiKey && incomingApiKey && safeEqual(incomingApiKey, configuredApiKey)) {
    req.user = {
      id: Number(process.env.WA_API_KEY_USER_ID || 708),
      role: "admin",
      name: "CRM API Connector",
      isApiKey: true,
    };
    return next();
  }

  // 2. Bearer token matching API key directly
  if (configuredApiKey && token && safeEqual(token, configuredApiKey)) {
    req.user = {
      id: Number(process.env.WA_API_KEY_USER_ID || 708),
      role: "admin",
      name: "CRM API Connector",
      isApiKey: true,
    };
    return next();
  }

  if (!token) {
    return res.status(401).json({ message: "No token or API key provided" });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return res.status(503).json({ message: "Authentication is not configured" });

  try {
    const decoded = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
    if (decoded.portal || decoded.role === "client" || [decoded.aud].flat().includes("client-portal")) return res.status(403).json({ message: "Client portal sessions cannot access the staff workspace" });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "subadmin")) {
    return res.status(403).json({ message: "Admin or Sub-Admin only" });
  }
  next();
};

const isEmployee = (req, res, next) => {
  if (!req.user || (req.user.role !== "employee" && req.user.role !== "admin" && req.user.role !== "subadmin")) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

const isReadOnly = (req, res, next) => {
  if (req.user && req.user.role === "employee") {
    return res.status(403).json({ message: "Employees cannot modify data" });
  }
  next();
};

// Strict admin only (not subadmin) — prevents privilege escalation via role-change
const isAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Only admin can perform this action" });
  }
  next();
};

// Call Report specific: admin, subadmin, employee roles OR malarvannan/priyanka by name
const canEditCallReport = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const hasValidRole = ["admin", "subadmin", "employee"].includes(req.user.role);
  const userName = (req.user.name || "").trim().toLowerCase();
  const isAllowedUser = CALL_REPORT_EDITORS.includes(userName);
  if (hasValidRole || isAllowedUser) {
    return next();
  }
  return res.status(403).json({ message: "Access denied" });
};

module.exports = {
  verifyToken,
  isAdmin,
  isAdminOnly,
  isEmployee,
  isReadOnly,
  canEditCallReport,
};
