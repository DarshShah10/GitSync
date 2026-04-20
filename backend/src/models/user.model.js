import mongoose from "mongoose";
const { Schema } = mongoose;

// ============================================================
// USER
// ============================================================

const UserSchema = new Schema(
  {
    name:         { type: String, required: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    avatarUrl:    { type: String, default: null },
    isVerified:   { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    versionKey: false,
  }
);



export const User = mongoose.model("User", UserSchema);