const webpush = require("web-push");
const db = require("../config/database");
const fs = require("fs");
const path = require("path");

let publicKey = process.env.VAPID_PUBLIC_KEY;
let privateKey = process.env.VAPID_PRIVATE_KEY;

// Auto-generate VAPID keys if they are not in environment variables
if (!publicKey || !privateKey) {
  const envPath = path.join(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf8");
    const pubMatch = envContent.match(/VAPID_PUBLIC_KEY=(.*)/);
    const privMatch = envContent.match(/VAPID_PRIVATE_KEY=(.*)/);
    
    if (pubMatch && privMatch) {
      publicKey = pubMatch[1].trim();
      privateKey = privMatch[1].trim();
    } else {
      console.log("Generating fresh VAPID Keys for Push Notifications...");
      const keys = webpush.generateVAPIDKeys();
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
      
      // Append to backend .env
      envContent += `\nVAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\n`;
      fs.writeFileSync(envPath, envContent, "utf8");
      console.log("VAPID Keys generated and saved to backend/.env");
    }
  } else {
    console.warn("VAPID Setup Warning: backend/.env not found, using temporary session VAPID keys");
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
  }
}

// Configure web-push with VAPID details
webpush.setVapidDetails(
  "mailto:thanan757@gmail.com",
  publicKey,
  privateKey
);

/**
 * Expose VAPID Public Key
 */
const getVapidPublicKey = () => publicKey;

/**
 * Send Web Push Notification to a specific User ID
 */
const sendPushToUser = (userId, title, body, url = "/dashboard") => {
  if (!userId) return;
  
  const sql = "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?";
  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.error("[Web Push] Failed to fetch subscriptions for user:", userId, err);
      return;
    }
    
    if (rows.length === 0) {
      console.log(`[Web Push] No active push subscriptions found for user: ${userId}`);
      return;
    }
    
    const payload = JSON.stringify({ title, body, url });
    
    rows.forEach(sub => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };
      
      webpush.sendNotification(subscription, payload)
        .then(() => {
          console.log(`[Web Push] Successfully delivered push to user ${userId}`);
        })
        .catch(pushErr => {
          console.warn(`[Web Push] Failed pushing to subscriber. Status: ${pushErr.statusCode}`);
          // If subscription is expired/invalid (410 Gone / 404 Not Found), prune it from database!
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            db.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [sub.endpoint], () => {
              console.log("[Web Push] Pruned expired subscription from database:", sub.endpoint);
            });
          }
        });
    });
  });
};

/**
 * Send Web Push Notification to all Admins & Sub-admins
 */
const sendPushToAdmins = (title, body, url = "/dashboard") => {
  const sql = `
    SELECT ps.endpoint, ps.p256dh, ps.auth 
    FROM push_subscriptions ps
    JOIN teammember tm ON ps.user_id = tm.user_id
    WHERE tm.emp_role IN ('admin', 'subadmin')
  `;
  
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("[Web Push] Failed to fetch admin subscriptions:", err);
      return;
    }
    
    if (rows.length === 0) {
      console.log("[Web Push] No active admin push subscriptions found.");
      return;
    }
    
    const payload = JSON.stringify({ title, body, url });
    
    rows.forEach(sub => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };
      
      webpush.sendNotification(subscription, payload)
        .then(() => {
          console.log("[Web Push] Successfully delivered push to admin.");
        })
        .catch(pushErr => {
          console.warn(`[Web Push] Failed pushing to admin subscriber. Status: ${pushErr.statusCode}`);
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            db.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [sub.endpoint], () => {
              console.log("[Web Push] Pruned expired admin subscription from database:", sub.endpoint);
            });
          }
        });
    });
  });
};

module.exports = {
  getVapidPublicKey,
  sendPushToUser,
  sendPushToAdmins
};
