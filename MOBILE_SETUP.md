# Mobile Camera Access Setup

Mobile browsers require HTTPS for camera access. Here are your options:

## Option 1: Use ngrok (Easiest for testing)

1. Install ngrok: https://ngrok.com/download
2. Start your app: `bun dev`
3. In another terminal: `ngrok http 3000`
4. Use the https URL ngrok provides on your phone

## Option 2: Local HTTPS with mkcert (Best for development)

1. Install mkcert:
   ```bash
   # Windows (with Chocolatey)
   choco install mkcert
   
   # Or download from: https://github.com/FiloSottile/mkcert/releases
   ```

2. Create local certificates:
   ```bash
   cd client
   mkcert -install
   mkcert localhost 127.0.0.1 ::1 192.168.1.* YOUR_LOCAL_IP
   ```

3. This creates `localhost.pem` and `localhost-key.pem`

4. Start with HTTPS:
   ```bash
   HTTPS=true bun dev
   ```

5. Find your local IP:
   ```bash
   ipconfig  # Windows
   ```

6. Access from phone: `https://YOUR_LOCAL_IP:3000`

## Option 3: Cloudflare Tunnel (Free, no installation)

1. Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/
2. Run: `cloudflared tunnel --url http://localhost:3000`
3. Use the provided https URL on your phone

## Quick Test (Desktop Only)

For desktop testing, just use: `http://localhost:3000`
Camera works fine on localhost without HTTPS.
