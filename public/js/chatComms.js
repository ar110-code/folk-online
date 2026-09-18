// public/js/chatComms.js
// Dynamic Channel Tabs, Isolated Real-time Chat & VoIP Comms

let activeChannelId = null;
let currentChannels = [];
let localMessages = [];

// Prevent any accidental form submit anywhere on the page from triggering a browser reload
window.addEventListener('submit', (e) => {
  e.preventDefault();
  return false;
}, true);

function initChatComms() {
  setupChatForm();
  refreshChannels();
  initVoiceComms();

  // Resume AudioContext on any user gesture to satisfy browser autoplay policies
  const resumeAudio = () => {
    if (rxAudioCtx && rxAudioCtx.state === 'suspended') {
      rxAudioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener('click', resumeAudio, { passive: true });
  window.addEventListener('keydown', resumeAudio, { passive: true });
  window.addEventListener('touchstart', resumeAudio, { passive: true });

  socket.off('new_message');
  socket.on('new_message', msg => {
    const isAccessible = currentChannels.some(c => c.id === msg.channelId);
    if (isAccessible) {
      localMessages.push(msg);
      renderChatMessages();
      if (msg.channelId !== activeChannelId && msg.senderName !== myPlayer.username) {
        const ch = currentChannels.find(c => c.id === msg.channelId);
        showToast(`💬 پیام جدید در [${ch ? ch.name : 'کانال دیگر'}] از ${msg.senderName}`, 'info');
      }
      if (msg.senderName !== myPlayer.username) {
        const commsPanel = document.querySelector('.comms-panel');
        if (commsPanel && commsPanel.classList.contains('collapsed')) {
          const unreadDot = document.getElementById('comms-unread-dot');
          if (unreadDot) unreadDot.classList.remove('hidden');
          const dockUnreadDot = document.getElementById('dock-unread-dot');
          if (dockUnreadDot) dockUnreadDot.classList.remove('hidden');
        }
      }
    }
  });

  socket.off('direct_line_incoming');
  socket.on('direct_line_incoming', data => {
    handleDirectLineIncoming(data);
  });
}

function refreshChannels() {
  if (!myPlayer.countryId || !myPlayer.role) return;

  socket.emit('get_channels', {
    countryId: myPlayer.countryId,
    role: myPlayer.role
  }, res => {
    if (!res || !res.channels) return;
    currentChannels = res.channels;
    localMessages = res.messages || [];

    if (!activeChannelId || !currentChannels.some(c => c.id === activeChannelId)) {
      const internalChannel = currentChannels.find(c => c.id.startsWith('internal_') || c.id.startsWith('team_'));
      const defaultId = internalChannel ? internalChannel.id : (currentChannels[0] ? currentChannels[0].id : null);
      switchChannel(defaultId);
    } else {
      switchChannel(activeChannelId);
    }

    renderChannelTabs();
    updateVoiceAudienceSelect();
    renderChatMessages();
  });
}

function updateVoiceAudienceSelect() {
  const select = document.getElementById('voice-audience-select');
  if (!select) return;
  select.innerHTML = '';

  currentChannels.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === activeChannelId) opt.selected = true;
    select.appendChild(opt);
  });

  select.onchange = (e) => {
    switchChannel(e.target.value);
  };
}

let ringingChannelIds = new Set();
let activeDirectLineAlertTimeout = null;

function playDirectLineRingtone() {
  try {
    const ctx = ensureRxAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    // Dual-frequency diplomatic phone chime (520Hz & 650Hz, two bursts)
    [520, 650].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      // Burst 1
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.05);
      gain.gain.setValueAtTime(0.14, now + 0.3);
      gain.gain.linearRampToValueAtTime(0, now + 0.35);

      // Burst 2
      gain.gain.setValueAtTime(0, now + 0.45);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.5);
      gain.gain.setValueAtTime(0.14, now + 0.75);
      gain.gain.linearRampToValueAtTime(0, now + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.85);
    });
  } catch (err) {
    console.error('Direct line ringtone error:', err);
  }
}

