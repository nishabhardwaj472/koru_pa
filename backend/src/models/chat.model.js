import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
    {
        userMessage: {
            type: String,
            required: [true, "User message is required"],
        },
        aiReply: {
            type: String,
            required: [true, "AI reply is required"],
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt
    }
);

const Chat = mongoose.model("Chat", chatSchema);

export default Chat;
