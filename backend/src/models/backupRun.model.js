import mongoose from "mongoose";
import { BackupRunStatus, BackupType } from "./enums.js";

const { Schema } = mongoose;

// ============================================================
// BACKUP RUN
// ============================================================

const BackupRunSchema = new Schema(
  {
    backupPolicyId: { type: Schema.Types.ObjectId, ref: "BackupPolicy", required: true },
    status: { type: String, enum: BackupRunStatus, default: "PENDING" },
    backupType: { type: String, enum: BackupType, required: true },
    s3Key: String,
    sizeBytes: Number,
    errorMessage: String,
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true, versionKey: false }
);

export const BackupRun = mongoose.model("BackupRun", BackupRunSchema);