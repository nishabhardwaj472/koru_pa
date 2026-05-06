import express from "express";
import {
  addCaregiver,
  getCaregivers,
  updateCaregiver,
  deleteCaregiver,
  sendCaregiverAlert,
} from "../controllers/caregiver.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All caregiver routes require authentication
router.use(verifyJWT);

router.post("/", addCaregiver);
router.get("/", getCaregivers);
router.put("/:id", updateCaregiver);
router.delete("/:id", deleteCaregiver);
router.post("/alert", sendCaregiverAlert);

export default router;
