/**
 * Resolves the files a skill pulls in beyond its own SKILL.md.
 *
 * Skills (GSD's especially) reference workflow / instruction files via Claude
 * Code's `@path` syntax or markdown links. Those load on demand when the skill
 * runs — so they belong in the on-demand body-pool figure.
 */
/** Extract candidate file references from skill/markdown content. */
export declare function extractReferences(content: string): string[];
/**
 * Total estimated tokens of every file a skill transitively references.
 * Deduplicated and depth-limited; never throws.
 */
export declare function referencedTokens(skillDir: string, content: string): number;
