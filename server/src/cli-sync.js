/**
 * One-shot sync from the terminal: `npm run sync`
 * Useful for checking your token works without starting the server.
 */
import { validateConfig } from "./config.js";
import { sync } from "./sync.js";

const { problems, warnings } = validateConfig();
if (problems.length > 0) {
  for (const problem of problems) console.error(`error: ${problem}`);
  process.exit(1);
}
for (const warning of warnings) console.warn(`warning: ${warning}`);

const result = await sync();
if (result.ok) {
  console.log(`Synced ${result.count} pull requests.`);
  process.exit(0);
}
console.error(`Sync failed: ${result.error}`);
process.exit(1);
