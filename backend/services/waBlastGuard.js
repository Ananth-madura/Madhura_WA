"use strict";

/**
 * Bulk-send blast guard.
 *
 * Several endpoints can fan a message out to a large recipient list — campaign
 * start, the campaign wizard, direct broadcast, reminder bulk-send, contact
 * group creation, and "import all customers". Each of them can deliver to
 * hundreds or thousands of people in one request, and none of them previously
 * made the operator state how many recipients they were about to message.
 *
 * Two limits, both overridable by environment variable:
 *   SOFT_CAP — above this the caller must echo the exact recipient count in
 *              `confirm_count`, so a stray "select all", a miscount or a
 *              mis-clicked filter cannot go out unreviewed.
 *   HARD_CAP — never exceeded. Split the work into deliberate batches instead.
 */

const SOFT_CAP = () => Number(process.env.WA_BULK_SEND_SOFT_CAP || 500);
const HARD_CAP = () => Number(process.env.WA_BULK_SEND_HARD_CAP || 5000);

/**
 * @param {number} count number of recipients about to be messaged
 * @param {number|string} [confirmedCount] the count the caller acknowledged
 * @returns {string|null} an error message when the request must be rejected,
 *                         or null when it may proceed
 */
function checkBlastSize(count, confirmedCount) {
  const n = Number(count) || 0;
  if (n > HARD_CAP()) {
    return (
      `Refusing to queue ${n} recipients — the hard limit is ${HARD_CAP()}. ` +
      `Split this into smaller campaigns, or raise WA_BULK_SEND_HARD_CAP deliberately.`
    );
  }
  if (n > SOFT_CAP() && Number(confirmedCount) !== n) {
    return (
      `This would message ${n} recipients (limit without confirmation is ${SOFT_CAP()}). ` +
      `Re-send with confirm_count=${n} if that is genuinely intended.`
    );
  }
  return null;
}

module.exports = { checkBlastSize, SOFT_CAP, HARD_CAP };