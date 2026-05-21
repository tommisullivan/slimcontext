"use strict";
/**
 * Resolves the files a skill pulls in beyond its own SKILL.md.
 *
 * Skills (GSD's especially) reference workflow / instruction files via Claude
 * Code's `@path` syntax or markdown links. Those load on demand when the skill
 * runs — so they belong in the on-demand body-pool figure.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractReferences = extractReferences;
exports.referencedTokens = referencedTokens;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const tokens_1 = require("./tokens");
/** How deep to follow reference chains (a referenced file may reference more). */
const MAX_DEPTH = 3;
/** Skip absurdly large files. */
const MAX_FILE_BYTES = 2_000_000;
const REF_EXTENSIONS = "md|markdown|txt|py|sh|js|ts|cjs|mjs|json|ya?ml|toml";
/** Extract candidate file references from skill/markdown content. */
function extractReferences(content) {
    const refs = new Set();
    // Claude Code `@path` references, e.g. @$HOME/.claude/.../explore.md
    const atRe = new RegExp(`@([A-Za-z0-9$~_./\\\\-]+\\.(?:${REF_EXTENSIONS}))`, "gi");
    for (const m of content.matchAll(atRe))
        refs.add(m[1]);
    // markdown links to local files, e.g. [text](./references/foo.md)
    const mdRe = new RegExp(`\\]\\(([^)]+\\.(?:${REF_EXTENSIONS}))\\)`, "gi");
    for (const m of content.matchAll(mdRe)) {
        const p = m[1].trim();
        if (!/^https?:/i.test(p))
            refs.add(p);
    }
    return [...refs];
}
/** Resolve a reference string to an absolute path. */
function resolvePath(ref, baseDir) {
    let p = ref.trim().replace(/\\/g, "/");
    if (p.startsWith("$HOME"))
        p = os.homedir() + p.slice(5);
    else if (p.startsWith("~"))
        p = os.homedir() + p.slice(1);
    if (path.isAbsolute(p))
        return path.normalize(p);
    return path.normalize(path.join(baseDir, p));
}
/**
 * Total estimated tokens of every file a skill transitively references.
 * Deduplicated and depth-limited; never throws.
 */
function referencedTokens(skillDir, content) {
    const visited = new Set();
    let total = 0;
    const walk = (baseDir, text, depth) => {
        if (depth > MAX_DEPTH)
            return;
        for (const ref of extractReferences(text)) {
            const resolved = resolvePath(ref, baseDir);
            if (visited.has(resolved))
                continue;
            visited.add(resolved);
            let body;
            try {
                const stat = fs.statSync(resolved);
                if (!stat.isFile() || stat.size > MAX_FILE_BYTES)
                    continue;
                body = fs.readFileSync(resolved, "utf8");
            }
            catch {
                continue; // missing / unreadable reference — skip
            }
            total += (0, tokens_1.estimateTokens)(body);
            walk(path.dirname(resolved), body, depth + 1);
        }
    };
    walk(skillDir, content, 0);
    return total;
}