function handleDirectLineIncoming(data) {
  if (!data || !data.channelId) return;

  // Strict check: only process if this channel is in my accessible channels
  if (!currentChannels || !currentChannels.some(c => c.id === data.channelId)) {
    return;
  }

  // If already in this channel, don't interrupt with call popup
  if (activeChannelId === data.channelId) {
    showToast(`🟢 ${data.callerRoleName} ${data.callerName} (${data.callerCountryName}) هم‌اکنون در این خط مستقیم حضور دارد.`, 'info');
    return;
  }

  // 1. Play auditory telephone chime
  playDirectLineRingtone();

  // 2. Mark channel tab as ringing
  ringingChannelIds.add(data.channelId);
  renderChannelTabs();

  // 3. Highlight comms sidebar dock unread indicators if collapsed
  const commsPanel = document.querySelector('.comms-panel');
  if (commsPanel && commsPanel.classList.contains('collapsed')) {
    const unreadDot = document.getElementById('comms-unread-dot');
    if (unreadDot) unreadDot.classList.remove('hidden');
    const dockUnreadDot = document.getElementById('dock-unread-dot');
    if (dockUnreadDot) dockUnreadDot.classList.remove('hidden');
  }

  // 4. Show Toast notification
  showToast(`📞 تماس مستقیم ورودی: ${data.callerRoleName} ${data.callerName} (${data.callerCountryName})`, 'warning');

  // 5. Render floating interactive banner
  const container = document.getElementById('direct-line-alert-container');
  if (container) {
    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="direct-line-alert-card" id="alert-card-${data.channelId}">
        <div class="direct-line-pulse-avatar" style="border-color: ${data.callerCountryColor}; background: ${data.callerCountryColor}22;">
          📞
        </div>
        <div class="direct-line-alert-body">
          <div class="direct-line-alert-title">
            <span>📞 اتصال خط مستقیم ورودی</span>
            <span style="font-size: 0.72rem; color: #94a3b8; font-weight: normal;">(${data.timestamp})</span>
          </div>
          <div class="direct-line-alert-desc">
            <strong style="color: ${data.callerCountryColor};">[${data.callerCountryName}] ${data.callerRoleName} ${data.callerName}</strong>
            به خط مستقیم شما متصل شد و منتظر پاسخ است.
          </div>
        </div>
        <div class="direct-line-alert-actions">
          <button type="button" class="btn btn-success btn-answer-direct" id="btn-answer-${data.channelId}">
            اتصال به مکالمه 🎧
          </button>
          <button type="button" class="btn btn-secondary btn-dismiss-direct" id="btn-dismiss-${data.channelId}">
            بستن ✕
          </button>
        </div>
      </div>
    `;

    const answerBtn = document.getElementById(`btn-answer-${data.channelId}`);
    if (answerBtn) {
      answerBtn.onclick = () => {
        // Un-collapse comms panel if collapsed
        if (typeof window.toggleCommsSidebar === 'function') {
          window.toggleCommsSidebar(true);
        }
        ringingChannelIds.delete(data.channelId);
        switchChannel(data.channelId);
        showToast(`🟢 شما به خط مستقیم با ${data.callerName} متصل شدید.`, 'success');
        dismissDirectLineAlert(data.channelId);
      };
    }

    const dismissBtn = document.getElementById(`btn-dismiss-${data.channelId}`);
    if (dismissBtn) {
      dismissBtn.onclick = () => {
        dismissDirectLineAlert(data.channelId);
      };
    }

    clearTimeout(activeDirectLineAlertTimeout);
    activeDirectLineAlertTimeout = setTimeout(() => {
      dismissDirectLineAlert(data.channelId);
    }, 25000);
  }
}

function dismissDirectLineAlert(channelId) {
  const card = document.getElementById(`alert-card-${channelId}`);
  if (card) {
    card.style.opacity = '0';
    card.style.transform = 'translateY(-15px)';
    setTimeout(() => {
      card.remove();
      const container = document.getElementById('direct-line-alert-container');
      if (container && container.children.length === 0) {
        container.classList.add('hidden');
      }
    }, 300);
  }
}

function switchChannel(newChannelId) {
  if (!newChannelId) return;

  if (currentRoom && activeChannelId && activeChannelId !== newChannelId) {
    socket.emit('leave_voice', { roomCode: currentRoom.roomCode, channelId: activeChannelId });
  }

  activeChannelId = newChannelId;
  ringingChannelIds.delete(newChannelId);
  dismissDirectLineAlert(newChannelId);

  if (currentRoom && activeChannelId) {
    socket.emit('join_voice', { roomCode: currentRoom.roomCode, channelId: activeChannelId });
    socket.emit('set_voice_channel', { channelId: activeChannelId });

    // If switching to a direct/bilateral line, notify counterpart!
    if (activeChannelId.startsWith('pres_secret_') || activeChannelId.startsWith('war_secret_') || activeChannelId.startsWith('trade_secret_') || activeChannelId.startsWith('internal_')) {
      socket.emit('direct_line_connect', { roomCode: currentRoom.roomCode, channelId: activeChannelId });
    }
  }

  const currentChan = currentChannels.find(c => c.id === activeChannelId);
  const voiceLabel = document.getElementById('active-voice-channel-name');
  if (voiceLabel) {
    voiceLabel.textContent = `🟢 کانال فعال: ${currentChan ? currentChan.name : 'اتصال خودکار'}`;
  }

  const select = document.getElementById('voice-audience-select');
  if (select && select.value !== activeChannelId) {
    select.value = activeChannelId;
  }

  renderChannelTabs();
  renderChatMessages();
}

function renderChannelTabs() {
  const container = document.getElementById('channel-tabs');
  if (!container) return;
  container.innerHTML = '';

  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('btn-send-chat');

  if (currentChannels.length === 0) {
    const emptySpan = document.createElement('span');
    emptySpan.style.cssText = 'color: #f87171; font-size: 0.8rem; padding: 6px 10px; font-weight: bold; display: block;';
    emptySpan.textContent = '❌ این تیم از بازی حذف شده است و قابلیت مکالمه ندارد.';
    container.appendChild(emptySpan);
    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    return;
  }

  if (input) input.disabled = false;
  if (sendBtn) sendBtn.disabled = false;

  currentChannels.forEach(c => {
    const isRinging = ringingChannelIds.has(c.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tab-btn ${c.id === activeChannelId ? 'active' : ''} ${isRinging ? 'tab-ringing' : ''}`;
    btn.textContent = isRinging ? `📞 ${c.name} (تماس...)` : c.name;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      ringingChannelIds.delete(c.id);
      switchChannel(c.id);
    });
    container.appendChild(btn);
  });
}

function renderChatMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  container.innerHTML = '';

  const filtered = localMessages.filter(m => m.channelId === activeChannelId);

  filtered.forEach(m => {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    bubble.innerHTML = `
      <div class="bubble-meta">
        <span class="bubble-sender" style="color: ${COUNTRY_COLORS[m.senderCountry] || '#60a5fa'}">
          [${m.senderCountry}] ${m.senderName} (${ROLE_NAMES[m.senderRole] || m.senderRole})
        </span>
        <span class="bubble-time">${m.timestamp}</span>
      </div>
      <div class="bubble-text">${escapeHtml(m.text)}</div>
    `;

    container.appendChild(bubble);
  });

  container.scrollTop = container.scrollHeight;
}

function setupChatForm() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('btn-chat-send');

  function sendMessage(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    const text = input ? input.value.trim() : '';
    if (!text || !activeChannelId) return false;

    socket.emit('send_message', {
      senderCountry: myPlayer.countryId,
      senderRole: myPlayer.role,
      senderName: myPlayer.username,
      channelId: activeChannelId,
      text
    }, res => {
      if (res && res.success) {
        if (input) input.value = '';
      } else if (res && res.error) {
        showToast(res.error, 'error');
      }
    });

    return false;
  }

  if (sendBtn) {
    sendBtn.onclick = sendMessage;
  }

  if (form) {
    form.onsubmit = sendMessage;
  }

  if (input) {
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        sendMessage(e);
        return false;
      }
    };
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================
// PCM Real-Time Voice Streaming via Socket.io
// ==========================================
let rxAudioCtx = null;
let nextPlayTime = 0;
let txAudioCtx = null;
let micStream = null;
let scriptProcessor = null;
let isMicActive = false;
let incomingVoiceTimer = null;

function ensureRxAudioContext(targetSampleRate) {
  if (!rxAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    rxAudioCtx = new AudioContextClass();
  }
  if (rxAudioCtx.state === 'suspended') {
    rxAudioCtx.resume().catch(() => {});
  }
  return rxAudioCtx;
}

