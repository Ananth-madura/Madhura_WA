"use strict";
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
module.exports = () => {
  process.env.WA_SKIP_DOTENV = "1";
  process.env.NODE_ENV = "test";
  process.env.DISABLE_R2 = "1";
  process.env.WA_ENABLE_WEB_ENGINE = "0";
  process.env.WA_DISABLE_OUTBOUND = "1";
  process.env.WA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "wa-sqlite-test-"));
};
