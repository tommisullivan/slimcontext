"use strict";
/** Discovery of installed skills from the Claude Code skill directories. */
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
exports.parseFrontmatter = parseFrontmatter;
exports.discoverSkills = discoverSkills;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml_1 = require("yaml");
const config_1 = require("./config");
const manifest_1 = require("./manifest");
const tokens_1 = require("./tokens");
/** Split a markdown file into YAML frontmatter data and the body. */
function parseFrontmatter(content) {
    if (content.startsWith("---")) {
        const close = content.indexOf("\n---", 3);
        if (close !== -1) {
            const fm = content.slice(3, close).trim();
            let body = content.slice(close + 4);
            body = body.replace(/^[^\n]*\n/, ""); // drop the rest of the closing line
            try {
                const data = (0, yaml_1.parse)(fm);
                return {
                    data: (data && typeof data === "object" ? data : {}),
                    body,
                };
            }
            catch {
                return { data: {}, body: content };
            }
        }
    }
    return { data: {}, body: content };
}
/** Locate the SKILL.md inside a skill directory (case-insensitive). */
function findSkillFile(skillDir) {
    let entries;
    try {
        entries = fs.readdirSync(skillDir);
    }
    catch {
        return null;
    }
    const match = entries.find((e) => e.toLowerCase() === "skill.md");
    return match ? path.join(skillDir, match) : null;
}
function readSkillsFrom(dir, source) {
    if (!fs.existsSync(dir))
        return [];
    const out = [];
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return [];
    }
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const skillDir = path.join(dir, entry.name);
        const file = findSkillFile(skillDir);
        if (!file)
            continue;
        let content;
        try {
            content = fs.readFileSync(file, "utf8");
        }
        catch {
            continue;
        }
        const { data } = parseFrontmatter(content);
        const name = String(data.name ?? entry.name).trim() || entry.name;
        const description = String(data.description ?? "").trim();
        out.push({
            name,
            dir: skillDir,
            file,
            description,
            body: content,
            source,
            manifest: (0, manifest_1.loadManifest)(skillDir),
            tokensDescription: (0, tokens_1.estimateTokens)(`${name} ${description}`),
            tokensBody: (0, tokens_1.estimateTokens)(content),
        });
    }
    return out;
}
/**
 * Discover every skill visible to an agent running in `cwd`.
 * User skills first, then project skills; project shadows user on name clash.
 */
function discoverSkills(cwd = process.cwd()) {
    const user = readSkillsFrom((0, config_1.userSkillsDir)(), "user");
    const project = readSkillsFrom((0, config_1.projectSkillsDir)(cwd), "project");
    const byName = new Map();
    for (const s of user)
        byName.set(s.name, s);
    for (const s of project)
        byName.set(s.name, s);
    return [...byName.values()];
}
