import express from "express";
import { sendEmergencyAlert } from "../controllers/alert.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Alert routes require authentication
router.post("/send", verifyJWT, sendEmergencyAlert);

export default router;
