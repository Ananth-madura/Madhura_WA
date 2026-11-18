"use strict";

/**
 * whatsappFlowCryptoService.js
 *
 * Official Meta WhatsApp Flows Data-Exchange Encryption Protocol:
 * - Generates RSA-2048 key pairs per tenant/WABA and encrypts private keys at rest
 * - Decrypts incoming Flow requests:
 *     1. Decrypt encrypted_aes_key with RSA-OAEP (SHA-256) using private key
 *     2. Decrypt encrypted_flow_data with AES-128-GCM using initial_vector
 *        (last 16 bytes of decoded buffer are the GCM auth tag)
 * - Encrypts outgoing Flow responses:
 *     1. Flip every bit of initial_vector (~iv[i] & 0xff)
 *     2. Encrypt JSON response with AES-128-GCM using flipped IV
 *     3. Append 16-byte GCM auth tag and return base64 string
 * - Handles Meta 'ping' health checks and dynamic screen actions with flow_token correlation.
 */

const crypto = require("crypto");
const cryptoHelper = require("../../backendutil/cryptoHelper");
const { createDbHelper, assertTenantId, safeJsonParse, httpError } = require("./dbHelper");

const TAG_LENGTH = 16;

function generateRsaKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const fingerprint = crypto.createHash("sha256").update(publicKey).digest("hex").slice(0, 32);
  return { publicKey, privateKey, fingerprint };
}

function decryptFlowRequest({ encrypted_flow_data, encrypted_aes_key, initial_vector }, privateKeyPem) {
  if (!encrypted_flow_data || !encrypted_aes_key || !initial_vector) {
    throw httpError("Missing encrypted Flow payload fields", 400, "FLOW_PAYLOAD_INCOMPLETE");
  }
  if (!privateKeyPem) {
    throw httpError("Flow endpoint private key is not configured", 500, "FLOW_PRIVATE_KEY_MISSING");
  }

  let decryptedAesKey;
  try {
    decryptedAesKey = crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );
  } catch (err) {
    const e = httpError("Failed to decrypt Flow AES key", 421, "FLOW_DECRYPT_KEY_FAILED");
    e.cause = err;
    throw e;
  }

  const flowDataBuf = Buffer.from(encrypted_flow_data, "base64");
  const ivBuf = Buffer.from(initial_vector, "base64");
  if (flowDataBuf.length <= TAG_LENGTH) {
    throw httpError("Invalid encrypted flow data buffer", 400, "FLOW_DATA_MALFORMED");
  }

  const ciphertext = flowDataBuf.subarray(0, flowDataBuf.length - TAG_LENGTH);
  const authTag = flowDataBuf.subarray(flowDataBuf.length - TAG_LENGTH);

  try {
    const alg = decryptedAesKey.length === 32 ? "aes-256-gcm" : "aes-128-gcm";
    const decipher = crypto.createDecipheriv(alg, decryptedAesKey, ivBuf);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return {
      decryptedBody: JSON.parse(decrypted),
      aesKeyBuffer: decryptedAesKey,
      initialVectorBuffer: ivBuf,
    };
  } catch (err) {
    const e = httpError("Failed to decrypt Flow data payload", 421, "FLOW_DECRYPT_DATA_FAILED");
    e.cause = err;
    throw e;
  }
}

