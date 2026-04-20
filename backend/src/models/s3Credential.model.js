import mongoose from "mongoose";

const { Schema } = mongoose;

// ============================================================
// S3 CREDENTIAL
// ============================================================

const S3CredentialSchema = new Schema(
  {
    userId: Schema.Types.ObjectId,
    teamId: Schema.Types.ObjectId,
    name:   { type: String, required: true },
    endpoint: String,
    bucket:   { type: String, required: true },
    region:   { type: String, default: "us-east-1" },
    pathPrefix: String,
    accessKey: { type: String, required: true },
    secretKey: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);

export const S3Credential = mongoose.model("S3Credential", S3CredentialSchema);