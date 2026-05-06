import { Resend } from "resend";

let resendInstance = null;

const getResend = () => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is missing in .env");
  }

  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }

  return resendInstance;
};

/**
 * Send an email using Resend
 * @param {string|string[]} to - Recipient email address(es)
 * @param {string} subject - Email subject
 * @param {string} message - Email body (HTML)
 * @returns {Promise<any>}
 */
export const sendEmail = async (to, subject, message) => {
  try {
    const resend = getResend();
    
    // Fallback 'from' address required by Resend.
    // Replace "onboarding@resend.dev" with your verified domain in production.
    const fromAddress = process.env.EMAIL_FROM || "onboarding@resend.dev";

    const response = await resend.emails.send({
      from: `Koru Assistant <${fromAddress}>`,
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      html: message,
    });

    if (response.error) {
      console.error("Resend API Error:", response.error);
      throw new Error(response.error.message);
    }

    // Optional nice-to-have log
    console.log(`Email sent to: ${Array.isArray(to) ? to.join(", ") : to}`);
    return response.data;
  } catch (error) {
    console.error("Failed to send email via Resend:", error);
    throw error;
  }
};
