/**
 * Real backend authentication API service.
 *
 * Connects to the Express backend for:
 *  - register → POST /api/auth/register
 *  - login    → POST /api/auth/login
 *  - getMe    → GET  /api/auth/me  (requires token)
 *
 * The JWT is stored in localStorage under TOKEN_KEY.
 */

const BACKEND_URL = "http://localhost:5000";

/** Key used to persist the JWT in localStorage */
export const TOKEN_KEY = "koru:jwt";

// ---------- Types ----------
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

// ---------- Token helpers ----------
export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const storeToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);

export const removeToken = (): void => localStorage.removeItem(TOKEN_KEY);

/** Build Authorization header for protected requests */
export const getAuthHeader = (): Record<string, string> => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ---------- API calls ----------

/**
 * Register a new user.
 * On success, stores the JWT and returns the auth payload.
 */
export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Registration failed. Please try again.");
  }

  storeToken(data.token);
  return data as AuthResponse;
}

/**
 * Login an existing user.
 * On success, stores the JWT and returns the auth payload.
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Login failed. Please check your credentials.");
  }

  storeToken(data.token);
  return data as AuthResponse;
}

/**
 * Fetch the current user using the stored JWT.
 * Returns null if the token is missing or invalid.
 */
export async function getMe(): Promise<AuthUser | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Token expired or invalid — clear it
      removeToken();
      return null;
    }

    return (await response.json()) as AuthUser;
  } catch {
    return null;
  }
}