function playIncomingPCM(base64Data, sampleRate, senderName) {
  try {
    const ctx = ensureRxAudioContext(sampleRate);
    if (!ctx) return;

    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const sRate = sampleRate || ctx.sampleRate || 44100;
    const audioBuffer = ctx.createBuffer(1, float32.length, sRate);
    audioBuffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const playTime = Math.max(now, nextPlayTime);
    source.start(playTime);
    nextPlayTime = playTime + audioBuffer.duration;

    // Show visual incoming voice indicator
    const voiceStatus = document.getElementById('voice-status');
    const voiceIndicator = document.getElementById('voice-indicator');
    if (voiceStatus && !isMicActive) {
      voiceStatus.textContent = `🔊 صدای ${senderName || 'هم‌تیمی'}`;
      voiceStatus.style.color = '#38bdf8';
    }
    if (voiceIndicator && !isMicActive) {
      voiceIndicator.style.background = '#38bdf8';
      voiceIndicator.style.boxShadow = '0 0 10px #38bdf8';
    }

    clearTimeout(incomingVoiceTimer);
    incomingVoiceTimer = setTimeout(() => {
      if (!isMicActive) {
        if (voiceStatus) {
          voiceStatus.textContent = 'میکروفون قطع';
          voiceStatus.style.color = '#94a3b8';
        }
        if (voiceIndicator) {
          voiceIndicator.style.background = '#475569';
          voiceIndicator.style.boxShadow = 'none';
        }
      }
    }, 1200);

  } catch (err) {
    console.error('PCM playback error:', err);
  }
}

function stopMicrophone() {
  isMicActive = false;
  if (scriptProcessor) {
    try { scriptProcessor.disconnect(); } catch (e) {}
    scriptProcessor = null;
  }
  if (micStream) {
    try { micStream.getTracks().forEach(t => t.stop()); } catch (e) {}
    micStream = null;
  }
  if (txAudioCtx) {
    try { txAudioCtx.close(); } catch (e) {}
    txAudioCtx = null;
  }
}

function initVoiceComms() {
  const btnToggleMic = document.getElementById('btn-toggle-mic');
  const voiceStatus = document.getElementById('voice-status');
  const voiceIndicator = document.getElementById('voice-indicator');

  if (!btnToggleMic) return;

  // Listen for incoming audio from others
  socket.off('voice_audio');
  socket.on('voice_audio', ({ senderSocketId, senderName, channelId, sampleRate, audioData }) => {
    if (senderSocketId === socket.id) return;
    // Play if message is in current active channel
    if (!channelId || channelId === activeChannelId) {
      playIncomingPCM(audioData, sampleRate, senderName);
    }
  });

  btnToggleMic.onclick = async () => {
    if (!isMicActive) {
      try {
        ensureRxAudioContext();

        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        txAudioCtx = new AudioContextClass();
        if (txAudioCtx.state === 'suspended') await txAudioCtx.resume();

        const source = txAudioCtx.createMediaStreamSource(micStream);
        // Buffer size 2048 provides low latency ~40ms
        scriptProcessor = txAudioCtx.createScriptProcessor(2048, 1, 1);

        scriptProcessor.onaudioprocess = (e) => {
          if (!isMicActive) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(input.length);
          let sum = 0;
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            sum += Math.abs(s);
          }
          const avg = sum / input.length;

          // Sensitive audio threshold for human voice
          const isSpeaking = avg > 0.003;

          if (voiceIndicator) {
            voiceIndicator.style.background = isSpeaking ? '#10b981' : '#f59e0b';
            voiceIndicator.style.boxShadow = isSpeaking ? '0 0 10px #10b981' : 'none';
          }

          if (isSpeaking && currentRoom && activeChannelId) {
            const bytes = new Uint8Array(pcm.buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            socket.emit('voice_audio', {
              roomCode: currentRoom.roomCode,
              channelId: activeChannelId,
              sampleRate: txAudioCtx.sampleRate,
              audioData: base64
            });
          }
        };

        source.connect(scriptProcessor);
        scriptProcessor.connect(txAudioCtx.destination);

        isMicActive = true;
        btnToggleMic.className = 'btn btn-danger';
        btnToggleMic.innerHTML = '🔇 قطع میکروفون';
        if (voiceStatus) {
          voiceStatus.textContent = '🟢 صدای شما متصل است';
          voiceStatus.style.color = '#34d399';
        }
        showToast('میکروفون فعال شد. صدای شما برای حاضرین در این کانال پخش می‌شود.', 'success');
      } catch (err) {
        console.error('Microphone error:', err);
        showToast('خطا: دسترسی به میکروفون داده نشد یا دستگاه یافت نشد.', 'error');
      }
    } else {
      stopMicrophone();
      btnToggleMic.className = 'btn btn-secondary';
      btnToggleMic.innerHTML = '🎤 وصل میکروفون';
      if (voiceStatus) {
        voiceStatus.textContent = 'میکروفون قطع';
        voiceStatus.style.color = '#94a3b8';
      }
      if (voiceIndicator) {
        voiceIndicator.style.background = '#475569';
        voiceIndicator.style.boxShadow = 'none';
      }
      showToast('میکروفون قطع شد.', 'info');
    }
  };
}

