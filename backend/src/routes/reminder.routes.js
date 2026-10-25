import express from "express";
import {
  handleSyncDose,
  handleMarkTaken,
  getEmailConfig,
} from "../controllers/reminder.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Protected routes (require user authentication)
router.post("/sync", verifyJWT, handleSyncDose);
router.post("/taken", verifyJWT, handleMarkTaken);
router.get("/email-config", verifyJWT, getEmailConfig);

export default router;
