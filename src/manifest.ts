/** Parsing of optional per-skill `slimcontext.yaml` manifests. */

import * as fs from "fs";
import * as path from "path";
import { parse } from "yaml";
import { SkillManifest } from "./types";

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") return [value];
  return [];
}

/** Coerce arbitrary parsed YAML into a well-formed manifest. */
export function normalizeManifest(raw: unknown): SkillManifest {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const triggersRaw = (
    obj.triggers && typeof obj.triggers === "object" ? obj.triggers : {}
  ) as Record<string, unknown>;

  return {
    alwaysLoad: obj.alwaysLoad === true || obj.always_load === true,
    triggers: {
      keywords: toStringArray(triggersRaw.keywords),
      globs: toStringArray(triggersRaw.globs),
      extensions: toStringArray(triggersRaw.extensions).map((e) =>
        e.replace(/^\./, ""),
      ),
    },
    dependsOn: toStringArray(obj.dependsOn ?? obj.depends_on),
  };
}

/** Load `slimcontext.yaml` (or `.yml`) from a skill directory, if present. */
export function loadManifest(skillDir: string): SkillManifest | null {
  for (const name of ["slimcontext.yaml", "slimcontext.yml"]) {
    const file = path.join(skillDir, name);
    if (!fs.existsSync(file)) continue;
    try {
      return normalizeManifest(parse(fs.readFileSync(file, "utf8")));
    } catch {
      return null;
    }
  }
  return null;
}
