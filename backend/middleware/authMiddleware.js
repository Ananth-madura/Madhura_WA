const jwt = require("jsonwebtoken");

// Users (by first_name, case-insensitive) who can edit/add/delete call reports
const CALL_REPORT_EDITORS = ["malarvannan", "priyanka"];

const verifyToken = (req, res, next) => {
  const configuredApiKey = process.env.WA_API_KEY || "wa_crm_secret_key_2026";
  const incomingApiKey = req.headers["x-api-key"] || req.query?.apiKey || req.query?.api_key;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader;

  // 1. Direct API Key check (for external CRM connections)
  if (incomingApiKey && (incomingApiKey === configuredApiKey || incomingApiKey === process.env.WA_API_KEY)) {
    req.user = { id: 708, role: "admin", name: "CRM API Connector", isApiKey: true };
    return next();
  }

  // 2. Bearer token matching API key directly
  if (token && (token === configuredApiKey || token === process.env.WA_API_KEY)) {
    req.user = { id: 708, role: "admin", name: "CRM API Connector", isApiKey: true };
    return next();
  }

  if (!token) {
    return res.status(401).json({ message: "No token or API key provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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