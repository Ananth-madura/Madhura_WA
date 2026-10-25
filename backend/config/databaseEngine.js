"use strict";

function usesSqlite(env = process.env) {
  const engine = String(env.DB_ENGINE || "").trim().toLowerCase();
  if (engine === "mysql") return false;
  return ["sqlite", "r2"].includes(engine) ||
    ["1", "true", "sqlite", "r2"].includes(String(env.USE_SQLITE || "").toLowerCase());
}

module.exports = { usesSqlite };
