// ⚙️ SETTING KUOTA HUB
// File hub yang mengatur kuota untuk stok global dan stok pribadi
// Dynamic loading untuk optimasi performance

const { getKuotaPaket, setKonfigurasi } = require('../../../db');

const adminState = new Map();

// === PRELOAD INLINE KEYBOARDS ===
const SETTING_KUOTA_KEYBOARD = [
  [
    { text: '🌙 KUOTA BULANAN', callback_data: 'kuota_stok_global' },
    { text: '🏪 KUOTA PRIBADI', callback_data: 'kuota_stok_pribadi' }
  ],
  [{ text: '🔙 KEMBALI', callback_data: 'atur_produk' }]
];

const KUOTA_BULANAN_KEYBOARD = [
  [{ text: 'SUPERMINI', callback_data: 'edit_kuota_supermini' }],
  [{ text: 'SUPERBIG', callback_data: 'edit_kuota_superbig' }],
  [{ text: 'MINI', callback_data: 'edit_kuota_mini' }],
  [{ text: 'BIG', callback_data: 'edit_kuota_big' }],
  [{ text: 'LITE', callback_data: 'edit_kuota_lite' }],
  [{ text: 'JUMBO', callback_data: 'edit_kuota_jumbo' }],
  [{ text: 'MEGABIG', callback_data: 'edit_kuota_megabig' }],
  [{ text: 'SUPER JUMBO', callback_data: 'edit_kuota_superjumbo' }],
  [{ text: '🔙 KEMBALI', callback_data: 'atur_kuota_bulanan' }]
];

const KUOTA_PRIBADI_KEYBOARD = [
  [{ text: '🔙 KEMBALI', callback_data: 'atur_kuota_bulanan' }]
];

// Preload template content
const SETTING_KUOTA_CONTENT = '⚙️ <b>SETTING KUOTA</b>\n\nPilih jenis kuota yang ingin diatur:';
const KUOTA_BULANAN_CONTENT = '🌙 <b>KUOTA STOK GLOBAL</b>\n\nPilih paket bulanan yang ingin diubah kuotanya:\n\n💡 <i>Kuota 0 = Unlimited</i>';
const KUOTA_PRIBADI_CONTENT = '🏪 <b>KUOTA STOK PRIBADI</b>\n\n📋 Menu kuota pribadi sedang disiapkan...\n\n💡 <i>Fitur ini akan segera tersedia</i>';

