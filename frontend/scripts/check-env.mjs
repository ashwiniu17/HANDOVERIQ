// Runs before "next build" (see the "build" script in package.json).
// Stops the build with a clear message when the backend address is missing,
// because a deployed site without it has no server to talk to.
// Development, linting and type checking do not need it.
import nextEnv from "@next/env";

// Read .env.local / .env.production the same way "next build" does.
nextEnv.loadEnvConfig(process.cwd(), false);

const value = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();

if (!value) {
  console.error(
    [
      "",
      "BUILD STOPPED: NEXT_PUBLIC_API_BASE_URL is not set.",
      "",
      "Set it to the public address of your HANDOVERIQ backend, for example",
      "  https://your-backend.onrender.com   (no trailing slash)",
      "",
      "  On Netlify:  Site configuration -> Environment variables",
      "  Locally:     copy .env.example to .env.local and edit it",
      "",
    ].join("\n")
  );
  process.exit(1);
}

if (!/^https?:\/\//i.test(value)) {
  console.error(
    `\nBUILD STOPPED: NEXT_PUBLIC_API_BASE_URL must start with http:// or https:// (got "${value}").\n`
  );
  process.exit(1);
}

console.log(`Backend address for this build: ${value.replace(/\/+$/, "")}`);
