// content.ts — load the Launch Kit markdown docs (PA-LAUNCHKIT-IMPL-4/5).
//
// The Mission Control review and the 7-day setup plan are authored as markdown in src/data/launch-kit/
// and rendered on /app/launch-kit. Server-only: reads the files from the project root with fs. The files
// are traced into the serverless bundle via outputFileTracingIncludes in next.config.mjs so the read
// resolves in production as well as dev/build.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type LaunchKitDoc =
  | "brain-setup-checklist"
  | "mission-control-review"
  | "7-day-setup-plan";

const DOC_DIR = join(process.cwd(), "src", "data", "launch-kit");

/** Read a Launch Kit markdown doc as a string. Throws if the file is missing (a build/deploy error). */
export function loadLaunchKitDoc(doc: LaunchKitDoc): string {
  return readFileSync(join(DOC_DIR, `${doc}.md`), "utf8");
}
