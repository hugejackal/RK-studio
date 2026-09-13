import { writeFileSync } from "node:fs";

const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();

if (!supabaseUrl || !publishableKey) {
  console.error("Missing required Netlify environment variables: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const config = `window.RK_CONFIG = Object.freeze({
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabasePublishableKey: ${JSON.stringify(publishableKey)}
});\n`;

writeFileSync("config.js", config, "utf8");
console.log("Generated config.js for RK Studio production build.");
