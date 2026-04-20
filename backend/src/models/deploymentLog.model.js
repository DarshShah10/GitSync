import mongoose from "mongoose";

const { Schema } = mongoose;

// ============================================================
// DEPLOYMENT LOG
// ============================================================

const DeploymentLogSchema = new Schema(
  {
    deploymentId: { type: Schema.Types.ObjectId, ref: "Deployment", required: true },
    line:   { type: Number, required: true },
    output: { type: String, required: true },
    isError:{ type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

export const DeploymentLog = mongoose.model("DeploymentLog", DeploymentLogSchema);