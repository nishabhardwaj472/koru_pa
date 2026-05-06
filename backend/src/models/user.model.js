import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Never returned in queries by default
    },
  },
  {
    timestamps: true,
  }
);

// ── Pre-save hook: hash password before storing ─────────────────────────────
userSchema.pre("save", async function () {
  // Only hash if password changed
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ── Instance method: compare plain-text password against stored hash ─────────
userSchema.methods.matchPassword = async function (plainTextPassword) {
  return bcrypt.compare(plainTextPassword, this.password);
};

// ── Static method: sign a JWT for this user ──────────────────────────────────
userSchema.statics.generateToken = function (userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const User = mongoose.model("User", userSchema);

export default User;
