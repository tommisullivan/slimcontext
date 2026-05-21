/** Discovery of installed skills from the Claude Code skill directories. */
import { Skill } from "./types";
export interface DiscoverOptions {
    /**
     * Follow each skill's `@path` / markdown file references and count their
     * tokens too. Adds filesystem reads — off by default so the hook stays fast.
     */
    resolveReferences?: boolean;
}
/** Split a markdown file into YAML frontmatter data and the body. */
export declare function parseFrontmatter(content: string): {
    data: Record<string, unknown>;
    body: string;
};
/**
 * Discover every skill visible to an agent running in `cwd`.
 * User skills first, then project skills; project shadows user on name clash.
 */
export declare function discoverSkills(cwd?: string, opts?: DiscoverOptions): Skill[];
