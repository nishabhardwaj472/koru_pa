import Caregiver from "../models/caregiver.model.js";
import nodemailer from "nodemailer";

// ── @desc    Add caregiver
// ── @route   POST /api/caregiver
// ── @access  Protected
export const addCaregiver = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, phone, email } = req.body;

    if (!name || !phone || !email) {
      return res.status(400).json({ error: "Name, phone, and email are required" });
    }

    // Enforce max 2 caregivers per user
    const count = await Caregiver.countDocuments({ userId });
    if (count >= 2) {
      return res.status(400).json({ error: "You can only add up to 2 caregivers" });
    }

    const caregiver = await Caregiver.create({ userId, name, phone, email });

    res.status(201).json(caregiver);
  } catch (error) {
    console.error("Add Caregiver Error:", error);
    res.status(500).json({ error: "Failed to add caregiver" });
  }
};

// ── @desc    Get all caregivers for logged-in user
// ── @route   GET /api/caregiver
// ── @access  Protected
export const getCaregivers = async (req, res) => {
  try {
    const userId = req.user._id;
    const caregivers = await Caregiver.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json(caregivers);
  } catch (error) {
    console.error("Get Caregivers Error:", error);
    res.status(500).json({ error: "Failed to fetch caregivers" });
  }
};

// ── @desc    Update caregiver
// ── @route   PUT /api/caregiver/:id
// ── @access  Protected
export const updateCaregiver = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { name, phone, email } = req.body;

    // Only update the caregiver if it belongs to this user
    const caregiver = await Caregiver.findOneAndUpdate(
      { _id: id, userId },
      { name, phone, email },
      { new: true, runValidators: true }
    );

    if (!caregiver) {
      return res.status(404).json({ error: "Caregiver not found" });
    }

    res.status(200).json(caregiver);
  } catch (error) {
    console.error("Update Caregiver Error:", error);
    res.status(500).json({ error: "Failed to update caregiver" });
  }
};

// ── @desc    Delete caregiver
// ── @route   DELETE /api/caregiver/:id
// ── @access  Protected
export const deleteCaregiver = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    // Only delete the caregiver if it belongs to this user
    const caregiver = await Caregiver.findOneAndDelete({ _id: id, userId });

    if (!caregiver) {
      return res.status(404).json({ error: "Caregiver not found" });
    }

    res.status(200).json({ message: "Caregiver deleted successfully" });
  } catch (error) {
    console.error("Delete Caregiver Error:", error);
    res.status(500).json({ error: "Failed to delete caregiver" });
  }
};

// ── @desc    Send alert to all caregivers via email
// ── @route   POST /api/caregiver/alert
// ── @access  Protected
export const sendCaregiverAlert = async (req, res) => {
  try {
    const userId = req.user._id;

    const caregivers = await Caregiver.find({ userId });

    if (caregivers.length === 0) {
      return res.status(400).json({ error: "No caregivers found to alert" });
    }

    // Configure nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const emails = caregivers.map((c) => c.email).join(",");

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: emails,
      subject: "Emergency Alert 🚨",
      text: "Emergency! The patient needs help immediately.",
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "Caregiver notified via email",
    });
  } catch (error) {
    console.error("Send Alert Error:", error);
    res.status(500).json({
      error: "Failed to send alert",
      details: error.message,
    });
  }
};
