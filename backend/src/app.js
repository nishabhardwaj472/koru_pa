import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import caregiverRoutes from "./routes/caregiver.routes.js";
import alertRoutes from "./routes/alert.routes.js";
import reminderRoutes from "./routes/reminder.routes.js";

const app = express();

// ✅ FIRST: Core middleware
app.use(cors());
app.use(express.json());

// ✅ THEN: Routes
app.use("/api/auth", authRoutes);       // Register, Login, Me
app.use("/api/ai", aiRoutes);           // AI chat (unprotected)
app.use("/api/caregiver", caregiverRoutes); // Caregiver CRUD (protected)
app.use("/api/alert", alertRoutes);     // Emergency alerts (protected)
app.use("/api/reminders", reminderRoutes); // Reminder & dose notification schedule (protected)
// Error handling for malformed JSON payloads
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Bad JSON payload:', err);
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

// Health check route
app.get("/", (req, res) => {
  res.send("Koru API is running...");
});

export default app;