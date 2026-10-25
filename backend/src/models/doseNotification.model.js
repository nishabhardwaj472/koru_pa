import mongoose from "mongoose";

const notificationHistorySchema = new mongoose.Schema(
  {
    sentAt: {
      type: Date,
      default: Date.now,
    },
    recipient: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["sent", "failed", "unconfigured"],
      default: "sent",
    },
    error: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const doseNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reminderId: {
      type: String,
      required: true,
      index: true,
    },
    medicationName: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      default: "",
      trim: true,
    },
    scheduledDate: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    scheduledTime: {
      type: String, // HH:MM
      required: true,
    },
    originalScheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "snoozed", "taken"],
      default: "pending",
      index: true,
    },
    takenAt: {
      type: Date,
      default: null,
    },
    nextNotificationAt: {
      type: Date,
      required: true,
      index: true,
    },
    notificationHistory: [notificationHistorySchema],
  },
  {
    timestamps: true,
  }
);

// Unique compound index: each scheduled dose for a reminder is unique per day
doseNotificationSchema.index(
  { userId: 1, reminderId: 1, scheduledDate: 1 },
  { unique: true }
);

const DoseNotification = mongoose.model("DoseNotification", doseNotificationSchema);

export default DoseNotification;
