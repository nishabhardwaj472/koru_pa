/**
 * Mock API service layer.
 *
 * All functions return Promises so they can be easily swapped with real
 * fetch/axios calls to a custom backend (e.g. Node.js + MongoDB) later.
 *
 * Configure the base URL via `VITE_API_BASE_URL` in your .env when wiring a
 * real backend. Until then, data is stored in localStorage.
 */

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

// ---------- Types ----------
export interface Profile {
  id: string;
  full_name: string;
  language: string;
}

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dosage: string;
  frequency: string;
  instructions: string | null;
  created_at: string;
}

export type ReminderStatus = "pending" | "taken" | "missed" | "snoozed";

export interface Reminder {
  id: string;
  user_id: string;
  medication_id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: ReminderStatus;
  taken_at: string | null;
}

export interface Caregiver {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string | null;
  relationship: string | null;
  notify_on_missed: boolean;
  created_at: string;
}

export interface Log {
  id: string;
  user_id: string;
  medication_id: string | null;
  action: string;
  logged_at: string;
}

// ---------- localStorage helpers ----------
const KEY = (userId: string, name: string) => `koru:${userId}:${name}`;

function read<T>(userId: string, name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(KEY(userId, name));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(userId: string, name: string, value: T) {
  localStorage.setItem(KEY(userId, name), JSON.stringify(value));
}

const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

// ---------- Profile ----------
export async function getProfile(userId: string): Promise<Profile | null> {
  await delay();
  return read<Profile | null>(userId, "profile", null);
}

export async function updateProfile(
  userId: string,
  patch: Partial<Profile>,
): Promise<Profile> {
  await delay();
  const current =
    read<Profile | null>(userId, "profile", null) ??
    ({ id: userId, full_name: "User", language: "en" } as Profile);
  const next = { ...current, ...patch, id: userId };
  write(userId, "profile", next);
  return next;
}

// ---------- Medications ----------
export async function listMedications(userId: string): Promise<Medication[]> {
  await delay();
  return read<Medication[]>(userId, "medications", []);
}

export async function createMedication(
  userId: string,
  data: Omit<Medication, "id" | "user_id" | "created_at">,
): Promise<Medication> {
  await delay();
  const meds = read<Medication[]>(userId, "medications", []);
  const med: Medication = {
    id: uid(),
    user_id: userId,
    created_at: new Date().toISOString(),
    ...data,
  };
  write(userId, "medications", [med, ...meds]);
  return med;
}

export async function createMedicationsBulk(
  userId: string,
  items: Array<Omit<Medication, "id" | "user_id" | "created_at">>,
): Promise<Medication[]> {
  await delay();
  const created: Medication[] = [];
  for (const it of items) created.push(await createMedication(userId, it));
  return created;
}

// ---------- Reminders ----------
export async function listReminders(userId: string): Promise<Reminder[]> {
  await delay();
  const items = read<Reminder[]>(userId, "reminders", []);
  return [...items].sort(
    (a, b) =>
      `${a.scheduled_date}T${a.scheduled_time}`.localeCompare(
        `${b.scheduled_date}T${b.scheduled_time}`,
      ),
  );
}

export async function createReminder(
  userId: string,
  data: { medication_id: string; scheduled_date: string; scheduled_time: string },
): Promise<Reminder> {
  await delay();
  const items = read<Reminder[]>(userId, "reminders", []);
  const reminder: Reminder = {
    id: uid(),
    user_id: userId,
    medication_id: data.medication_id,
    scheduled_date: data.scheduled_date,
    scheduled_time: data.scheduled_time,
    status: "pending",
    taken_at: null,
  };
  write(userId, "reminders", [...items, reminder]);
  return reminder;
}

export async function updateReminder(
  userId: string,
  reminderId: string,
  patch: Partial<Reminder>,
): Promise<void> {
  await delay();
  const items = read<Reminder[]>(userId, "reminders", []);
  write(
    userId,
    "reminders",
    items.map((r) => (r.id === reminderId ? { ...r, ...patch } : r)),
  );
}

// ---------- Caregivers ----------
export async function listCaregivers(userId: string): Promise<Caregiver[]> {
  await delay();
  return read<Caregiver[]>(userId, "caregivers", []);
}

export async function createCaregiver(
  userId: string,
  data: Omit<Caregiver, "id" | "user_id" | "created_at" | "notify_on_missed"> & {
    notify_on_missed?: boolean;
  },
): Promise<Caregiver> {
  await delay();
  const items = read<Caregiver[]>(userId, "caregivers", []);
  const cg: Caregiver = {
    id: uid(),
    user_id: userId,
    created_at: new Date().toISOString(),
    notify_on_missed: data.notify_on_missed ?? true,
    name: data.name,
    phone: data.phone,
    email: data.email,
    relationship: data.relationship,
  };
  write(userId, "caregivers", [cg, ...items]);
  return cg;
}

// ---------- Logs ----------
export async function listLogs(userId: string): Promise<Log[]> {
  await delay();
  const items = read<Log[]>(userId, "logs", []);
  return [...items].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
}

export async function createLog(
  userId: string,
  data: { medication_id: string | null; action: string },
): Promise<Log> {
  await delay();
  const items = read<Log[]>(userId, "logs", []);
  const log: Log = {
    id: uid(),
    user_id: userId,
    medication_id: data.medication_id,
    action: data.action,
    logged_at: new Date().toISOString(),
  };
  write(userId, "logs", [log, ...items]);
  return log;
}

// ---------- Real Backend Integration ----------
const BACKEND_URL = "http://localhost:5000";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Fetch chat history from the backend.
 * Returns an array of ChatMessage objects.
 */
export async function getChatHistory(): Promise<ChatMessage[]> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/history`);
    if (!response.ok) {
      throw new Error(`Failed to fetch history: ${response.statusText}`);
    }
    
    // The backend returns an array of objects like:
    // { userMessage: string, aiReply: string, createdAt: string }
    // We need to map this to our ChatMessage[] format.
    // Since we sort by newest first on backend, we should reverse it for the UI
    const rawData = await response.json();
    const history: ChatMessage[] = [];
    
    // Process in reverse so oldest is first
    for (let i = rawData.length - 1; i >= 0; i--) {
        const item = rawData[i];
        history.push({ role: "user", content: item.userMessage });
        history.push({ role: "assistant", content: item.aiReply });
    }
    
    return history;
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return []; // Return empty history on error
  }
}

/**
 * Send a message to the real backend and get the AI reply.
 */
export async function sendMessage(message: string): Promise<{ response: string; detectedLang: "hi" | "en" }> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Try to detect the language of the prompt to respond in the correct TTS language
    const detectLang = (text: string): "hi" | "en" => {
      if (/[\u0900-\u097F]/.test(text)) return "hi";
      if (/\b(kya|kaise|hai|hain|hoon|mein|aap|nahi|toh|dawai|dawa|goli|yaad|namaste|mujhe|medicine|chahiye)\b/i.test(text))
        return "hi";
      return "en";
    };

    return { 
        response: data.reply || "Sorry, I received an empty response.", 
        detectedLang: detectLang(message) 
    };

  } catch (error) {
    console.error("Error sending message:", error);
    throw new Error("Sorry, I'm having trouble connecting right now. Please try again later.");
  }
}
