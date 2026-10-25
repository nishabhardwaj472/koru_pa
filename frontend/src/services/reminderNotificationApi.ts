import { getAuthHeader } from "@/services/authApi";

const BACKEND_URL = "http://localhost:5000/api/reminders";

export interface SyncDoseData {
  reminderId: string;
  medicationName: string;
  dosage?: string;
  scheduledDate: string;
  scheduledTime: string;
  status?: "pending" | "snoozed" | "taken";
}

export interface EmailConfigStatus {
  configured: boolean;
  provider: string;
  details: string;
}

/**
 * Sync dose schedule to backend for reliable 30-minute caregiver email schedules
 */
export async function syncDoseToBackend(doseData: SyncDoseData): Promise<void> {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader.Authorization) {
      // User is not authenticated with backend JWT; skip backend sync safely
      return;
    }

    const response = await fetch(`${BACKEND_URL}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      body: JSON.stringify(doseData),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.warn("Failed to sync dose schedule to backend:", errData);
    }
  } catch (err) {
    // Non-blocking: fail safely without breaking frontend UI
    console.warn("Could not connect to backend to sync dose schedule:", err);
  }
}

/**
 * Inform backend that dose was marked Taken to cancel remaining caregiver email reminders
 */
export async function markDoseTakenOnBackend(
  reminderId: string,
  scheduledDate?: string
): Promise<void> {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader.Authorization) return;

    await fetch(`${BACKEND_URL}/taken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      body: JSON.stringify({ reminderId, scheduledDate }),
    });
  } catch (err) {
    console.warn("Failed to mark dose taken on backend:", err);
  }
}

/**
 * Check if caregiver email sending is configured on the backend
 */
export async function fetchEmailConfigStatus(): Promise<EmailConfigStatus | null> {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader.Authorization) return null;

    const response = await fetch(`${BACKEND_URL}/email-config`, {
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}
