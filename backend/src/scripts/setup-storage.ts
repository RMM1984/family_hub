import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

async function main() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  for (const name of ["receipts", "documents"]) {
    const { error } = await supabase.storage.createBucket(name, { public: true });
    if (error && !error.message.toLowerCase().includes("already exists")) {
      throw error;
    }
    console.log(`Bucket listo: ${name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
