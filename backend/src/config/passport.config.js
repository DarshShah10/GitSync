import passport             from "@fastify/passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { User } from "../models/index.js";

passport.registerUserSerializer(async (user) => user._id.toString());

passport.registerUserDeserializer(async (id) => {
  return User.findById(id).select("-passwordHash");
});

async function findOrCreate({ field, id, email, name, avatarUrl, provider }) {
  let user = await User.findOne({ [field]: id });
  if (user) return user;

  if (email) {
    user = await User.findOne({ email });
    if (user) {
      user[field]     = id;
      user.isVerified = true;
      if (!user.avatarUrl && avatarUrl) user.avatarUrl = avatarUrl;
      return user.save();
    }
  }

  return User.create({
    name,
    email:      email ?? `${id}@${provider}.placeholder`,
    [field]:    id,
    avatarUrl,
    isVerified: true,
    provider,
  });
}

// Only register Google strategy if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  `${process.env.SERVER_URL}/api/auth/google/callback`,
      },
      async (_at, _rt, profile, done) => {
        try {
          done(null, await findOrCreate({
            field: "googleId", id: profile.id,
            email: profile.emails?.[0]?.value,
            name:  profile.displayName,
            avatarUrl: profile.photos?.[0]?.value ?? null,
            provider: "google",
          }));
        } catch (err) { done(err, null); }
      }
    )
  );
}

// Only register GitHub strategy if credentials are provided
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID:     process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL:  `${process.env.SERVER_URL}/api/auth/github/callback`,
        scope:        ["user:email"],
      },
      async (_at, _rt, profile, done) => {
        try {
          done(null, await findOrCreate({
            field: "githubId", id: String(profile.id),
            email: profile.emails?.[0]?.value,
            name:  profile.displayName || profile.username,
            avatarUrl: profile.photos?.[0]?.value ?? null,
            provider: "github",
          }));
        } catch (err) { done(err, null); }
      }
    )
  );
}

export { passport };