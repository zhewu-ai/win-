import { SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
}

function getPassword(): string {
  if (!process.env.SESSION_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET environment variable is required in production. " +
          "Generate a random string of at least 32 characters and set it in .env or environment."
      );
    }
    console.warn(
      "[WARN] SESSION_SECRET not set. Using insecure default for development. " +
        "Set SESSION_SECRET in .env for production."
    );
    return "complex_password_at_least_32_characters_long_for_secure_session";
  }
  return process.env.SESSION_SECRET;
}

export const sessionOptions: SessionOptions = {
  password: getPassword(),
  cookieName: "notes-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};
