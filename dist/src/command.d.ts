/** Installs/removes the `/slimcontext` and `/update-slimcontext` slash commands. */
export declare function menuCommandPath(): string;
export declare function updateCommandPath(): string;
/** Back-compat alias — the primary command path. */
export declare function commandPath(): string;
export declare function isCommandInstalled(): boolean;
export interface CommandInstallResult {
    paths: string[];
    created: boolean;
}
/** Write (or refresh) both slash commands. */
export declare function installCommand(): CommandInstallResult;
export interface CommandUninstallResult {
    removed: boolean;
}
/** Remove both slash commands. */
export declare function uninstallCommand(): CommandUninstallResult;
