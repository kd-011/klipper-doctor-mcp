# Setting it up in other clients

Every client starts the server for you over stdio. The command is `npx -y klipper-doctor-mcp` once the package is on npm. Until then, use the GitHub form shown below.

I ran the server from a real MCP client only in Claude Code. The Claude Desktop and Cursor snippets use the same stdio launch those clients document, but I have not run them.

## Claude Code

```sh
claude mcp add klipper-doctor -- npx -y github:kd-011/klipper-doctor-mcp
# with a printer on your network:
claude mcp add klipper-doctor -e MOONRAKER_URL=http://printer.local:7125 -- npx -y github:kd-011/klipper-doctor-mcp
```

## Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "klipper-doctor": {
      "command": "npx",
      "args": ["-y", "github:kd-011/klipper-doctor-mcp"],
      "env": { "MOONRAKER_URL": "http://printer.local:7125" }
    }
  }
}
```

## Cursor

`.cursor/mcp.json` in a project, or `~/.cursor/mcp.json` for all projects:

```json
{
  "mcpServers": {
    "klipper-doctor": {
      "command": "npx",
      "args": ["-y", "github:kd-011/klipper-doctor-mcp"],
      "env": { "MOONRAKER_URL": "http://printer.local:7125" }
    }
  }
}
```

`MOONRAKER_URL` is optional in all of these. Without it you can still hand the server a log as a path or as pasted text.

## From a clone

```sh
git clone https://github.com/kd-011/klipper-doctor-mcp
cd klipper-doctor-mcp
npm ci
claude mcp add klipper-doctor -- node "$PWD/dist/cli.js"
```
