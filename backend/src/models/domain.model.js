import mongoose from 'mongoose'

const domainSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    subdomain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // IPv4 address the subdomain points to
    ip: {
      type: String,
      default: null,
    },

    // IPv6 address (optional)
    ipv6: {
      type: String,
      default: null,
    },

    lastUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

// Virtual: full domain string e.g. "john.git-sync.app"
domainSchema.virtual('fullDomain').get(function () {
  const base = process.env.BASE_DOMAIN || 'git-sync.app'
  return `${this.subdomain}.${base}`
})

domainSchema.set('toJSON', { virtuals: true })
domainSchema.set('toObject', { virtuals: true })

export const Domain = mongoose.model('Domain', domainSchema)