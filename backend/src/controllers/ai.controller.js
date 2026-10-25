import Groq from "groq-sdk";
import Chat from "../models/chat.model.js";

// The Groq SDK will automatically use process.env.GROQ_API_KEY
// if we instantiate it without passing the apiKey option,
// but since the file is loaded at startup when env vars might not
// be fully populated yet, we can instantiate it lazily or just 
// use a getter. Let's create a function to get the instance.
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// @desc    Chat with AI and save to DB
// @route   POST /api/ai/chat
export const chatWithAI = async (req, res) => {
  try {
    console.log('chatWithAI called with body:', req.body);
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ error: "Message is required and must be a string." });
    }

    // The GROQ_API_KEY is loaded via dotenv at startup. The lazy Groq initializer will throw if missing.
    // No need for a separate environment variable check here.

    // Diagnostic key length
console.log('GROQ_API_KEY length at request:', (process.env.GROQ_API_KEY || '').length);
    // groq client already initialized
    // Using the initialized groq client
    const response = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",
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
    // Log detailed Groq API error without leaking secrets
    const status = error?.response?.status ?? 500;
    const providerMessage = error?.response?.data?.error?.message || error.message || 'Unknown error';
    const providerCode = error?.response?.data?.error?.code || null;
    console.error('AI Route Error:', { status, providerMessage, providerCode });
    res.status(status).json({
      error: 'AI service error',
      details: providerMessage,
      code: providerCode,
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