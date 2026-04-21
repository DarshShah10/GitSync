import jwt from "jsonwebtoken";

const COOKIE_NAME = "gitsync_token";

export const signToken = (userId) =>
  jwt.sign({ id: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  });

export const verifyToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET);

// Fastify reply object
export const setCookie = (reply, token) => {
  const isProd = process.env.NODE_ENV === "production";
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge:   7 * 24 * 60 * 60,   // seconds for Fastify (not ms)
    path:     "/",
  });
};

export const clearCookie = (reply) => {
  reply.clearCookie(COOKIE_NAME, { path: "/" });
};

// Works for both cookie and Authorization: Bearer header
export const getTokenFromRequest = (request) =>
  request.cookies?.[COOKIE_NAME] ||
  request.headers.authorization?.replace(/^Bearer\s+/, "");