import User from "../models/user.model.js";

// ── Helper: build the response payload ──────────────────────────────────────
const buildAuthResponse = (user, token) => ({
  token,
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  },
});

// ── @desc   Register a new user
// ── @route  POST /api/auth/register
// ── @access Public
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    // Check if email is already taken
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    // Create user — password is hashed by the pre-save hook in the model
    const user = await User.create({ name, email, password });

    // Generate JWT
    const token = User.generateToken(user._id);

    res.status(201).json(buildAuthResponse(user, token));
  } catch (error) {
    console.error("Register Error Details:", error.name, error.message, error.stack?.split('\n')[0]);

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(" ") });
    }

    res.status(500).json({ error: "Registration failed. Please try again." });
  }
};

// ── @desc   Login an existing user
// ── @route  POST /api/auth/login
// ── @access Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    // Include password field (excluded by default via select: false)
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = User.generateToken(user._id);

    res.status(200).json(buildAuthResponse(user, token));
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
};

// ── @desc   Get currently authenticated user
// ── @route  GET /api/auth/me
// ── @access Protected (requires verifyJWT middleware)
export const getMe = async (req, res) => {
  try {
    // req.user is attached by verifyJWT middleware
    res.status(200).json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      createdAt: req.user.createdAt,
    });
  } catch (error) {
    console.error("GetMe Error:", error);
    res.status(500).json({ error: "Failed to retrieve user info." });
  }
};
