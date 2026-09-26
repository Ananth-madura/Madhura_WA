/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Skip downloading Chrome headless shell during npm install to prevent EPERM/network installation errors
  skipDownload: true,
};
