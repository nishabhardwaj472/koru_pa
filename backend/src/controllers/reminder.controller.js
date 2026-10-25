import {
  syncDose,
  markDoseTaken,
} from "../services/doseNotificationService.js";
import { getEmailConfigStatus } from "../utils/sendEmail.js";

export const handleSyncDose = async (req, res) => {
  try {
    const userId = req.user._id;
    const dose = await syncDose(userId, req.body);
    res.status(200).json({ success: true, dose });
  } catch (error) {
    console.error("Sync Dose Error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
};

export const handleMarkTaken = async (req, res) => {
  try {
    const userId = req.user._id;
    const { reminderId, scheduledDate } = req.body;
    if (!reminderId) {
      return res.status(400).json({ error: "reminderId is required" });
    }
    const result = await markDoseTaken(userId, reminderId, scheduledDate);
    res.status(200).json(result);
  } catch (error) {
    console.error("Mark Taken Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getEmailConfig = async (req, res) => {
  try {
    const status = getEmailConfigStatus();
    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
