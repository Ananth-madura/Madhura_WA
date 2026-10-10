"use strict";
const db = require("../config/database");
const pending = new Map();
async function applyDeliveryReceipt(ids, status, timestamp = new Date(), error = null) {
  ids = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean))];
  const previous = { sent: ['queued', 'sending'], delivered: ['queued', 'sending', 'sent', 'unknown'], read: ['queued', 'sending', 'sent', 'delivered', 'unknown'], failed: ['queued', 'sending', 'sent', 'unknown'] }[status];
  if (!ids.length || !previous) return false;
  const idSql = ids.map(() => '?').join(','), beforeSql = previous.map(() => '?').join(',');
  const time = new Date(timestamp).toISOString().replace('T', ' ').slice(0, 19);
  const fields = ['status = ?']; const values = [status];
  if (status === 'delivered' || status === 'read') { fields.push('delivered_at = COALESCE(delivered_at, ?)'); values.push(time); }
  if (status === 'read') { fields.push('read_at = COALESCE(read_at, ?)'); values.push(time); }
  if (status === 'failed') { fields.push('error = ?'); values.push(error || 'Provider reported failed delivery'); }
  await db.promise().query(`UPDATE wa_message_logs SET ${fields.join(',')} WHERE wa_message_id IN (${idSql}) AND status IN (${beforeSql})`, [...values, ...ids, ...previous]);
  const [changed] = await db.promise().query(`UPDATE wa_campaign_messages SET ${fields.join(',')} WHERE wa_message_id IN (${idSql}) AND status IN (${beforeSql})`, [...values, ...ids, ...previous]);
  if (!changed.affectedRows) {
    for (const id of ids) {
      const rank = { sent: 1, failed: 1, delivered: 2, read: 3 };
      if (!pending.has(id) || rank[status] >= rank[pending.get(id).status]) pending.set(id, { status, timestamp, error, at: Date.now() });
    }
    if (pending.size > 5000) pending.delete(pending.keys().next().value);
    return false;
  }
  for (const id of ids) pending.delete(id);
  const [rows] = await db.promise().query(`SELECT DISTINCT campaign_id FROM wa_campaign_messages WHERE wa_message_id IN (${idSql})`, ids);
  for (const row of rows) await db.promise().query(`UPDATE wa_campaigns SET
    sent_count = (SELECT COUNT(*) FROM wa_campaign_messages WHERE campaign_id = ? AND (status IN ('sent','delivered','read') OR (status = 'failed' AND wa_message_id IS NOT NULL))),
    delivered_count = (SELECT COUNT(*) FROM wa_campaign_messages WHERE campaign_id = ? AND status IN ('delivered','read')),
    read_count = (SELECT COUNT(*) FROM wa_campaign_messages WHERE campaign_id = ? AND status = 'read'),
    failed_count = (SELECT COUNT(*) FROM wa_campaign_messages WHERE campaign_id = ? AND status = 'failed') WHERE id = ?`,
    [row.campaign_id, row.campaign_id, row.campaign_id, row.campaign_id, row.campaign_id]);
  return true;
}
async function flushDeliveryReceipt(id) {
  const receipt = pending.get(id);
  if (!receipt) return;
  pending.delete(id);
  if (Date.now() - receipt.at < 10 * 60 * 1000) await applyDeliveryReceipt(id, receipt.status, receipt.timestamp, receipt.error);
}
module.exports = { applyDeliveryReceipt, flushDeliveryReceipt };
