// run-tunnel.js
const { spawn } = require('child_process');

function startTunnel() {
  console.log('Starting Pinggy HTTPS Tunnel on port 3000...');

  const ssh = spawn('ssh', [
    '-tt',
    '-p', '443',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-R', '0:127.0.0.1:3000',
    'qr@free.pinggy.io'
  ]);

  let reported = false;

  ssh.stdout.on('data', (data) => {
    const text = data.toString();
    const urls = text.match(/https:\/\/[a-zA-Z0-9.-]+\.(?:pinggy-free\.link|pinggy\.net|pinggy\.link)/g);
    if (urls && !reported) {
      reported = true;
      console.log('\n========================================');
      console.log('🚀 GAME IS LIVE ONLINE!');
      [...new Set(urls)].forEach(u => console.log('👉 ' + u));
      console.log('========================================\n');
    }
  });

  ssh.on('close', (code) => {
    console.log(`Tunnel closed (code ${code}). Reconnecting in 3s...`);
    setTimeout(startTunnel, 3000);
  });
}

startTunnel();

