import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

/**
 * verifyJWT middleware
 *
 * Reads the Authorization header (Bearer <token>), verifies the JWT,
 * looks up the user in MongoDB, and attaches them to req.user.
 *
 * Returns 401 if the token is missing, malformed, expired, or the user
 * no longer exists in the database.
 */
export const verifyJWT = async (req, res, next) => {
  try {
    // 1. Extract token from "Authorization: Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided. Please log in." });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Malformed authorization header." });
    }

    // 2. Verify token signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Session expired. Please log in again." });
      }
      return res.status(401).json({ error: "Invalid token. Please log in." });
    }

    // 3. Fetch user from DB (password is excluded via select: false in schema)
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: "User not found. Please log in again." });
    }

    // 4. Attach user to request for downstream handlers
    req.user = user;

    next();
  } catch (error) {
    console.error("verifyJWT Error:", error);
    res.status(500).json({ error: "Authentication error. Please try again." });
  }
};
