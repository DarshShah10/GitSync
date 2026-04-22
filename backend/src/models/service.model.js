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
    // projectId:     { type: Schema.Types.ObjectId, ref: "Project", required: true },
    // environmentId: { type: Schema.Types.ObjectId, required: true },
    serverId:      { type: Schema.Types.ObjectId, ref: "Server", required: true },
    userId:        { type: Schema.Types.ObjectId, ref: "User", required: true },
    name:   { type: String, required: true },
    type:   { type: String, enum: ServiceType, required: true },
    status: { type: String, enum: ServiceStatus, default: "STOPPED" },

    containerId: { type: String, default: null },
    containerName: { type: String, default: null },
    volumeName:    String,
    imageName:     { type: String, default: null },

    internalPort: { type: Number, default: null },
    domain:       { type: String, default: null },
    
    
    nginxConfigFile: { type: String, default: null },


    exposedPort: Number,
    isPublic: { type: Boolean, default: false },

    connectionString: String,
    config: { type: Schema.Types.Mixed, default: {} },

    lastCommitHash: { type: String, default: null },
    lastDeployedAt: { type: Date,   default: null },

    healthStatus: {
      type:    String,
      enum:    ["HEALTHY", "UNHEALTHY", "UNKNOWN"],
      default: "UNKNOWN",
    },

    lastHealthCheckAt: Date,
    errorMessage: String,

    envVars: { type: [ServiceEnvVarSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

ServiceSchema.index({ projectId: 1 });
ServiceSchema.index({ environmentId: 1 });
ServiceSchema.index({ serverId: 1 });
ServiceSchema.index({ status: 1 });

export const Service = mongoose.model("Service", ServiceSchema);