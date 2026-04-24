import mongoose from "mongoose";

const { Schema } = mongoose;

// ============================================================
// DEPLOYMENT
// Updated: added WEBHOOK to trigger enum, added commitMessage field
// ============================================================

const DeploymentSchema = new Schema(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },

    status:  {
      type: String,
      enum: ["QUEUED", "BUILDING", "DEPLOYING", "SUCCESS", "FAILED", "CANCELLED"],
      default: "QUEUED",
    },
    trigger: {
      type: String,
      enum: ["MANUAL", "WEBHOOK", "SCHEDULE", "API"],
      default: "MANUAL",
    },

    // Git state at time of deploy
    commitHash:    { type: String, default: null }, // short SHA e.g. "a3f2c1d"
    commitMessage: { type: String, default: null }, // e.g. "fix: update readme"

    // Build pack used for this specific deploy
    buildPack: {
      type:    String,
      enum:    ["NIXPACKS", "DOCKERFILE", "STATIC", "DOCKER_IMAGE", "DOCKER COMPOSE"],
      default: null,
    },

    // Docker image built during this deployment
    builtImageName: { type: String, default: null },

    // Timing
    startedAt:  { type: Date, default: null },
    finishedAt: { type: Date, default: null },

    // Error summary for FAILED deployments
    errorMessage: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);

DeploymentSchema.index({ serviceId: 1 });
DeploymentSchema.index({ status: 1 });
DeploymentSchema.index({ createdAt: -1 });

export const Deployment = mongoose.model("Deployment", DeploymentSchema);