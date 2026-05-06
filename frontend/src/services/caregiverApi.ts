import { getAuthHeader } from "@/services/authApi";

const BACKEND_URL = "http://localhost:5000/api/caregiver";

export interface Caregiver {
  _id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

// ── Add a new caregiver ──────────────────────────────────────────────────────
export const addCaregiver = async (caregiverData: {
  name: string;
  phone: string;
  email: string;
}): Promise<Caregiver> => {
  const response = await fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(caregiverData),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to add caregiver");
  }
  return data;
};

// ── Get all caregivers for logged-in user ────────────────────────────────────
export const getCaregivers = async (): Promise<Caregiver[]> => {
  const response = await fetch(BACKEND_URL, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch caregivers");
  }
  return data;
};

// ── Update an existing caregiver ─────────────────────────────────────────────
export const updateCaregiver = async (
  id: string,
  caregiverData: { name: string; phone: string; email: string },
): Promise<Caregiver> => {
  const response = await fetch(`${BACKEND_URL}/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(caregiverData),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to update caregiver");
  }
  return data;
};

// ── Delete a caregiver ───────────────────────────────────────────────────────
export const deleteCaregiver = async (id: string): Promise<void> => {
  const response = await fetch(`${BACKEND_URL}/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to delete caregiver");
  }
};

// ── Send emergency alert to all caregivers ───────────────────────────────────
export const sendCaregiverAlert = async (): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${BACKEND_URL}/alert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to send alert");
  }
  return data;
};
