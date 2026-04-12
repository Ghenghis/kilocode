# Troubleshooting - KiloCode Azure Voice Edition

## Connection Issues

### Red indicator: "Invalid subscription key"

- Verify the key in Azure Portal -> Speech resource -> Keys and Endpoint
- Check for leading/trailing whitespace in the key
- Ensure the key hasn't been regenerated (old keys are invalidated)
- Confirm you're using a Speech resource key, not a different Azure service key

### Red indicator: "Authentication failed" (403)

- Your Speech resource may lack TTS permissions
- Check the resource's access policies in Azure Portal
- Try regenerating the key

### Red indicator: Region mismatch

- The region in settings must match where you created the Speech resource
- `westus` is not the same as `westus2`
- Check Azure Portal -> Speech resource -> Overview for the exact region

### Yellow/spinning: Connection timeout

- Check internet connectivity
- Try loading https://portal.azure.com to verify Azure access
- Check if a firewall or proxy is blocking `*.tts.speech.microsoft.com`
- Connection timeout is 30 seconds -- wait before retrying

## Audio Issues

### No sound after clicking Play Preview

**Most likely cause**: VS Code webview autoplay policy.

The AudioContext must be resumed during a user gesture. Fix:
1. Click **Play Preview** once (this resumes the AudioContext)
2. If still silent, reload the window (`Ctrl+Shift+P` -> Reload Window)
3. Click Play Preview again after reload

**Other causes**:
- System volume is muted
- Wrong audio output device selected in OS
- Check Speech Log for error status

### Audio plays but sounds wrong

- Try a different voice -- some voices handle certain text patterns differently
- Check the volume slider in Speech Settings
- Verify the voice ID is valid (see [API.md](API.md) for the catalog)
- A response blob < 100 bytes means empty audio (bad voice ID or region)

### Auto-speak not working

- Confirm **Auto Speak** toggle is enabled
- Confirm **Enable Speech** toggle is enabled
- Check that the connection indicator is green
- Auto-speak only triggers on assistant replies during idle
- Check Speech Log to see if synthesis was attempted

## Build Issues

### VSIX is only 16 MB (should be ~75 MB)

The CLI binary is missing. You ran `node esbuild.js` directly instead of the full pipeline.

**Fix**:
```bash
cd packages/kilo-vscode
npm run package -- --no-dependencies     # full pipeline
npx @vscode/vsce package --no-dependencies
```

`npm run package` runs `prepare:cli-binary` before esbuild. Never skip it.

### Extension broken after install

1. Verify VSIX is ~75 MB
2. Run `code --install-extension kilo-code-7.2.1.vsix --force`
3. `Ctrl+Shift+P` -> **Reload Window** (required after install)
4. If still broken, uninstall, restart VS Code, reinstall

### TypeScript errors during build

```bash
cd packages/kilo-vscode
npm run package -- --no-dependencies
```

The `package` script runs typecheck before esbuild. Fix any TS errors before packaging.

## UI Issues

### Voice dropdown is empty

- Connection must be established first (green indicator)
- The voice list is hardcoded, not fetched from Azure -- this indicates a build or load error
- Check browser console in webview (Help -> Toggle Developer Tools -> Console)
- Look for import errors related to `azure-voices.ts`

### Settings not saving

- VS Code settings are saved automatically on change
- Check `settings.json` for `kilo-code.new.speech.*` entries
- Verify VS Code has write permissions to settings

### SpeechTab freezes or loops

Known Solid.js issue: `createEffect` reading `settings()` and calling `setSettings()` inside the same effect creates an infinite loop.

**Fix is in the code**: Uses `createMemo` to derive stable values. If you hit this after modifying code, ensure effects don't both read and write the same signal.

## Quota Issues

### "Rate limit exceeded" (429)

| Tier | Limit |
|------|-------|
| Free (F0) | 20 requests/minute |
| Standard (S0) | 100 requests/minute |

- Wait 60 seconds and retry
- Reduce auto-speak frequency for long conversations
- Upgrade to Standard tier for higher limits

### "Quota exceeded" (monthly limit)

- Free tier: 5M characters/month
- Check usage in Azure Portal -> Speech resource -> Metrics
- Upgrade to Standard ($1 per 1M characters) for unlimited usage

## Debug Steps

1. Open VS Code Developer Tools: `Help` -> `Toggle Developer Tools`
2. Check **Console** tab for errors prefixed with `[KiloCode]` or `[Speech]`
3. Check **Network** tab for failed requests to `*.tts.speech.microsoft.com`
4. Check the **Speech Log** in the KiloCode sidebar for synthesis status
5. Verify settings in `settings.json` match your Azure resource

## Getting Help

1. Check [Azure Speech Service status](https://status.azure.com/)
2. Review [Azure Speech documentation](https://learn.microsoft.com/azure/ai-services/speech-service/)
3. Open a GitHub issue at https://github.com/Ghenghis/Kilocode-Azure/issues with:
   - Error message from Speech Log
   - Connection indicator color
   - VS Code version
   - First 4 characters of your API key (for support identification)
   - Steps to reproduce