// Template input form untuk edit kuota
const generateEditKuotaForm = (paket, kuotaSekarang) => {
  const kuotaText = kuotaSekarang === '0' ? 'Unlimited' : `${kuotaSekarang} GB`;
  return `🌙 <b>EDIT KUOTA BULANAN ${paket.toUpperCase()}</b>\n\n` +
    `Kuota saat ini: <code>${kuotaText}</code>\n\n` +
    `Masukkan kuota baru (dalam GB):\n\n` +
    `💡 Contoh: 100 (untuk 100 GB)\n` +
    `💡 Ketik 0 untuk unlimited\n` +
    `💡 Ketik "exit" untuk membatalkan.`;
};

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === SETTING KUOTA ===
    if (data === 'atur_kuota_bulanan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = SETTING_KUOTA_KEYBOARD;
      const content = SETTING_KUOTA_CONTENT;

      try {
        if (message.caption) {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
      } catch (error) {
        if (error.message.includes('message is not modified')) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Setting Kuota aktif.',
            show_alert: false
          });
        }
        console.error('Error editing setting kuota:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === KUOTA STOK GLOBAL (BULANAN) ===
    if (data === 'kuota_stok_global') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = KUOTA_BULANAN_KEYBOARD;
      const content = KUOTA_BULANAN_CONTENT;

      try {
        if (message.caption) {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
      } catch (error) {
        if (error.message.includes('message is not modified')) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu sudah aktif.',
            show_alert: false
          });
        }
        console.error('Error editing kuota_stok_global:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === KUOTA STOK PRIBADI ===
    if (data === 'kuota_stok_pribadi') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      // Load handler stok pribadi secara dinamis
      try {
        require('../stok_pribadi/aturkuota_stok_pribadi')(bot);
        
        // Kirim notifikasi bahwa menu kuota pribadi akan aktif
        const content = KUOTA_PRIBADI_CONTENT;
        const keyboard = KUOTA_PRIBADI_KEYBOARD;
        
        try {
          if (message.caption) {
            await bot.editMessageCaption(content, {
              chat_id: chatId,
              message_id: msgId,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: keyboard }
            });
          } else {
            await bot.editMessageText(content, {
              chat_id: chatId,
              message_id: msgId,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: keyboard }
            });
          }
        } catch (error) {
          console.error('Error editing kuota_stok_pribadi:', error.message);
        }
        
      } catch (e) {
        console.log('🏪 Kuota Stok Pribadi handler loaded (placeholder)');
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === EDIT KUOTA SPESIFIK ===
    if (/^edit_kuota_(supermini|superbig|mini|big|lite|jumbo|megabig|superjumbo)$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const paket = data.split('_')[2].toLowerCase();
      
      try {
        const kuotaSekarang = await getKuotaPaket(paket);
        
        adminState.set(chatId, { mode: 'edit_kuota', kategori: paket });
        
        const inputMsg = await bot.sendMessage(chatId, generateEditKuotaForm(paket, kuotaSekarang), {
          parse_mode: 'HTML'
        });
        
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        await bot.answerCallbackQuery(id, { text: '❌ Gagal memuat data.', show_alert: true });
      }
      return;
    }
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;

    const state = adminState.get(chatId);
    if (!state || state.mode !== 'edit_kuota') return;

    // === CEK CANCEL/EXIT ===
    if (['exit', 'EXIT', 'Exit'].includes(msg.text.trim())) {
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {
          // Ignore delete error
        }
      }
      
      adminState.delete(chatId);
      await bot.deleteMessage(chatId, msg.message_id);
      return;
    }

    try {
      const kuotaBaru = parseInt(msg.text.trim());
      
      if (isNaN(kuotaBaru) || kuotaBaru < 0) {
        await bot.sendMessage(chatId, '❌ Format kuota salah! Masukkan angka yang valid (0 untuk unlimited).');
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }
      
      const key = `kuota_${state.kategori.toLowerCase()}`;
      await setKonfigurasi(key, kuotaBaru.toString());
      
      const kuotaText = kuotaBaru === 0 ? 'Unlimited' : `${kuotaBaru} GB`;
      const teksHasil = `✅ <b>Kuota berhasil diubah!</b>\n\n` +
        `📦 Paket: BULANAN ${state.kategori.toUpperCase()}\n` +
        `📊 Kuota baru: <code>${kuotaText}</code>`;
      
      if (state.inputMessageId) {
        try {
          await bot.editMessageText(teksHasil, {
            chat_id: chatId,
            message_id: state.inputMessageId,
            parse_mode: 'HTML'
          });
        } catch (e) {
          await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
        }
      } else {
        await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
      }
      
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {
          // Ignore delete error
        }
      }, 2000);
      
      adminState.delete(chatId);
      await bot.deleteMessage(chatId, msg.message_id);
      
    } catch (e) {
      const teksError = `❌ Gagal menyimpan kuota: ${e.message}`;
      
      if (state.inputMessageId) {
        try {
          await bot.editMessageText(teksError, {
            chat_id: chatId,
            message_id: state.inputMessageId
          });
        } catch (e) {
          await bot.sendMessage(chatId, teksError);
        }
      } else {
        await bot.sendMessage(chatId, teksError);
      }
      
      adminState.delete(chatId);
      await bot.deleteMessage(chatId, msg.message_id);
    }
  });
};
