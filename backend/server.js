import 'dotenv/config';
console.log('SERVER FILE RUNNING');
// Diagnostic: report whether GROQ_API_KEY is present (never log its value)
console.log('GROQ_API_KEY is', process.env.GROQ_API_KEY ? 'set' : 'missing');

import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { startDoseNotificationWorker } from "./src/services/doseNotificationService.js";

const PORT = process.env.PORT || 5000;

// Connect to MongoDB & start dose notification scheduler
connectDB()
  .then(() => {
    startDoseNotificationWorker();
  })
  .catch((err) => {
    console.error("Failed to initialize database/worker:", err);
  });

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});