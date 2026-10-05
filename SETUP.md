# CubeForge Setup Guide

## Quick Start

### 1. Use the Website

The website is already running. You can:
- Create an account
- Browse the dashboard
- Create servers

But to actually **start Minecraft servers**, you need the Node Agent running on your computer.

### 2. Install Java

Minecraft 1.20.5 through 1.21.x require Java 21. Minecraft 26.1 requires Java 25. Java 21 can run many older versions, but older Forge or modded servers may require their original Java version.

**Download free from:** https://adoptium.net/

Install Java 21 for Minecraft 1.20.5 through 1.21.x, or Java 25 for Minecraft 26.1. Verify it works:
```
java -version
```

### 3. Set Up the Node Agent

The Node Agent is a small program that runs Minecraft server processes on your computer.

Extract the node agent zip into a FOLDER
Run start-windows.bat (Windows) or run start-mac-linux.sh (Mac/Linux). The launcher auto-installs everything and starts the agent. (ADMIN MODE)

Keep the window open while you play. That's it — your computer is now connected!
You should see:
```
╔══════════════════════════════════════════╗
║       CubeForge Node Agent v1.0          ║
╚══════════════════════════════════════════╝
[INFO] Java version: 17.0.x
[INFO] Local IP: 192.168.x.x
[SUCCESS] Node registered!
[INFO] CubeForge is now connected.
```

### 4. Create and Start a Server

1. Go to the website dashboard
2. Click "Create Server"
3. Follow the wizard (name, edition, version, software, resources)
4. Accept the Minecraft EULA
5. Click "Create Server"
6. In the server panel, click "Start"
7. The node agent will download the server jar and start it
8. Watch the live console for "Done!" — that means it's ready

### 5. Connect to Your Server

Open Minecraft, go to:
- Multiplayer > Add Server
- Enter the address shown in the dashboard (e.g., `192.168.1.100:25565`)
- Click "Join Server"

For **just you**: connect to `localhost:25565` (or the address shown).

### 6. Let Friends Join From Other Networks

You need port forwarding so people outside your home can reach your server.

#### Option A: Port Forwarding (free, requires router access)

1. Find your computer's local IP (shown by the node agent)
2. Log into your router (usually `192.168.1.1` or `10.0.0.1`)
3. Find "Port Forwarding" or "Virtual Server"
4. Add a rule:
   - External port: `25565` (or your server's port)
   - Internal port: `25565`
   - Protocol: TCP (Java) or UDP (Bedrock)
   - Internal IP: your computer's local IP
5. Save and apply
6. Find your public IP: search "what is my IP" on Google
7. Share `your-public-ip:25565` with friends

#### Option B: Cloudflare Tunnel (free, no router config)

1. Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Run: `cloudflared tunnel --url tcp://localhost:25565`
3. You'll get a URL like `tcp://random-words-xxxx.trycloudflare.com:25565`
4. Share that address with friends

#### Option C: ngrok (free tier)

1. Install ngrok: https://ngrok.com/
2. Run: `ngrok tcp 25565`
3. Copy the forwarding address
4. Share with friends

### Supported Server Software

| Software | Auto-Download | Notes |
|----------|--------------|-------|
| Vanilla | Yes | From Mojang's official servers |
| Paper | Yes | From PaperMC API |
| Purpur | Yes | From Purpur API |
| Fabric | Yes | Uses Fabric installer |
| Forge | Manual | Download installer, run in server dir |
| NeoForge | Manual | Download installer, run in server dir |
| Bedrock | Manual | Download from minecraft.net |
| Spigot | Manual | Build with BuildTools |

### Troubleshooting

**"No compute node connected"**
- The node agent isn't running. Start it with `npm start` in the node-agent folder.

**Server stays "Starting" forever**
- Check the node agent console for errors
- Make sure Java is installed and in your PATH
- Check that the port isn't already in use

**Can't connect to server**
- Make sure the server shows "Online" in the dashboard
- For local play: use `localhost:port`
- For remote play: set up port forwarding or a tunnel

**Download failed**
- Check your internet connection
- Some versions/software may not be available yet
- Forge and Bedrock require manual download

### File Locations

- Server files: `~/.cubeforge/servers/<server-id>/`
- Server JAR: `~/.cubeforge/servers/<server-id>/server.jar`
- World data: `~/.cubeforge/servers/<server-id>/world/`
- Config: `~/.cubeforge/servers/<server-id>/server.properties`
