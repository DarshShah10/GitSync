import mongoose from "mongoose";
import { TeamRole } from "./enums.js";

const { Schema } = mongoose;

// ============================================================
// TEAM
// ============================================================

// EMBEDDED subdocument
const TeamMemberSchema = new Schema(
  {
    userId:   { type: Schema.Types.ObjectId, ref: "User", required: true },
    role:     { type: String, enum: TeamRole, default: "MEMBER" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: true, versionKey: false }
);

const TeamSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    members: { type: [TeamMemberSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);



export const Team = mongoose.model("Team", TeamSchema);