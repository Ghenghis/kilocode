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

## Deliberately excluded providers

`ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are **not** prompted for. The cost-conscious default stack uses:

- DeepSeek
- Groq
- MiniMax
- SiliconFlow
- OpenRouter
- Ollama (local, no key)
- LM Studio (local, optional key)

If you ever want Anthropic/OpenAI on a per-task basis, set them through the KiloCode Providers tab — not in shell env.

## Variables managed by the script

| Category | Variables |
|---|---|
| Local | `LM_STUDIO_API_KEY`, `LITELLM_MASTER_KEY` |
| Provider | `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `MINIMAX_API_KEY`, `SILICONFLOW_API_KEY`, `OPENROUTER_API_KEY` |
| WebUI | `WEBUI_AGENT_TOKEN`, `WEBUI_SECRET_KEY`, `OPEN_WEBUI_SECRET_KEY` |
| Hermes | `HERMES_API_KEY`, `HERMES_MINIMAX_API_KEY` |
| VPS | `VPS_HOST`, `VPS_USER`, `SSH_KEY` |
| Shiba | `SHIBA_DB_URL` |
| Discord | `DISCORD_TOKEN_HERMES1` … `5`, `DISCORD_GUILD_ID` |

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
