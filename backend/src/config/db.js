
import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;

        if (!uri) {
            throw new Error("MONGODB_URI is missing in the .env file");
        }

        // Log target host (credentials hidden)
        try {
          const parsed = new URL(uri.replace(/^mongodb\+srv:/, 'http:'));
          console.log(`Attempting MongoDB connection to host: ${parsed.hostname}`);
        } catch {
          console.log('Attempting MongoDB connection with provided URI');
        }
        const conn = await mongoose.connect(uri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        // Fail fast – exit if DB cannot be reached
        process.exit(1);
    }
};

export default connectDB;
