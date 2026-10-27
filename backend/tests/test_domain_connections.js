const assert = require("node:assert/strict");
const { applyDefaults } = require("../config/runtimeDefaults");
const { createCorsOrigin } = require("../config/corsPolicy");

const env = { NODE_ENV: "production" };
applyDefaults(env);
assert.equal(env.PUBLIC_BASE_URL, "https://api.madhuratech.in");
const policy = createCorsOrigin(env);
for (const origin of ["https://wa.madhuratech.in", "https://live.wa.madhuratech.in", "https://live.madhuratech.in"]) {
  policy(origin, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, true); });
}
policy("https://live.wa.madhuratech.in.attacker.test", (error, allowed) => assert.equal(allowed, false));
const custom = { NODE_ENV: "production", PUBLIC_BASE_URL: "https://api.fixture.test", ALLOWED_ORIGINS: "https://app.fixture.test" };
applyDefaults(custom);
assert.equal(custom.PUBLIC_BASE_URL, "https://api.fixture.test");
assert.equal(custom.ALLOWED_ORIGINS, "https://app.fixture.test");
const strict = { NODE_ENV: "production", REQUIRE_HARD_CONFIG: "1" };
applyDefaults(strict);
assert.equal(strict.ALLOWED_ORIGINS, undefined);
console.log("PASS: both application domains, marketing origin, exact origin rejection and environment overrides");
