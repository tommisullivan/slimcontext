/**
 * The UserPromptSubmit hook. Claude Code pipes a JSON payload on stdin; the
 * hook scores skills against the prompt, records telemetry, returns an
 * advisory for the model AND a user-visible `systemMessage`.
 *
 * Design rule: the hook must NEVER break a session. Any failure exits 0 with
 * no output.
 */
export interface HookInput {
    prompt?: string;
    cwd?: string;
    hook_event_name?: string;
    session_id?: string;
}
export interface HookResult {
    /** JSON to print to stdout (empty string = print nothing). */
    output: string;
    /** Whether a telemetry event was recorded. */
    logged: boolean;
}
/** Core hook logic. Pure apart from telemetry logging — easy to test. */
export declare function runHook(input: HookInput): HookResult;
/** Read all of stdin (used by the CLI `hook` subcommand). */
export declare function readStdin(): Promise<string>;
/** Entry point for `slimcontext hook`. Never throws; always exits cleanly. */
export declare function hookMain(): Promise<void>;
