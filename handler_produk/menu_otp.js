// Handler: OTP Menu & Flow
const axios = require('axios');

// Simple session store for OTP flow
const otpSessions = new Map(); // chatId -> { mode, nomor, attempts, timeoutId }

function clearOtpSession(chatId) {
  const s = otpSessions.get(chatId);
  if (s && s.timeoutId) {
    clearTimeout(s.timeoutId);
  }
  otpSessions.delete(chatId);
}

function setTimeoutFor(chatId, ms, bot) {
  const s = otpSessions.get(chatId);
  if (!s) return;
  if (s.timeoutId) clearTimeout(s.timeoutId);
  s.timeoutId = setTimeout(async () => {
    try {
      clearOtpSession(chatId);
      await bot.sendMessage(chatId, '⏰ Sesi OTP berakhir (5 menit).');
    } catch (e) {}
  }, ms);
  otpSessions.set(chatId, s);
}

// 1) Show OTP menu with "LANJUT OTP"
async function showOtpMenu(bot, { chatId, messageId, message }) {
  const otpText = '🔐 <b>OTP LOGIN</b>\n\n' +
                  'Silakan lanjut untuk meminta kode OTP.\n' +
                  'Anda dapat kembali ke daftar produk kapan saja.';

  const keyboard = [
    [
      { text: '🔙 KEMBALI', callback_data: 'back_to_produk_list' },
      { text: '➡️ LANJUT OTP', callback_data: 'lanjut_otp' }
    ]
  ];

  const payload = {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard }
  };

  if (message && (message.caption || message.photo)) {
    await bot.editMessageCaption(otpText, payload);
  } else {
    await bot.editMessageText(otpText, payload);
  }
}

// 2) Start flow: ask for phone number
async function startOtpFlow(bot, { chatId }) {
  otpSessions.set(chatId, { mode: 'input_nomor', attempts: 0 });
  setTimeoutFor(chatId, 5 * 60_000, bot);
  await bot.sendMessage(chatId, '📱 Masukan nomor HP...\n\nKetik <b>exit</b> untuk batal', { parse_mode: 'HTML' });
}

// Helper: call minta-otp
async function requestOtp(nomor) {
  const url = `https://api.hidepulsa.com/api/v1/minta-otp?nomor_hp=${encodeURIComponent(nomor)}`;
  const resp = await axios.get(url, {
    headers: { Authorization: process.env.API_KEY },
    timeout: 15000
  });
  return resp.data;
}

// Helper: call verif-otp
async function verifyOtp(nomor, kode) {
  const url = `https://api.hidepulsa.com/api/v1/verif-otp?nomor_hp=${encodeURIComponent(nomor)}&kode_otp=${encodeURIComponent(kode)}`;
  const resp = await axios.get(url, {
    headers: { Authorization: process.env.API_KEY },
    timeout: 15000
  });
  return resp.data;
}

// 3) Message handler for OTP sessions
async function handleMessage(bot, msg) {
  if (!msg || !msg.chat || !msg.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const s = otpSessions.get(chatId);
  if (!s) return; // no otp session

  // Reset/update timeout on any activity
  setTimeoutFor(chatId, 5 * 60_000, bot);

  // Cancel
  if (text.toLowerCase() === 'exit') {
    clearOtpSession(chatId);
    await bot.sendMessage(chatId, '❌ Proses OTP dibatalkan.');
    return;
  }

  if (s.mode === 'input_nomor') {
    // Clean and validate phone number
    const nomor = text.replace(/\D/g, '');
    if (nomor.length < 10 || nomor.length > 15) {
      await bot.sendMessage(chatId, '❌ Nomor tidak valid. Contoh: 08123456789');
      return;
    }

    try {
      const apiRes = await requestOtp(nomor);
      const meta = apiRes?.data?.data || {};
      // Ephemeral success
      const info = await bot.sendMessage(chatId, '✅ Sukses kirim OTP, cek SMS!');
      setTimeout(async () => {
        try { await bot.deleteMessage(chatId, info.message_id); } catch (e) {}
      }, 3000);

      // Ask for OTP next
      s.mode = 'input_otp';
      s.nomor = nomor;
      s.attempts = 0;
      s.maxAttempts = meta.max_validation_attempt || 5;
      s.expiresAt = Date.now() + ((meta.expires_in || 300) * 1000);
      s.resendAfterSec = meta.next_resend_allowed_at || 60;
      otpSessions.set(chatId, s);
      let details = '🔢 Masukan OTP!';
      const parts = [];
      if (meta.expires_in) parts.push(`⏳ Berlaku: ${Math.round(meta.expires_in / 60)} menit`);
      if (meta.max_validation_attempt) parts.push(`🧪 Maks percobaan: ${meta.max_validation_attempt}x`);
      if (meta.next_resend_allowed_at) parts.push(`📨 Kirim ulang: ${meta.next_resend_allowed_at} detik`);
      if (parts.length) details += `\n${parts.join('\n')}`;
      await bot.sendMessage(chatId, details);
    } catch (err) {
      const msgErr = err?.response?.data?.message || err.message || 'Gagal meminta OTP';
      try {
        console.error('[OTP] minta-otp error:', JSON.stringify(err?.response?.data || { message: err.message }, null, 2));
      } catch (_) {}
      await bot.sendMessage(chatId, `❌ ${msgErr}`);
    }
    return;
  }

  if (s.mode === 'input_otp') {
    const kode = text.replace(/\D/g, '');
    if (kode.length === 0) {
      await bot.sendMessage(chatId, '❌ OTP tidak boleh kosong.');
      return;
    }

    try {
      if (s.expiresAt && Date.now() > s.expiresAt) {
        clearOtpSession(chatId);
        await bot.sendMessage(chatId, '⏰ OTP sudah kadaluarsa. Mulai ulang proses.');
        return;
      }
      const res = await verifyOtp(s.nomor, kode);
      const ok = res && res.status === 'success' && res.data && res.data.status === 'success';
      if (!ok) {
        // Compose error for logs; keep user message generic below
        const errMsg = res?.data?.message || res?.data?.response_content?.error_description || 'Verifikasi OTP gagal';
        throw new Error(errMsg);
      }
      clearOtpSession(chatId);
      await bot.sendMessage(chatId, '🎉 Sukses login!');
    } catch (err) {
      s.attempts = (s.attempts || 0) + 1;
      try {
        console.error('[OTP] verif-otp error:', JSON.stringify(err?.response?.data || { message: err.message }, null, 2));
      } catch (_) {}
      otpSessions.set(chatId, s);
      const maxAtt = s.maxAttempts || 5;
      if (s.attempts >= maxAtt) {
        clearOtpSession(chatId);
        await bot.sendMessage(chatId, '❌ Terlalu banyak memasukan OTP salah! ulangi dari awal!');
      } else {
  const remaining = maxAtt - s.attempts;
  await bot.sendMessage(chatId, `❌ OTP salah, masukan ulang. kesempatan ${remaining}x lagi.`);
      }
    }
    return;
  }
}

module.exports = { showOtpMenu, startOtpFlow, handleMessage };
