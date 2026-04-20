import mongoose from "mongoose";
import { ServiceType, ServiceStatus, EnvVarScope } from "./enums.js";

const { Schema } = mongoose;

// ============================================================
// SERVICE
// ============================================================

const ServiceEnvVarSchema = new Schema(
  {
    key:       { type: String, required: true },
    value:     { type: String, required: true },
    isSecret:  { type: Boolean, default: false },
    scope:     { type: String, enum: EnvVarScope, default: "ALL" },
  },
  { timestamps: true }
);

const ServiceSchema = new Schema(
  {
    projectId:     { type: Schema.Types.ObjectId, ref: "Project", required: true },
    environmentId: { type: Schema.Types.ObjectId, required: true },
    serverId:      { type: Schema.Types.ObjectId, ref: "Server", required: true },

    name:   { type: String, required: true },
    type:   { type: String, enum: ServiceType, required: true },
    status: { type: String, enum: ServiceStatus, default: "STOPPED" },

    containerId:   String,
    containerName: String,
    volumeName:    String,

    domain: String,
    internalPort: Number,
    exposedPort: Number,
    isPublic: { type: Boolean, default: false },

    connectionString: String,
    config: { type: Schema.Types.Mixed, default: {} },

    lastCommitHash: String,
    lastDeployedAt: Date,

    lastHealthCheckAt: Date,
    errorMessage: String,

    envVars: { type: [ServiceEnvVarSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

export const Service = mongoose.model("Service", ServiceSchema);