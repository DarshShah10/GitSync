import mongoose from "mongoose";

const { Schema } = mongoose;

// ============================================================
// PROJECT
// ============================================================

const EnvironmentSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true }
);

const ProjectSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    name:   { type: String, required: true },
    description: { type: String, default: null },

    environments: { type: [EnvironmentSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

export const Project = mongoose.model("Project", ProjectSchema);