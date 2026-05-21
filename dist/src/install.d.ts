/** Installs/removes the slimcontext hook in the Claude Code settings file. */
export declare function isHookInstalled(): boolean;
export interface InstallResult {
    settingsPath: string;
    alreadyInstalled: boolean;
    backupPath: string | null;
}
/** Add the UserPromptSubmit hook without clobbering existing settings. */
export declare function installHook(): InstallResult;
export interface UninstallResult {
    settingsPath: string;
    removed: boolean;
}
/** Remove the slimcontext hook, leaving all other settings intact. */
export declare function uninstallHook(): UninstallResult;
