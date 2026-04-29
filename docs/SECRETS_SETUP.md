# Secrets Setup — Windows Environment Variables

KiloCode/contract-kit secrets live as **Windows User environment variables**, not in `.env` files. This means:

- Real values are never committed to git
- Survive reboot, available to all your terminals + VS Code + services
- Set once, used everywhere
- No file to accidentally check in

## One-time setup

```powershell
pwsh scripts\setup-windows-env.ps1
```

The script prompts for each secret with `Read-Host -AsSecureString`:
- Input is never echoed to the screen
- Never written to terminal history
- Never logged
- Set at User level — no admin/elevation needed

Press Enter on any prompt to skip that variable (keeps existing value if already set).

## Listing what's set

```powershell
pwsh scripts\setup-windows-env.ps1 -List
```

Shows which variables are set or unset. Values are never displayed.

## Updating a value (e.g., after a token rotation)

Re-run the script. For each variable that's already set, it asks "Overwrite? (y/N)" — answer `y` to update.

```powershell
pwsh scripts\setup-windows-env.ps1
# Or to overwrite without confirmation:
pwsh scripts\setup-windows-env.ps1 -Force
```

## Removing a value

```powershell
[Environment]::SetEnvironmentVariable('VARIABLE_NAME', $null, 'User')
```

## Provider policy: open-source / local-first by default

The default stack is **open-source / local-first** — no paid SaaS API keys are prompted for unless you explicitly opt in.

**Default (no flags):** prompts for local + your-own-infra tokens only.

**Opt in to paid SaaS:** `pwsh scripts\setup-windows-env.ps1 -IncludePaid` — adds prompts for DeepSeek, Groq, MiniMax, SiliconFlow, OpenRouter.

`ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are permanently excluded even from the paid prompt list (cost policy). If you ever want them, set via `[Environment]::SetEnvironmentVariable(...)` directly or through the KiloCode Providers tab.

## Two scripts, two purposes

### 1. Auto-generate self-issued secrets

Some env vars are **shared secrets between your own services** (no external provider gives you the value — you generate it). Examples: `HERMES_API_KEY` (between VS Code and your Hermes Bridge), `LITELLM_MASTER_KEY`, `WEBUI_*`, `SHIBA_KEY`.

```powershell
pwsh scripts\generate-self-issued-tokens.ps1
```

- Generates 256-bit cryptographic random hex (32 bytes) for each
- Sets as Windows User env vars
- Skips already-set values (use `-Force` to rotate)
- Never displays values
- `-List` shows which are set/unset

### 2. Prompt for service-issued / user-provided values

```powershell
pwsh scripts\setup-windows-env.ps1                   # default: local + own-infra
pwsh scripts\setup-windows-env.ps1 -IncludePaid      # also paid SaaS
pwsh scripts\setup-windows-env.ps1 -List             # show what's set
```

### 3. Or run both via the bootstrap

```powershell
pwsh scripts\bootstrap.ps1                       # generate + prompt + install VSIX
pwsh scripts\bootstrap.ps1 -IncludePaid          # same plus paid SaaS prompts
pwsh scripts\bootstrap.ps1 -Force                # rotate all generated; overwrite all prompted
```

## Variables managed by these scripts

### Auto-generated (`generate-self-issued-tokens.ps1`)

| Variable | Purpose |
|---|---|
| `HERMES_API_KEY` | Auth between VS Code extension and your Hermes Bridge |
| `LITELLM_MASTER_KEY` | LiteLLM proxy auth |
| `WEBUI_AGENT_TOKEN` | WebUI agent auth |
| `WEBUI_SECRET_KEY` | WebUI session signing |
| `OPEN_WEBUI_SECRET_KEY` | Open WebUI secret |
| `SHIBA_KEY` | Shiba Gateway X-Shiba-Key (must match server config) |

⚠️ If your Hermes / WebUI / Shiba services are already running with different values for these, restart them with the new values OR they will reject auth (401).

### Prompted — open-source / your-infra (`setup-windows-env.ps1` default)

| Category | Variables |
|---|---|
| Local | `LM_STUDIO_API_KEY` |
| VPS | `VPS_HOST`, `VPS_USER`, `SSH_KEY` |
| Shiba | `SHIBA_DB_URL` (output of `_vps_provision_postgres.sh`) |
| Discord | `DISCORD_TOKEN_HERMES1` … `5`, `DISCORD_GUILD_ID` |

### Prompted — paid SaaS (`setup-windows-env.ps1 -IncludePaid` only)

| Category | Variables |
|---|---|
| Paid | `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `MINIMAX_API_KEY`, `HERMES_MINIMAX_API_KEY`, `SILICONFLOW_API_KEY`, `OPENROUTER_API_KEY` |

## How the apps consume these

| Stack | Reads env from |
|---|---|
| Node.js / TypeScript | `process.env.VAR_NAME` |
| Python | `os.environ['VAR_NAME']` or `os.getenv(...)` |
| Docker compose | `${VAR_NAME}` interpolation in `docker-compose.yml` |
| Systemd | `Environment=VAR_NAME=...` (or use `EnvironmentFile=`) |

VS Code inherits the user environment when launched normally. If you launch VS Code from a terminal that opened *before* you set new vars, restart the terminal first.

## Troubleshooting

**Q: I set a variable but VS Code still says it's missing.**
A: Restart VS Code. Already-running processes keep their snapshot of env at launch.

**Q: I want to use these from a non-PowerShell terminal (bash, cmd).**
A: User-level env vars are visible to all child processes regardless of shell. Just open a new terminal.

**Q: Are these values stored encrypted?**
A: Windows stores User env vars in the registry (`HKEY_CURRENT_USER\Environment`). They are protected by your Windows account credentials but are NOT encrypted at rest. If your account is compromised, they're readable. For higher security, use Windows Credential Manager (out of scope here).

**Q: Can I sync these across machines?**
A: Not automatically. On a new machine, run the script again or export-import via a tool like `chezmoi` / `1Password CLI`. Never sync via plaintext file.

## Pre-commit / pre-push secret scanning (recommended)

Install `gitleaks` to catch any accidental secret commit:

```powershell
choco install gitleaks
# or
scoop install gitleaks
```

Then add to `.husky/pre-push`:

```bash
gitleaks detect --no-banner --redact --log-opts="origin/$(git rev-parse --abbrev-ref HEAD)..HEAD"
```

This scans all commits being pushed. If a secret is detected, push aborts.
