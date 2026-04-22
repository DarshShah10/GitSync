import mongoose from "mongoose";
import { DeploymentStatus, DeploymentTrigger } from "./enums.js";

const { Schema } = mongoose;

// ============================================================
// DEPLOYMENT
//
// One document per deploy attempt.
// Created before the job is queued, updated throughout the pipeline.
//
// Pipeline lifecycle:
//   QUEUED     → job added to BullMQ queue
//   BUILDING   → SSH connected, git clone + docker build running
//   DEPLOYING  → docker run + nginx reload in progress
//   SUCCESS    → container running, Nginx serving traffic
//   FAILED     → any step threw an error (see DeploymentLog for details)
//   CANCELLED  → user manually cancelled before it finished
//
// Logs are stored in DeploymentLog (one doc per line) for real-time
// SSE streaming. After deployment finishes the full log text is
// also saved here in `logsSummary` for quick access without joining.
// ============================================================

const DeploymentSchema = new Schema(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },

    status:  { type: String, enum: DeploymentStatus, default: "QUEUED" },
    trigger: { type: String, enum: DeploymentTrigger, default: "MANUAL" },

    // Git state at time of deploy
    commitHash: { type: String, default: null }, // short SHA e.g. "a3f2c1d"

    // Build pack used for this specific deploy
    // Stored here because user can change it between deploys
    buildPack: {
      type:    String,
      enum:    ["NIXPACKS", "DOCKERFILE", "STATIC"],
      default: null,
    },

    // Docker image built during this deployment
    // e.g. "myapp-abc123:a3f2c1d" (name:commitHash)
    // Stored so old images can be pruned after successful redeploy
    builtImageName: { type: String, default: null },

    // Timing
    startedAt:  { type: Date, default: null },
    finishedAt: { type: Date, default: null },

    // Error summary for FAILED deployments (full detail in DeploymentLog)
    errorMessage: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);

// ── Indexes ───────────────────────────────────────────────────
DeploymentSchema.index({ serviceId: 1 });
DeploymentSchema.index({ status: 1 });
DeploymentSchema.index({ createdAt: -1 });

export const Deployment = mongoose.model("Deployment", DeploymentSchema);