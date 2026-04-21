import mongoose from "mongoose";

const { Schema } = mongoose;

// ============================================================
// API TOKEN
// ============================================================

const ApiTokenSchema = new Schema(
  {
    userId: Schema.Types.ObjectId,
    teamId: Schema.Types.ObjectId,
    name: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    lastUsed: Date,
    expiresAt: Date,
  },
  { timestamps: true, versionKey: false }
);

export const ApiToken = mongoose.model("ApiToken", ApiTokenSchema);