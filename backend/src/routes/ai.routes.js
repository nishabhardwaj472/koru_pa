import express from "express";
import { chatWithAI, testAiRoute, getChatHistory } from "../controllers/ai.controller.js";

console.log("AI ROUTES LOADED"); // 👈 add this

const router = express.Router();

router.get("/chat", testAiRoute);
router.post("/chat", chatWithAI);
router.get("/history", getChatHistory);

export default router;