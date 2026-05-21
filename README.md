<p align="center">
  <img src="assets/banner.svg" alt="slimcontext — keep only the skills your task needs" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-3fb950" alt="MIT">
  <img src="https://img.shields.io/badge/node-%E2%89%A518-3fb950" alt="Node >=18">
  <img src="https://img.shields.io/badge/tests-35%20passing-3fb950" alt="35 tests passing">
  <img src="https://img.shields.io/badge/API%20keys-none-3fb950" alt="no API keys">
  <img src="https://img.shields.io/badge/runs-100%25%20local-3fb950" alt="100% local">
</p>

<p align="center">
  <b>You installed 143 skills. Your AI agent loads all 143 to fix one bug.</b><br>
  slimcontext scores your skills against the task at hand and keeps only the ones that matter —
  fully local, free, with a token-savings dashboard.
</p>

---

## See it work

<p align="center">
  <img src="assets/demo.svg" alt="slimcontext apply — 87% lighter" width="760">
</p>

That's a real run against a developer's actual `~/.claude/skills/` directory: **143 installed
skills, ≈236,772 tokens** of skill context. For a "build a React form" task, slimcontext keeps
the 12 that matter and parks the rest — **≈206,662 tokens lighter, every turn.**

## Why it exists

- **Context rot is real.** Every frontier model tested by Chroma in 2026 loses 30%+ accuracy at
  mid-window positions — well before the window is "full." Unused skill text isn't free; it
  actively degrades answers.
- **The discovery ceiling.** Past ~32 installed skills, Claude Code truncates even the skill
  *descriptions*. Native lazy skill-loading was requested ([claude-code#16160](https://github.com/anthropics/claude-code/issues/16160))
  and closed "not planned."
- **Skill libraries only grow.** Superpowers, GSD, marketplaces — the more you install, the more
  every turn costs, unless something prunes intelligently.

## Install

```bash
npm install -g slimcontext
```

Node 18+. No native modules, no model downloads, no API keys.

## Use it

### From inside Claude Code — `/slimcontext`

Run `slimcontext init` once, restart Claude Code, then type **`/slimcontext`** — an in-editor
menu to slim skills for the current task, restore everything, toggle the hook, or view savings.

### From the terminal

| Command | What it does |
|---|---|
| `slimcontext list` | Every skill you have and what it costs in tokens |
| `slimcontext score "<task>"` | Rank skills against a task — read-only, changes nothing |
| `slimcontext apply "<task>"` | Park irrelevant skills so your next session starts lean |
| `slimcontext restore` | Put every parked skill back |
| `slimcontext init` | Install the `/slimcontext` menu + advisory hook |
| `slimcontext enable` / `disable` | Toggle the advisory hook |
| `slimcontext stats` | The token-savings dashboard |

## How it works

slimcontext ranks skills with **BM25** — the same lexical ranking family Claude Code's own MCP
Tool Search uses — plus optional per-skill trigger rules. Deterministic, runs in milliseconds,
no GPU, and **nothing ever leaves your machine**.

- `score` — dry run; shows the ranking, changes nothing.
- `apply` — moves low-scoring **user** skills into `~/.slimcontext/parked/`. Project skills
  (a repo's `.claude/skills/`) are never touched. Fully reversible with `restore`.
- the hook — measures and advises on every prompt; logs telemetry to a greppable JSONL ledger.

### Optional: per-skill manifest

Drop a `slimcontext.yaml` into any skill directory to tune activation:

```yaml
alwaysLoad: false                 # true = always active, regardless of task
triggers:
  keywords: [kubernetes, helm, k8s]
  extensions: [tf, yaml]
dependsOn: [design-tokens]        # activate these whenever this skill activates
```

## Does it hurt answer quality?

Honest answer: **only if the wrong skills get dropped** — and the two modes differ sharply.

- **The advisory hook is quality-safe.** It never removes a skill — it only adds a short "these
  look relevant" note. Neutral worst-case; usually *helps* (a leaner context is a sharper one).
- **`apply` carries the real risk.** It physically parks skills. Guard rails: `topK` defaults to
  8, `minScore` defaults to 0 (only *zero*-scoring skills are parked), `alwaysLoad` pins
  must-haves, and `restore` is always one command away.

The v0.1 scorer is BM25 — excellent on keyword overlap, blind to synonyms. If a result looks
off after `apply`, `restore` and re-run with a higher `--top`. Semantic scoring lands in v0.2.

## How it compares

| | slimcontext | claude-skills-supercharged | Claude Code native |
|---|---|---|---|
| Skill relevance scoring | ✅ BM25 + triggers | ✅ LLM intent scoring | ⚠️ progressive disclosure only |
| Cost per prompt | **$0 (local)** | ~$1–2/mo (Haiku calls) | $0 |
| Token-savings dashboard | ✅ | ❌ | ❌ |
| Works offline / private | ✅ | ❌ | ✅ |

slimcontext deliberately does **not** touch MCP tool loading — Claude Code shipped native "MCP
Tool Search" in January 2026. This tool is about your *skills*.

## Roadmap

- **v0.2** — optional local embedding backend (MiniLM) for semantic scoring beyond keywords.
- **v0.2** — first-class adapters for Cline, opencode, Continue.dev, Aider.
- **v0.3** — `slimcontext watch`: re-stage automatically as the conversation topic shifts.

## Contributing

```bash
git clone <repo> && cd slimcontext
npm install && npm test     # 35 tests, no external dependencies
```

Issues and PRs welcome.

## License

MIT
