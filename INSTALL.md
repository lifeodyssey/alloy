# OpenCode Alloy Install

## Quick install

```bash
curl -fsSL https://raw.githubusercontent.com/lifeodyssey/opencode-team-config/main/install.sh | bash
```

The installer checks Node.js 20+, Bun 1.1+, Git, and curl; installs the Alloy CLI at `~/.local/bin/alloy`; runs `alloy install --target global`; writes `~/.config/alloy/state.json`; and installs shell completion.

Compatibility status: tested locally on macOS. Ubuntu 22.04 support is best effort until the installer is run in a Linux container.

## Shell completion

`install.sh` installs bash, zsh, and fish completion files automatically. To refresh completion manually:

```bash
mkdir -p ~/.zsh/completions
alloy completion zsh > ~/.zsh/completions/_alloy
```

```bash
mkdir -p ~/.bash_completion.d
alloy completion bash > ~/.bash_completion.d/alloy
```

```bash
mkdir -p ~/.config/fish/completions
alloy completion fish > ~/.config/fish/completions/alloy.fish
```

For zsh, make sure the completion directory is on `fpath`:

```zsh
fpath=("$HOME/.zsh/completions" $fpath)
autoload -Uz compinit
compinit
```

For bash, source the generated file from `~/.bashrc`:

```bash
[ -f "$HOME/.bash_completion.d/alloy" ] && . "$HOME/.bash_completion.d/alloy"
```

## Reinstall or project-local install

Fresh machine install:

```bash
bash install.sh
```

Reinstall the global OpenCode config after Alloy is already on PATH:

```bash
alloy install --target global --pack core
```

Install Alloy into the current repo instead of the global OpenCode config:

```bash
alloy install --target local --pack core
```

`setup.sh` remains as a deprecated compatibility shim:

```bash
bash setup.sh --pack core --target local
```

## Troubleshooting

### Missing Bun

Alloy requires Bun 1.1+ because OpenCode loads Alloy's local plugin dependencies through the generated `.opencode/package.json`.

```bash
bun --version
```

Install or upgrade Bun, then rerun `bash install.sh`.

### PATH not updated

The installer writes the CLI to `~/.local/bin/alloy` and appends `~/.local/bin` to `~/.zshrc` and `~/.bashrc` when needed. For the current terminal:

```bash
export PATH="$HOME/.local/bin:$PATH"
alloy --version
```

Open a new terminal after install so your shell reloads its startup file.

### Permission errors

The installer only writes under your home directory:

- `~/.local/share/alloy/opencode-team-config`
- `~/.local/bin/alloy`
- `~/.config/opencode`
- `~/.config/alloy/state.json`
- shell completion files under `~/.bash_completion.d`, `~/.zsh/completions`, and `~/.config/fish/completions`

If any of those paths are owned by another user, fix ownership before rerunning the installer.
