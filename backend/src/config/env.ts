import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32).default("dev-only-secret-change-me-please-1234567890"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8080),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  GOOGLE_DRIVE_SCOPE: z.string().default("https://www.googleapis.com/auth/drive.metadata.readonly")
});

export const env = schema.parse(process.env);
