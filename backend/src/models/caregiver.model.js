import mongoose from "mongoose";

const caregiverSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "UserId is required"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
    },
    relationship: {
      type: String,
      default: "loved one",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Caregiver = mongoose.model("Caregiver", caregiverSchema);

export default Caregiver;
