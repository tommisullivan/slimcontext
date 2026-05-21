"use strict";
/** Parsing of optional per-skill `slimcontext.yaml` manifests. */
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
exports.normalizeManifest = normalizeManifest;
exports.loadManifest = loadManifest;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml_1 = require("yaml");
function toStringArray(value) {
    if (Array.isArray(value))
        return value.map((v) => String(v));
    if (typeof value === "string")
        return [value];
    return [];
}
/** Coerce arbitrary parsed YAML into a well-formed manifest. */
function normalizeManifest(raw) {
    const obj = (raw && typeof raw === "object" ? raw : {});
    const triggersRaw = (obj.triggers && typeof obj.triggers === "object" ? obj.triggers : {});
    return {
        alwaysLoad: obj.alwaysLoad === true || obj.always_load === true,
        triggers: {
            keywords: toStringArray(triggersRaw.keywords),
            globs: toStringArray(triggersRaw.globs),
            extensions: toStringArray(triggersRaw.extensions).map((e) => e.replace(/^\./, "")),
        },
        dependsOn: toStringArray(obj.dependsOn ?? obj.depends_on),
    };
}
/** Load `slimcontext.yaml` (or `.yml`) from a skill directory, if present. */
function loadManifest(skillDir) {
    for (const name of ["slimcontext.yaml", "slimcontext.yml"]) {
        const file = path.join(skillDir, name);
        if (!fs.existsSync(file))
            continue;
        try {
            return normalizeManifest((0, yaml_1.parse)(fs.readFileSync(file, "utf8")));
        }
        catch {
            return null;
        }
    }
    return null;
}
