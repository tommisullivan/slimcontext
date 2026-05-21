/** Parsing of optional per-skill `slimcontext.yaml` manifests. */
import { SkillManifest } from "./types";
/** Coerce arbitrary parsed YAML into a well-formed manifest. */
export declare function normalizeManifest(raw: unknown): SkillManifest;
/** Load `slimcontext.yaml` (or `.yml`) from a skill directory, if present. */
export declare function loadManifest(skillDir: string): SkillManifest | null;
