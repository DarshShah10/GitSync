import mongoose from "mongoose";
import { DeploymentStatus, DeploymentTrigger } from "./enums.js";

const { Schema } = mongoose;

// ============================================================
// DEPLOYMENT
// ============================================================

const DeploymentSchema = new Schema(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    status:    { type: String, enum: DeploymentStatus, default: "QUEUED" },
    trigger:   { type: String, enum: DeploymentTrigger, default: "MANUAL" },
    commitHash: String,
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: true, versionKey: false }
);

export const Deployment = mongoose.model("Deployment", DeploymentSchema);