import { passport }   from "../config/passport.config.js";
import {
  signup, login, logout, getMe, oauthCallback,
} from "../controllers/auth.controller.js";

export async function authRoutes(app) {
  // ── Local ─────────────────────────────────────────────────
  app.post("/api/auth/signup", { config: { skipAuth: true } }, signup);
  app.post("/api/auth/login",  { config: { skipAuth: true } }, login);
  app.post("/api/auth/logout", { config: { skipAuth: true } }, logout);
  app.get( "/api/auth/me",     { config: { skipAuth: true } }, getMe);

  // ── Google ─────────────────────────────────────────────────
  app.get("/api/auth/google",
    { config: { skipAuth: true } },
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  // ✅ passport.authenticate goes in preHandler, oauthCallback is the actual handler
  app.get("/api/auth/google/callback",
    {
      config:     { skipAuth: true },
      preHandler: passport.authenticate("google", {
        failureRedirect: `${IENT_URprocess.env.CLL}/auth?error=oauth_failed`,
      }),
    },
    oauthCallback   // ← now actually runs after passport succeeds
  );

  // ── GitHub ─────────────────────────────────────────────────
  app.get("/api/auth/github",
    { config: { skipAuth: true } },
    passport.authenticate("github", { scope: ["user:email"] })
  );

  app.get("/api/auth/github/callback",
    {
      config:     { skipAuth: true },
      preHandler: passport.authenticate("github", {
        failureRedirect: `${process.env.CLIENT_URL}/auth?error=oauth_failed`,
      }),
    },
    oauthCallback
  );
}