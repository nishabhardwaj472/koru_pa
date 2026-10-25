import DoseNotification from "../models/doseNotification.model.js";
import Caregiver from "../models/caregiver.model.js";
import { sendEmail, isEmailConfigured, getEmailConfigStatus } from "../utils/sendEmail.js";

/**
 * Register or update a scheduled dose in the database
 */
export async function syncDose(userId, doseData) {
  const {
    reminderId,
    medicationName,
    dosage,
    scheduledDate,
    scheduledTime,
    status = "pending",
  } = doseData;

  if (!reminderId || !scheduledDate || !scheduledTime) {
    throw new Error("reminderId, scheduledDate, and scheduledTime are required");
  }

  // Calculate original scheduled datetime
  const originalScheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);

  // Initial next notification time is exactly 30 minutes after original scheduled dose time
  const initialNextNotification = new Date(
    originalScheduledAt.getTime() + 30 * 60 * 1000
  );

  let dose = await DoseNotification.findOne({
    userId,
    reminderId,
    scheduledDate,
  });

  if (!dose) {
    dose = await DoseNotification.create({
      userId,
      reminderId,
      medicationName: medicationName || "Scheduled Medication",
      dosage: dosage || "",
      scheduledDate,
      scheduledTime,
      originalScheduledAt,
      status: status === "taken" ? "taken" : status === "snoozed" ? "snoozed" : "pending",
      takenAt: status === "taken" ? new Date() : null,
      nextNotificationAt: initialNextNotification,
    });
  } else {
    // If dose was already marked Taken, do not re-open unless explicitly requested
    if (dose.status === "taken" && status !== "taken") {
      return dose;
    }

    if (status === "taken") {
      dose.status = "taken";
      dose.takenAt = new Date();
    } else if (status === "snoozed") {
      dose.status = "snoozed";
      // Note: Preserve originalScheduledAt and nextNotificationAt so Snooze does not
      // create duplicate caregiver notifications or push back caregiver alerts
    }

    if (medicationName) dose.medicationName = medicationName;
    if (dosage !== undefined) dose.dosage = dosage;

    await dose.save();
  }

  return dose;
}

/**
 * Mark a dose as Taken immediately and stop future caregiver notifications
 */
export async function markDoseTaken(userId, reminderId, scheduledDate) {
  const query = { userId, reminderId };
  if (scheduledDate) query.scheduledDate = scheduledDate;

  const doses = await DoseNotification.find(query);
  if (doses.length === 0) {
    return { success: true, updated: 0 };
  }

  const now = new Date();
  for (const d of doses) {
    d.status = "taken";
    d.takenAt = now;
    await d.save();
  }

  return { success: true, updated: doses.length };
}

/**
 * Background worker: Rechecks doses and sends caregiver email every 30 minutes
 * if dose remains unconfirmed.
 */
export async function processDueDoseNotifications() {
  try {
    const now = new Date();

    // Query doses that are NOT taken and whose next notification time has arrived
    const dueDoses = await DoseNotification.find({
      status: { $ne: "taken" },
      nextNotificationAt: { $lte: now },
    });

    if (dueDoses.length === 0) {
      return;
    }

    const emailStatus = getEmailConfigStatus();

    for (const dose of dueDoses) {
      // 1. Recheck dose status immediately before sending
      const freshDose = await DoseNotification.findById(dose._id);
      if (!freshDose || freshDose.status === "taken") {
        continue;
      }

      // 2. Fetch user's caregivers
      const caregivers = await Caregiver.find({ userId: dose.userId });
      if (!caregivers || caregivers.length === 0) {
        // No caregivers configured, advance check time by 30 mins
        freshDose.nextNotificationAt = new Date(Date.now() + 30 * 60 * 1000);
        await freshDose.save();
        continue;
      }

      // 3. Check if email sending is configured
      if (!emailStatus.configured) {
        console.warn(
          `[DoseNotification] Email not sent for dose "${dose.medicationName}" (${dose.scheduledDate} ${dose.scheduledTime}): ${emailStatus.details}`
        );

        freshDose.notificationHistory.push({
          sentAt: new Date(),
          recipient: caregivers.map((c) => c.email).join(", "),
          subject: "Medication reminder: dose not confirmed",
          status: "unconfigured",
          error: emailStatus.details,
        });

        // Advance next notification time by 30 minutes
        freshDose.nextNotificationAt = new Date(Date.now() + 30 * 60 * 1000);
        await freshDose.save();
        continue;
      }

      // 4. Send email to each configured caregiver
      for (const cg of caregivers) {
        if (!cg.email || !cg.email.trim()) continue;

        const relationship = cg.relationship || "loved one";
        const subject = "Medication reminder: dose not confirmed";
        const textBody = `Hello,\n\nThis is a reminder that your ${relationship} has not confirmed taking their scheduled medication dose.\n\nMedication: ${dose.medicationName}\nDosage: ${dose.dosage || "Not specified"}\nScheduled time: ${dose.scheduledDate} at ${dose.scheduledTime}\nStatus: Not confirmed\n\nPlease check in with them to ensure they have taken their medication if appropriate.\n\nThis is an automated notification from Koru.`;

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; rounded-radius: 8px;">
            <p>Hello,</p>
            <p>This is a reminder that your <strong>${relationship}</strong> has not confirmed taking their scheduled medication dose.</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 4px 0;"><strong>Medication:</strong> ${dose.medicationName}</p>
              <p style="margin: 4px 0;"><strong>Dosage:</strong> ${dose.dosage || "Not specified"}</p>
              <p style="margin: 4px 0;"><strong>Scheduled time:</strong> ${dose.scheduledDate} at ${dose.scheduledTime}</p>
              <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #d97706; font-weight: bold;">Not confirmed</span></p>
            </div>
            <p>Please check in with them to ensure they have taken their medication if appropriate.</p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
            <p style="font-size: 12px; color: #666;">This is an automated notification from Koru.</p>
          </div>
        `;

        try {
          await sendEmail(cg.email, subject, htmlBody, textBody);
          freshDose.notificationHistory.push({
            sentAt: new Date(),
            recipient: cg.email,
            subject,
            status: "sent",
          });
        } catch (err) {
          console.error(
            `[DoseNotification] Failed to send email to ${cg.email}:`,
            err.message
          );
          freshDose.notificationHistory.push({
            sentAt: new Date(),
            recipient: cg.email,
            subject,
            status: "failed",
            error: err.message,
          });
        }
      }

      // 5. Advance next notification time by 30 minutes for ongoing reminders
      freshDose.nextNotificationAt = new Date(Date.now() + 30 * 60 * 1000);
      await freshDose.save();
    }
  } catch (err) {
    console.error("[DoseNotificationWorker] Error processing due doses:", err);
  }
}

let workerInterval = null;

/**
 * Start the background worker (checks every 30 seconds for due caregiver notifications)
 */
export function startDoseNotificationWorker() {
  if (workerInterval) return;
  console.log("[DoseNotificationWorker] Started caregiver notification scheduler");
  // Run once immediately on start
  void processDueDoseNotifications();
  // Check every 30 seconds
  workerInterval = setInterval(() => {
    void processDueDoseNotifications();
  }, 30 * 1000);
}

export function stopDoseNotificationWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}