function encryptFlowResponse(responseObj, aesKeyBuffer, initialVectorBuffer) {
  const flippedIv = Buffer.alloc(initialVectorBuffer.length);
  for (let i = 0; i < initialVectorBuffer.length; i++) {
    flippedIv[i] = ~initialVectorBuffer[i] & 0xff;
  }
  const alg = aesKeyBuffer.length === 32 ? "aes-256-gcm" : "aes-128-gcm";
  const cipher = crypto.createCipheriv(alg, aesKeyBuffer, flippedIv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(responseObj), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return encrypted.toString("base64");
}

/**
 * Helper used in tests and secure client simulations to build a Meta-encrypted request.
 */
function encryptFlowRequestForTest(payloadObj, publicKeyPem) {
  const aesKey = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, iv);
  const encryptedData = Buffer.concat([
    cipher.update(JSON.stringify(payloadObj), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const encryptedKey = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    aesKey
  );
  return {
    encrypted_flow_data: encryptedData.toString("base64"),
    encrypted_aes_key: encryptedKey.toString("base64"),
    initial_vector: iv.toString("base64"),
    aesKey,
    iv,
  };
}

function decryptFlowResponseForTest(base64Response, aesKeyBuffer, initialVectorBuffer) {
  const flippedIv = Buffer.alloc(initialVectorBuffer.length);
  for (let i = 0; i < initialVectorBuffer.length; i++) {
    flippedIv[i] = ~initialVectorBuffer[i] & 0xff;
  }
  const buf = Buffer.from(base64Response, "base64");
  const ciphertext = buf.subarray(0, buf.length - TAG_LENGTH);
  const authTag = buf.subarray(buf.length - TAG_LENGTH);
  const decipher = crypto.createDecipheriv("aes-128-gcm", aesKeyBuffer, flippedIv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  return JSON.parse(plain);
}

function createWhatsAppFlowCryptoService(options = {}) {
  const db = createDbHelper(options.db);

  async function provisionEndpointKeys(tenantId, { wabaId = null, phoneNumberId = null, endpointUri }, actorId = null) {
    const tid = assertTenantId(tenantId);
    if (!endpointUri) throw httpError("endpointUri is required", 400, "ENDPOINT_URI_REQUIRED");

    const { publicKey, privateKey, fingerprint } = generateRsaKeyPair();
    const encryptedPrivate = cryptoHelper.encrypt(privateKey);

    const res = await db.query(
      `INSERT INTO whatsapp_flow_endpoints (
        tenant_id, waba_id, phone_number_id, endpoint_uri,
        public_key_pem, encrypted_private_key_pem, key_fingerprint,
        meta_uploaded, health_status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'configured', ?)`,
      [tid, wabaId, phoneNumberId, endpointUri, publicKey, encryptedPrivate, fingerprint, actorId]
    );

    return {
      id: res.insertId,
      tenant_id: tid,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      endpoint_uri: endpointUri,
      public_key_pem: publicKey,
      key_fingerprint: fingerprint,
      health_status: "configured",
    };
  }

  async function getEndpointPrivateKey(endpointId, tenantId = null) {
    const sql = tenantId
      ? `SELECT * FROM whatsapp_flow_endpoints WHERE id = ? AND tenant_id = ? LIMIT 1`
      : `SELECT * FROM whatsapp_flow_endpoints WHERE id = ? LIMIT 1`;
    const row = await db.queryOne(sql, tenantId ? [Number(endpointId), assertTenantId(tenantId)] : [Number(endpointId)]);
    if (!row) throw httpError("Flow endpoint configuration not found", 404, "FLOW_ENDPOINT_NOT_FOUND");
    return {
      endpoint: row,
      privateKeyPem: cryptoHelper.decrypt(row.encrypted_private_key_pem),
    };
  }

  async function handleEncryptedDataExchange(endpointId, encryptedBody, customHandler = null) {
    const { endpoint, privateKeyPem } = await getEndpointPrivateKey(endpointId);
    const { decryptedBody, aesKeyBuffer, initialVectorBuffer } = decryptFlowRequest(encryptedBody, privateKeyPem);
    const { version = "3.0", action, screen, data, flow_token } = decryptedBody;

    let responsePayload;

    if (action === "ping") {
      await db.query(
        `UPDATE whatsapp_flow_endpoints SET health_status = 'healthy', last_health_check_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [endpoint.id]
      );
      responsePayload = { version, data: { status: "active" } };
    } else {
      // Correlate flow_token to persisted execution context
      let execution = null;
      if (flow_token) {
        execution = await db.queryOne(
          `SELECT * FROM whatsapp_flow_executions WHERE tenant_id = ? AND flow_token = ? LIMIT 1`,
          [endpoint.tenant_id, String(flow_token)]
        );
        if (execution) {
          const visited = safeJsonParse(execution.screens_visited_json, []);
          if (screen && !visited.includes(screen)) visited.push(screen);
          await db.query(
            `UPDATE whatsapp_flow_executions
             SET current_screen = ?, screens_visited_json = ?, status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [screen || execution.current_screen, JSON.stringify(visited), execution.id]
          );
        }
      }

      if (typeof customHandler === "function") {
        responsePayload = await customHandler({
          tenantId: endpoint.tenant_id,
          endpoint,
          execution,
          decryptedBody,
        });
      } else if (action === "INIT") {
        responsePayload = {
          version,
          screen: screen || "WELCOME",
          data: {
            flow_token: flow_token || null,
            correlated: Boolean(execution),
          },
        };
      } else if (action === "data_exchange") {
        responsePayload = {
          version,
          screen: data?.next_screen || "SUCCESS",
          data: {
            acknowledged: true,
            received_keys: Object.keys(data || {}),
          },
        };
      } else {
        responsePayload = {
          version,
          screen: screen || "SUCCESS",
          data: { status: "ok" },
        };
      }
    }

    const encryptedResponse = encryptFlowResponse(responsePayload, aesKeyBuffer, initialVectorBuffer);
    return {
      encryptedResponse,
      action,
      flow_token: flow_token || null,
      responsePayload,
    };
  }

  return {
    provisionEndpointKeys,
    getEndpointPrivateKey,
    handleEncryptedDataExchange,
    generateRsaKeyPair,
    decryptFlowRequest,
    encryptFlowResponse,
    encryptFlowRequestForTest,
    decryptFlowResponseForTest,
  };
}

module.exports = {
  createWhatsAppFlowCryptoService,
  generateRsaKeyPair,
  decryptFlowRequest,
  encryptFlowResponse,
  encryptFlowRequestForTest,
  decryptFlowResponseForTest,
};
