import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import caregiverRoutes from "./routes/caregiver.routes.js";
import alertRoutes from "./routes/alert.routes.js";

const app = express();

// ✅ FIRST: Core middleware
app.use(cors());
app.use(express.json());

// ✅ THEN: Routes
app.use("/api/auth", authRoutes);       // Register, Login, Me
app.use("/api/ai", aiRoutes);           // AI chat (unprotected)
app.use("/api/caregiver", caregiverRoutes); // Caregiver CRUD (protected)
app.use("/api/alert", alertRoutes);     // Emergency alerts (protected)

// Health check route
app.get("/", (req, res) => {
  res.send("Koru API is running...");
});

export default app;