import mongoose from "mongoose";
import { BackupType } from "./enums.js";

const { Schema } = mongoose;

// ============================================================
// BACKUP POLICY
// ============================================================

const BackupPolicySchema = new Schema(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    s3CredentialId: { type: Schema.Types.ObjectId, ref: "S3Credential", required: true },
    isEnabled: { type: Boolean, default: true },
    schedule: String,
    backupType: { type: String, enum: BackupType, default: "FULL" },
    retentionDays: { type: Number, default: 30 },
    s3PathPrefix: String,
  },
  { timestamps: true, versionKey: false }
);

export const BackupPolicy = mongoose.model("BackupPolicy", BackupPolicySchema);