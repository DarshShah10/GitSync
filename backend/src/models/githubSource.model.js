import mongoose from "mongoose";

const { Schema } = mongoose;

// ============================================================
// GITHUB SOURCE
// ============================================================

const GitHubSourceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },

    name: { type: String, required: true },
    organization: { type: String, default: null },
    isSystemWide: { type: Boolean, default: false },

    // GitHub App credentials
    appId: { type: String, default: null },
    installationId: { type: String, default: null },
    clientId: { type: String, default: null },
    clientSecret: { type: String, default: null },
    webhookSecret: { type: String, default: null },
    privateKey: { type: String, default: null }, // PEM key, should be encrypted in prod

    // For self-hosted / Enterprise GitHub
    htmlUrl: { type: String, default: "https://github.com" },
    apiUrl: { type: String, default: "https://api.github.com" },
    gitUser: { type: String, default: "git" },
    gitPort: { type: Number, default: 22 },

    // Installation method: "automated" | "manual"
    installationType: {
      type: String,
      enum: ["automated", "manual"],
      default: "automated",
    },

    // Status
    isConnected: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

GitHubSourceSchema.index({ userId: 1 });
GitHubSourceSchema.index({ teamId: 1 });

export const GitHubSource = mongoose.model("GitHubSource", GitHubSourceSchema);