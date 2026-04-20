import mongoose from "mongoose";
import { AuthType, ServerStatus, OsType } from "./enums.js";

const { Schema } = mongoose;

// ============================================================
// SERVER
// ============================================================

const ServerCredentialSchema = new Schema(
  {
    authType:     { type: String, enum: AuthType, required: true },
    sshUsername:  { type: String, default: "root" },
    sshPrivateKey: { type: String, default: null },
    sshPassword:  { type: String, default: null },
  },
  { _id: false }
);

const UsedPortSchema = new Schema(
  {
    port:      { type: Number, required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", default: null },
    status:    { type: String, enum: ["in_use", "reserved"], required: true },
  },
  { _id: false }
);

const ServerSchema = new Schema(
  {
    userId:        { type: Schema.Types.ObjectId, ref: "User", required: true },
    teamId:        { type: Schema.Types.ObjectId, ref: "Team", default: null },
    name:          { type: String, required: true },
    ip:            { type: String, required: true },
    sshPort:       { type: Number, default: 22 },
    osType:        { type: String, enum: OsType, default: "OTHER" },
    status:        { type: String, enum: ServerStatus, default: "PENDING" },
    dockerVersion: { type: String, default: null },
    lastCheckedAt: { type: Date, default: null },
    errorMessage:  { type: String, default: null },

    usedPorts:     { type: [UsedPortSchema], default: [] },
    credential:    { type: ServerCredentialSchema, default: null },
  },
  { timestamps: true, versionKey: false }
);

ServerSchema.index({ userId: 1 });
ServerSchema.index({ teamId: 1 });
ServerSchema.index({ status: 1 });

export const Server = mongoose.model("Server", ServerSchema);