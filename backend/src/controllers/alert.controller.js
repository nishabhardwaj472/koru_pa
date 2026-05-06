import Caregiver from "../models/caregiver.model.js";
import { sendEmail } from "../utils/sendEmail.js";

// ── @desc    Send emergency alert using Resend
// ── @route   POST /api/alert/send
// ── @access  Protected
export const sendEmergencyAlert = async (req, res) => {
  try {
    const userId = req.user._id;
    const { message: optionalMessage } = req.body;

    // Fetch user's caregivers from DB
    const caregivers = await Caregiver.find({ userId });

    // Validation: No caregivers → return error
    if (!caregivers || caregivers.length === 0) {
      return res.status(400).json({ error: "No caregivers found to alert." });
    }

    // Limit to 2 caregivers max
    const limitedCaregivers = caregivers.slice(0, 2);

    // Extract valid emails
    const validEmails = limitedCaregivers
      .map((c) => c.email)
      .filter((email) => email && email.trim() !== "");

    if (validEmails.length === 0) {
      return res.status(400).json({ error: "No valid email addresses found for caregivers." });
    }

    const timestamp = new Date().toLocaleString();
    let emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #d9534f;">🚨 Emergency Alert 🚨</h2>
        <p><strong>Emergency! The patient needs help immediately.</strong></p>
        <p><strong>Time:</strong> ${timestamp}</p>
    `;

    if (optionalMessage) {
      emailHtml += `
        <div style="margin-top: 20px; padding: 15px; border-left: 4px solid #f0ad4e; background-color: #fcf8e3;">
          <p style="margin: 0;"><strong>Message from patient:</strong></p>
          <p style="margin: 5px 0 0 0;">${optionalMessage}</p>
        </div>
      `;
    }

    emailHtml += `</div>`;

    // Send email to all caregivers via Resend
    await sendEmail(validEmails, "Emergency Alert 🚨", emailHtml);

    res.status(200).json({
      success: true,
      emailsSent: validEmails.length,
    });
  } catch (error) {
    console.error("Emergency Alert Controller Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send emergency alert",
      details: error.message || "Unknown error occurred",
    });
  }
};
