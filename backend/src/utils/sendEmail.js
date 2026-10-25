import { Resend } from "resend";
import nodemailer from "nodemailer";

let resendInstance = null;

const getResend = () => {
  if (process.env.RESEND_API_KEY && !resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
};

/**
 * Check if email service is configured in the environment
 */
export const isEmailConfigured = () => {
  if (process.env.RESEND_API_KEY) return true;
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) return true;
  return false;
};

/**
 * Detailed configuration status for diagnostics & reporting
 */
export const getEmailConfigStatus = () => {
  if (process.env.RESEND_API_KEY) {
    return {
      configured: true,
      provider: "Resend",
      details: "Configured using RESEND_API_KEY",
    };
  }
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return {
      configured: true,
      provider: "Nodemailer (SMTP/Gmail)",
      details: `Configured using EMAIL_USER (${process.env.EMAIL_USER})`,
    };
  }
  return {
    configured: false,
    provider: "none",
    details:
      "Email sending is not configured. Please set RESEND_API_KEY or EMAIL_USER and EMAIL_PASS in backend/.env.",
  };
};

/**
 * Send an email using Resend or Nodemailer with fallback
 * @param {string|string[]} to - Recipient email address(es)
 * @param {string} subject - Email subject
 * @param {string} htmlMessage - Email body (HTML)
 * @param {string} [textMessage] - Optional plain text email body
 * @returns {Promise<any>}
 */
export const sendEmail = async (to, subject, htmlMessage, textMessage) => {
  const recipients = Array.isArray(to) ? to : [to];

  // 1. Try Resend if RESEND_API_KEY is present
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = getResend();
      const fromAddress = process.env.EMAIL_FROM || "onboarding@resend.dev";
      const response = await resend.emails.send({
        from: `Koru Assistant <${fromAddress}>`,
        to: recipients,
        subject: subject,
        html: htmlMessage,
        text: textMessage || htmlMessage.replace(/<[^>]+>/g, " "),
      });

      if (response.error) {
        console.error("Resend API Error:", response.error);
        throw new Error(response.error.message);
      }

      console.log(`[Email Sent via Resend] To: ${recipients.join(", ")}`);
      return response.data;
    } catch (error) {
      console.error("Failed to send email via Resend:", error.message);
      throw error;
    }
  }

  // 2. Try Nodemailer if EMAIL_USER and EMAIL_PASS are present
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: `"Koru Assistant" <${process.env.EMAIL_USER}>`,
        to: recipients.join(", "),
        subject: subject,
        html: htmlMessage,
        text: textMessage || htmlMessage.replace(/<[^>]+>/g, " "),
      });

      console.log(`[Email Sent via Nodemailer] To: ${recipients.join(", ")} MessageId: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error("Failed to send email via Nodemailer:", error.message);
      throw error;
    }
  }

  // 3. Not configured
  const errorMsg =
    "Caregiver email sending is not configured. Set RESEND_API_KEY or EMAIL_USER and EMAIL_PASS in backend/.env.";
  console.warn(`[sendEmail] ${errorMsg}`);
  throw new Error(errorMsg);
};
