// run-cloudflare.js
process.env.GODEBUG = 'tlsmlkem=0';

const { spawn } = require('child_process');
const path = require('path');

const cloudflaredBin = path.join(__dirname, 'cloudflared.exe');

function startCloudflareTunnel() {
  console.log('🚀 Starting Cloudflare Tunnel (trycloudflare.com) on port 3000...');

  const cf = spawn(cloudflaredBin, [
    'tunnel',
    '--protocol', 'http2',
    '--url', 'http://127.0.0.1:3000'
  ]);

  let reportedUrl = null;

  function handleOutput(text) {
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && match[0] !== reportedUrl) {
      reportedUrl = match[0];
      console.log('\n========================================');
      console.log('🎉 CLOUDFLARE TUNNEL ONLINE!');
      console.log('👉 ' + reportedUrl);
      console.log('========================================\n');
    }
  }

  cf.stdout.on('data', data => {
    process.stdout.write(data);
    handleOutput(data.toString());
  });

  cf.stderr.on('data', data => {
    process.stderr.write(data);
    handleOutput(data.toString());
  });

  cf.on('close', code => {
    console.log(`Cloudflare tunnel closed with code ${code}. Reconnecting in 3s...`);
    setTimeout(startCloudflareTunnel, 3000);
  });
}

startCloudflareTunnel();
