const db = require("../config/database");
let redisAvailable = false;
let messageQueue = null;
let redisConnection = null;

try {
  const IORedis = require("ioredis");
  const { Queue } = require("bullmq");
  const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
  redisConnection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: () => null, // don't loop-retry a Redis that isn't there — fail once, fall back to in-memory
    lazyConnect: true,
  });

  // Queue/Worker don't expose the connection they were given as a public
  // property, so anything reading `messageQueue.connection` back out gets
  // undefined — that used to make the Worker below silently open its OWN
  // default (127.0.0.1:6379, infinite-retry) client instead of reusing this
  // one, which is what was spamming ECONNREFUSED forever. Keep our own
  // reference and pass that same instance everywhere instead.
  let loggedDown = false;
  redisConnection.on("error", () => {
    redisAvailable = false;
    if (!loggedDown) {
      loggedDown = true;
      console.log("Redis not reachable — WhatsApp campaign queue falling back to in-memory (synchronous) sending");
    }
  });

  messageQueue = new Queue("whatsapp-messages", { connection: redisConnection });
  // BullMQ's Queue re-emits the underlying connection's errors as its own
  // "error" event — EventEmitter throws an event with no listener when that
  // event is specifically "error", which is the unlabeled AggregateError/
  // "Connection is closed" dump seen at boot. Already logged once above via
  // redisConnection's own handler, so just absorb the re-emit here.
  messageQueue.on("error", () => {});
  redisAvailable = true;
} catch (e) {
  redisAvailable = false;
}

const inMemoryQueue = [];

async function startWorker() {
  if (!redisAvailable) {
    console.log("Redis not available — using in-memory queue (messages process synchronously)");
    return;
  }
  try {
    const { Worker: BWorker } = require("bullmq");
    const worker = new BWorker(
      "whatsapp-messages",
      async (job) => {
        const { campaignId, contactId, phone, message, templateName, templateComponents } = job.data;
        await processSingleMessage(campaignId, contactId, phone, message, templateName, templateComponents);
      },
      { connection: redisConnection, concurrency: 5, limiter: { max: 10, duration: 1000 } }
    );
    worker.on("error", () => {}); // connection loss already logged/handled via redisConnection's own "error" handler
    console.log("BullMQ worker started");
  } catch (e) {
    console.log("BullMQ worker failed to start:", e.message);
  }
}

async function processSingleMessage(campaignId, contactId, phone, message, templateName, templateComponents, sessionKey = 1, poolId = null, routingStrategy = "round_robin", tenantId = 1) {
  const waLoadBalancer = require("./waLoadBalancer");
  try {
    let result;
    if (templateName) {
      result = await waLoadBalancer.sendTemplateMessage(phone, templateName, "en", templateComponents || [], sessionKey, null, poolId, routingStrategy, tenantId);
    } else {
      result = await waLoadBalancer.sendTextMessage(phone, message, sessionKey, null, poolId, routingStrategy, tenantId);
    }

    const msgId = result?.result?.messages?.[0]?.id || result?.result?.id?._serialized || "sent_" + Date.now();
    const senderPhone = result?.senderPhone || null;

    await db.promise().query(
      `UPDATE wa_campaign_messages SET status = 'sent', wa_message_id = ?, sender_phone = ?, pool_id = ?, sent_at = NOW() WHERE id = ?`,
      [msgId, senderPhone, poolId || null, contactId]
    );
    await db.promise().query(
      `UPDATE wa_message_logs SET status = 'sent', wa_message_id = ?, sender_phone = ?, metadata = ? WHERE campaign_message_id = ?`,
      [msgId, senderPhone, JSON.stringify(result || {}), contactId]
    );
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    await db.promise().query(
      `UPDATE wa_campaign_messages SET status = 'failed', error = ?, sent_at = NOW() WHERE id = ?`,
      [errorMsg, contactId]
    );
    await db.promise().query(
      `UPDATE wa_message_logs SET status = 'failed', error = ? WHERE campaign_message_id = ?`,
      [errorMsg, contactId]
    );
  }

  await db.promise().query(
    `UPDATE wa_campaigns SET sent_count = (SELECT COUNT(*) FROM wa_campaign_messages WHERE campaign_id = ? AND status = 'sent'), failed_count = (SELECT COUNT(*) FROM wa_campaign_messages WHERE campaign_id = ? AND status = 'failed') WHERE id = ?`,
    [campaignId, campaignId, campaignId]
  );
}

async function addBulkMessages(campaignId, messages, delayMs = 0, customIntervalMs = 7000) {
  const interval = Number(customIntervalMs || process.env.WA_MESSAGE_INTERVAL || 7000); // 7-second gap per message
  if (redisAvailable && messageQueue) {
    const jobs = messages.map((m, i) => ({
      name: `campaign-${campaignId}`,
      data: { ...m, campaignId },
      opts: { delay: delayMs + i * interval },
    }));
    return messageQueue.addBulk(jobs);
  }

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (delayMs || i > 0) {
      await new Promise((r) => setTimeout(r, i === 0 ? delayMs : interval));
    }
    await processSingleMessage(campaignId, m.contactId, m.phone, m.message, m.templateName, m.templateComponents);
  }
  return { success: true, count: messages.length };
}

async function addSingleMessage(data, delayMs = 0) {
  if (redisAvailable && messageQueue) {
    return messageQueue.add("single-message", data, { delay: delayMs });
  }
  if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  await processSingleMessage(data.campaignId, data.contactId, data.phone, data.message, data.templateName, data.templateComponents);
  return { success: true };
}

async function getQueueStats() {
  if (!redisAvailable || !messageQueue) {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, mode: "in-memory" };
  }
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      messageQueue.getWaitingCount(),
      messageQueue.getActiveCount(),
      messageQueue.getCompletedCount(),
      messageQueue.getFailedCount(),
      messageQueue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed, mode: "redis" };
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, mode: "redis-error" };
  }
}

async function getFailedJobs(limit = 50) {
  if (!redisAvailable || !messageQueue) return [];
  try {
    return messageQueue.getFailed(0, limit);
  } catch {
    return [];
  }
}

async function cleanQueue() {
  if (!redisAvailable || !messageQueue) return;
  try {
    await messageQueue.clean(0, 1000, "completed");
    await messageQueue.clean(0, 1000, "failed");
  } catch {}
}

module.exports = { messageQueue, startWorker, addBulkMessages, addSingleMessage, getQueueStats, getFailedJobs, cleanQueue };