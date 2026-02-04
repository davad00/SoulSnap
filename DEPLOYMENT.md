# Deploy to Koyeb

## Prerequisites
- A Koyeb account (sign up at https://koyeb.com)
- Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### Option 1: Deploy from GitHub (Recommended)

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Deploy on Koyeb**
   - Go to https://app.koyeb.com
   - Click "Create App"
   - Select "GitHub" as the deployment method
   - Connect your GitHub account and select your repository
   - Configure the service:
     - **Builder**: Docker
     - **Dockerfile**: `Dockerfile` (default)
     - **Port**: 3001
     - **Instance type**: Nano (or higher for better performance)
     - **Region**: Choose closest to your users
   - Click "Deploy"

3. **Access your app**
   - Koyeb will provide a URL like: `https://your-app-name.koyeb.app`
   - The app serves both the frontend and backend on the same domain

### Option 2: Deploy using Koyeb CLI

1. **Install Koyeb CLI**
   ```bash
   npm install -g @koyeb/koyeb-cli
   ```

2. **Login to Koyeb**
   ```bash
   koyeb login
   ```

3. **Deploy**
   ```bash
   koyeb app create soulsnap \
     --git github.com/your-username/your-repo \
     --git-branch main \
     --docker \
     --ports 3001:http \
     --routes /:3001 \
     --instance-type nano
   ```

## Environment Variables

The app auto-detects the server URL, so no environment variables are needed for basic deployment.

If you need to customize:
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Set to "production" for production builds

## Post-Deployment

1. **Test the deployment**
   - Visit your Koyeb URL
   - Create a room
   - Open the same room in another tab/device
   - Test camera and background removal

2. **Monitor logs**
   - Go to Koyeb dashboard
   - Select your app
   - Click "Logs" to see real-time logs

## Troubleshooting

### WebRTC not working
- Koyeb provides HTTPS by default, which is required for WebRTC
- Make sure both users are on the same room ID

### Camera not accessible
- Ensure you're using HTTPS (Koyeb provides this automatically)
- Grant camera permissions in your browser

### Build fails
- Check the build logs in Koyeb dashboard
- Ensure all dependencies are in package.json
- Verify Dockerfile syntax

## Scaling

To handle more users:
1. Go to Koyeb dashboard
2. Select your app
3. Click "Scale"
4. Choose a larger instance type (Small, Medium, etc.)

## Custom Domain

1. Go to Koyeb dashboard
2. Select your app
3. Click "Domains"
4. Add your custom domain
5. Update DNS records as instructed
