// server/commsRouter.js
// Megagame V4 Communication Isolation & Routing

class CommsRouter {
  constructor(room) {
    this.room = room;
    this.messages = []; // { id, timestamp, senderCountry, senderRole, senderName, channel, text }
  }

  // Get available channels for a given player based on phase and role
  getAvailableChannels(countryId, role) {
    const country = this.room.countries[countryId];
    if (!country || country.isEliminated) {
      return [];
    }

    const phase = this.room.phase;
    const channels = [];

    if (phase === 'morning') {
      if (role === 'president') {
        channels.push({ id: 'presidents_summit', name: 'نشست رؤسای جمهور (دیپلماسی بین‌الملل)' });
        channels.push({ id: `internal_${countryId}`, name: 'دفتر ریاست جمهوری (ارتباط با وزرا)' });
        // Private 1-on-1 channels with other presidents
        Object.values(this.room.countries).forEach(c => {
          if (c.id !== countryId && !c.isEliminated) {
            const pairId = [countryId, c.id].sort().join('_');
            channels.push({ id: `pres_secret_${pairId}`, name: `🔒 خط محرمانه با رئیس‌جمهور ${c.name}` });
          }
        });
      } else {
        // war or economy minister
        channels.push({ id: `internal_${countryId}`, name: 'دفتر ریاست جمهوری (گزارش به رئیس‌جمهور)' });
      }
    } else if (phase === 'noon') {
      if (role === 'president') {
        channels.push({ id: 'presidents_summit', name: 'نشست دیپلماتیک رؤسای جمهور' });
        channels.push({ id: `internal_${countryId}`, name: 'دفتر ریاست جمهوری (ارتباط با وزرا)' });
        // Private 1-on-1 channels with other presidents
        Object.values(this.room.countries).forEach(c => {
          if (c.id !== countryId && !c.isEliminated) {
            const pairId = [countryId, c.id].sort().join('_');
            channels.push({ id: `pres_secret_${pairId}`, name: `🔒 خط محرمانه با رئیس‌جمهور ${c.name}` });
          }
        });
      } else if (role === 'war') {
        channels.push({ id: 'war_summit', name: 'ستاد مشترک فرماندهان جنگ (مذاکره و تهدید)' });
        channels.push({ id: `internal_${countryId}`, name: 'دفتر ریاست جمهوری (گزارش نظامی)' });
        // Private 1-on-1 channels with other war ministers
        Object.values(this.room.countries).forEach(c => {
          if (c.id !== countryId && !c.isEliminated) {
            const pairId = [countryId, c.id].sort().join('_');
            channels.push({ id: `war_secret_${pairId}`, name: `🔒 خط مستقیم با فرمانده جنگ ${c.name}` });
          }
        });
      } else if (role === 'economy') {
        channels.push({ id: 'trade_summit', name: 'اتاق بازرگانی وزرای اقتصاد (تبادل و تجارت)' });
        channels.push({ id: `internal_${countryId}`, name: 'دفتر ریاست جمهوری (گزارش اقتصادی)' });
        // Private 1-on-1 channels with other economy ministers
        Object.values(this.room.countries).forEach(c => {
          if (c.id !== countryId && !c.isEliminated) {
            const pairId = [countryId, c.id].sort().join('_');
            channels.push({ id: `trade_secret_${pairId}`, name: `🔒 خط مستقیم با وزیر اقتصاد ${c.name}` });
          }
        });
      }
    } else if (phase === 'night') {
      // Night Phase: Only team channel is open
      channels.push({ id: `team_${countryId}`, name: 'شورای امنیت ملی کشور (گفتگوی آزاد تیمی)' });
    }

    return channels;
  }

  canSendMessage(countryId, role, channelId) {
    const available = this.getAvailableChannels(countryId, role);
    return available.some(c => c.id === channelId);
  }

  postMessage(senderCountry, senderRole, senderName, channelId, text) {
    if (!this.canSendMessage(senderCountry, senderRole, channelId)) {
      return { success: false, error: 'دسترسی ارسال پیام به این کانال در این فاز مجاز نیست.' };
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      senderCountry,
      senderRole,
      senderName,
      channelId,
      text
    };

    this.messages.push(message);
    return { success: true, message };
  }

  getMessagesForUser(countryId, role) {
    const allowedChannels = this.getAvailableChannels(countryId, role).map(c => c.id);
    return this.messages.filter(m => allowedChannels.includes(m.channelId));
  }
}

module.exports = { CommsRouter };
