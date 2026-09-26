const nodemailer = require("nodemailer");
const db = require("../config/database");
const { getTransporterForUser } = require("./emailConfig");

function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
  });
}

let transporter = createTransporter();

if (transporter) {
  transporter.verify((error) => {
    if (error) {
      console.error("OTP email transporter verification failed:", error.message);
    } else {
      console.log("OTP email transporter is ready");
    }
  });
} else {
  console.warn("OTP email transporter not configured. Set EMAIL_USER and EMAIL_PASS in .env");
}

const sendEmailOtp = async (email, otp, customSubject, is2fa = false) => {
  const subject = customSubject || (is2fa ? "Your ACHME CRM 2FA Login Verification Code" : "Your Registration OTP");
  const htmlContent = is2fa ? `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; border: 1px solid #e5e3df; border-radius: 12px; max-width: 500px; margin: 0 auto; background-color: #ffffff; color: #1a1a1a; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 24px; font-weight: 800; color: #5645d4; tracking-tight">ACHME CRM</span>
      </div>
      <h2 style="color: #1a1a1a; font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 20px; margin-top: 0;">Two-Factor Verification Code</h2>
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; text-align: center;">Please enter the following 6-digit verification code to complete your secure sign-in:</p>
      <div style="background-color: #f6f5f4; border: 1px solid #e5e3df; border-radius: 8px; padding: 18px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #5645d4; margin: 25px 0; font-family: monospace;">
        ${otp}
      </div>
      <p style="color: #787671; font-size: 13px; line-height: 1.5; text-align: center; margin-bottom: 0;">This code is valid for <strong>5 minutes</strong>. If you did not make this request, please change your password immediately to secure your account.</p>
    </div>
  ` : `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; border: 1px solid #e5e3df; border-radius: 12px; max-width: 500px; margin: 0 auto; background-color: #ffffff; color: #1a1a1a; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 24px; font-weight: 800; color: #5645d4; tracking-tight">ACHME CRM</span>
      </div>
      <h2 style="color: #1a1a1a; font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 20px; margin-top: 0;">Registration Verification Code</h2>
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; text-align: center;">Use this verification code to complete your registration request:</p>
      <div style="background-color: #f6f5f4; border: 1px solid #e5e3df; border-radius: 8px; padding: 18px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #5645d4; margin: 25px 0; font-family: monospace;">
        ${otp}
      </div>
      <p style="color: #787671; font-size: 13px; line-height: 1.5; text-align: center; margin-bottom: 0;">This code is valid for <strong>5 minutes</strong>.</p>
    </div>
  `;

  let activeTransporter = transporter;
  let activeFrom = `"ACHME CRM Security" <${process.env.EMAIL_USER}>`;

  try {
    const user = await new Promise((resolve) => {
      db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email.toLowerCase()], (err, rows) => {
        if (!err && rows && rows.length > 0) resolve(rows[0]);
        else resolve(null);
      });
    });

    if (user) {
      const customConfig = await getTransporterForUser(user.id);
      if (customConfig && customConfig.transporter) {
        activeTransporter = customConfig.transporter;
        activeFrom = customConfig.fromAddress;
      }
    }
  } catch (e) {
    console.warn("Failed to retrieve custom user transporter for OTP, falling back to default:", e.message);
  }

  // Auto retry sending once if it fails
  if (!activeTransporter) {
    console.error("OTP email sending failed: No transporter configured. Set EMAIL_USER and EMAIL_PASS in .env");
    throw new Error("Email transporter not configured");
  }
  let retries = 2;
  for (let i = 0; i < retries; i++) {
    try {
      await activeTransporter.sendMail({
        from: activeFrom,
        to: email,
        subject: subject,
        html: htmlContent,
      });
      return;
    } catch (err) {
      if (i === retries - 1) {
        console.error("OTP email sending failed after attempts:", err.message);
        throw err;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
};

module.exports = sendEmailOtp;
