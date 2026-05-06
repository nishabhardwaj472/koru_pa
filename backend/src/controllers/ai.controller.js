import Groq from "groq-sdk";
import Chat from "../models/chat.model.js";

// The Groq SDK will automatically use process.env.GROQ_API_KEY
// if we instantiate it without passing the apiKey option,
// but since the file is loaded at startup when env vars might not
// be fully populated yet, we can instantiate it lazily or just 
// use a getter. Let's create a function to get the instance.
let groqInstance = null;
const getGroq = () => {
    if (!groqInstance) {
        groqInstance = new Groq({
            apiKey: process.env.GROQ_API_KEY || "dummy", 
        });
    }
    return groqInstance;
};

// @desc    Chat with AI and save to DB
// @route   POST /api/ai/chat
export const chatWithAI = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ error: "Message is required and must be a string." });
    }

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: "GROQ_API_KEY environment variable is not set." });
    }

    const groq = getGroq();
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "user", content: message }
      ]
    });

    const aiReply = response.choices[0].message.content;

    // Save chat interaction to database
    const chat = new Chat({
        userMessage: message,
        aiReply: aiReply
    });
    
    await chat.save();

    res.json({
      reply: aiReply,
      chatId: chat._id
    });

  } catch (error) {
    console.error("AI Route Error:", error);
    res.status(500).json({ 
        error: "AI error", 
        details: error.message || "Unknown error occurred" 
    });
  }
};

// @desc    Get all chat history
// @route   GET /api/ai/history
export const getChatHistory = async (req, res) => {
    try {
        // Fetch all chats sorted by newest first
        const chats = await Chat.find({}).sort({ createdAt: -1 });
        res.json(chats);
    } catch (error) {
        console.error("Fetch History Error:", error);
        res.status(500).json({
            error: "Failed to fetch chat history",
            details: error.message || "Unknown error occurred"
        });
    }
};

export const testAiRoute = (req, res) => {
  res.send("AI route working");
};