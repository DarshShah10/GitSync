import mongoose from "mongoose";
const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    name:         { type: String, required: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },      // ← was required, now nullable for OAuth users
    avatarUrl:    { type: String, default: null },
    isVerified:   { type: Boolean, default: false },

    // ── OAuth additions ───────────────────────────────────────
    provider: {
      type:    String,
      enum:    ["local", "google", "github"],
      default: "local",
    },
    googleId: { type: String, default: null },
    githubId: { type: String, default: null },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    versionKey: false,
  }
);

// Sparse+partial so null values are never indexed (fixes E11000 on null)
UserSchema.index(
  { googleId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { googleId: { $type: "string" } } }
);
UserSchema.index(
  { githubId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { githubId: { $type: "string" } } }
);

// Safe shape — strips passwordHash before any API response
UserSchema.methods.toSafeObject = function () {
  return {
    _id:        this._id,
    name:       this.name,
    email:      this.email,
    avatarUrl:  this.avatarUrl,
    isVerified: this.isVerified,
    provider:   this.provider,
    createdAt:  this.createdAt,
  };
};

export const User = mongoose.model("User", UserSchema);