import bcrypt                            from "bcryptjs";
import { User }                          from "../models/index.js";
import { signToken, setCookie, clearCookie, getTokenFromRequest, verifyToken } from "../utils/jwt.utils.js"; // ← add getTokenFromRequest and verifyToken

const SALT_ROUNDS = 12;

// ── Local signup ──────────────────────────────────────────────
export async function signup(request, reply) {
  const { name, email, password } = request.body ?? {};
  if (!name?.trim() || !email?.trim() || !password)
    return reply.status(400).send({ success: false, error: "Name, email and password are required." });
  if (password.length < 8)
    return reply.status(400).send({ success: false, error: "Password must be at least 8 characters." });

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing)
    return reply.status(409).send({ success: false, error: "An account with that email already exists." });

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    provider: "local",
  });

  setCookie(reply, signToken(user._id));
  return reply.status(201).send({ success: true, user: user.toSafeObject() });
}

// ── Local login ───────────────────────────────────────────────
export async function login(request, reply) {
  const { email, password } = request.body ?? {};
  if (!email?.trim() || !password)
    return reply.status(400).send({ success: false, error: "Email and password are required." });

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !user.passwordHash)
    return reply.status(401).send({ success: false, error: "Invalid email or password." });

  if (!(await bcrypt.compare(password, user.passwordHash)))
    return reply.status(401).send({ success: false, error: "Invalid email or password." });

  setCookie(reply, signToken(user._id));
  return reply.send({ success: true, user: user.toSafeObject() });
}

// ── Logout ────────────────────────────────────────────────────
export async function logout(_request, reply) {
  clearCookie(reply);
  return reply.send({ success: true, message: "Signed out." });
}

// ── Current user ──────────────────────────────────────────────
export async function getMe(request, reply) {
  const token = getTokenFromRequest(request)
  if (!token) return reply.status(401).send({ success: false, error: "Not authenticated." })

  try {
    const decoded = verifyToken(token)
    const user    = await User.findById(decoded.id)
    if (!user) return reply.status(401).send({ success: false, error: "Account not found." })
    return reply.send({ success: true, user: user.toSafeObject() })
  } catch {
    return reply.status(401).send({ success: false, error: "Invalid or expired session." })
  }
}

// ── OAuth callback ─────────────────────────────────────────────
// req.user is set by passport strategy before this runs
export async function oauthCallback(request, reply) {
  setCookie(reply, signToken(request.user._id));
  return reply.redirect(`${process.env.CLIENT_URL}/dashboard`);
}