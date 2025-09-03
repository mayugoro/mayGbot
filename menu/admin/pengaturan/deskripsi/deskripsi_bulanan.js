const { getDeskripsiPaket, setKonfigurasi } = require('../../../../db');

// === PRELOAD KEYBOARDS ===
const DESKRIPSI_BULANAN_KEYBOARD = [
  [{ text: 'SUPERMINI', callback_data: 'edit_desk_supermini' }],
  [{ text: 'SUPERBIG', callback_data: 'edit_desk_superbig' }],
  [{ text: 'MINI', callback_data: 'edit_desk_mini' }],
  [{ text: 'BIG', callback_data: 'edit_desk_big' }],
  [{ text: 'LITE', callback_data: 'edit_desk_lite' }],
  [{ text: 'JUMBO', callback_data: 'edit_desk_jumbo' }],
  [{ text: 'MEGABIG', callback_data: 'edit_desk_megabig' }],
  [{ text: 'SUPER JUMBO', callback_data: 'edit_desk_superjumbo' }],
  [{ text: '🔙 KEMBALI', callback_data: 'atur_deskripsi' }]
];

// === PRELOAD CONTENT ===
const DESKRIPSI_BULANAN_CONTENT = '📝 <b>ATUR DESKRIPSI BULANAN</b>\n\nPilih paket bulanan yang ingin diubah deskripsinya:';

// === TEMPLATE GENERATOR ===
const generateEditDeskripsiForm = (paket, deskSekarang) => {
  return `📝 <b>EDIT DESKRIPSI BULANAN ${paket.toUpperCase()}</b>\n\n` +
    `🌙 <b>Paket:</b> BULANAN ${paket.toUpperCase()}\n` +
    `📋 <b>Deskripsi saat ini:</b>\n<code>${deskSekarang}</code>\n\n` +
    `✏️ <b>Masukkan deskripsi baru:</b>\n\n` +
    `💡 Gunakan \\n untuk baris baru\n` +
    `💡 Ketik "exit" untuk membatalkan`;
};

const adminState = new Map();

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === DESKRIPSI BULANAN ===
    if (data === 'deskripsi_bulanan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }

      try {
        if (message.caption) {
          await bot.editMessageCaption(DESKRIPSI_BULANAN_CONTENT, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: DESKRIPSI_BULANAN_KEYBOARD }
          });
        } else {
          await bot.editMessageText(DESKRIPSI_BULANAN_CONTENT, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: DESKRIPSI_BULANAN_KEYBOARD }
          });
        }
      } catch (error) {
        if (error.message.includes('message is not modified')) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu sudah aktif.',
            show_alert: false
          });
        }
        console.error('Error editing deskripsi_bulanan:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === EDIT DESKRIPSI SPESIFIK BULANAN ===
    if (/^edit_desk_(supermini|superbig|mini|big|lite|jumbo|megabig|superjumbo)$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const paket = data.split('_')[2].toLowerCase();
      
      try {
        const deskSekarang = await getDeskripsiPaket(paket);
        
        adminState.set(chatId, { 
          mode: 'edit_deskripsi_bulanan', 
          kategori: paket,
          jenis: 'BULANAN'
        });
        
        const inputMsg = await bot.sendMessage(chatId, 
          generateEditDeskripsiForm(paket, deskSekarang), 
          { parse_mode: 'HTML' }
        );
        
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        console.error('Error loading bulanan description:', e);
        await bot.answerCallbackQuery(id, { text: '❌ Gagal memuat data bulanan.', show_alert: true });
      }
      
      await bot.answerCallbackQuery(id);
      return;
    }
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;

    const state = adminState.get(chatId);
    if (!state || state.mode !== 'edit_deskripsi_bulanan') return;

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
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}
      return;
    }

    // === PROSES SIMPAN DESKRIPSI BULANAN ===
    try {
      const deskripsiBaru = msg.text.trim().replace(/\\n/g, '\n');
      
      // Validasi input tidak kosong
      if (!deskripsiBaru) {
        await bot.sendMessage(chatId, '❌ <b>Deskripsi tidak boleh kosong!</b>\n\n🌙 Silakan masukkan deskripsi yang valid.', {
          parse_mode: 'HTML'
        });
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}
        return;
      }
      
      const key = `deskripsi_${state.kategori.toLowerCase()}`;
      await setKonfigurasi(key, deskripsiBaru);
      
      const teksHasil = `✅ <b>Deskripsi Bulanan Berhasil Diubah!</b>\n\n` +
        `🌙 <b>Paket:</b> BULANAN ${state.kategori.toUpperCase()}\n` +
        `🔑 <b>Key:</b> <code>${key}</code>\n` +
        `📝 <b>Deskripsi baru:</b>\n<code>${deskripsiBaru}</code>\n\n` +
        `💾 Data telah disimpan ke database`;
      
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
      
      adminState.delete(chatId);
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}
      
      // Auto delete notifikasi hasil setelah 5 detik
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {
          // Ignore delete error
        }
      }, 5000);
      
    } catch (e) {
      console.error('Error saving bulanan description:', e);
      const teksError = `❌ <b>Gagal menyimpan deskripsi bulanan!</b>\n\n` +
        `🌙 <b>Paket:</b> BULANAN ${state.kategori.toUpperCase()}\n` +
        `🔍 <b>Detail Error:</b>\n<code>${e.message}</code>\n\n` +
        `💡 Silakan coba lagi atau hubungi developer`;
      
      if (state.inputMessageId) {
        try {
          await bot.editMessageText(teksError, {
            chat_id: chatId,
            message_id: state.inputMessageId,
            parse_mode: 'HTML'
          });
        } catch (e) {
          await bot.sendMessage(chatId, teksError, { parse_mode: 'HTML' });
        }
      } else {
        await bot.sendMessage(chatId, teksError, { parse_mode: 'HTML' });
      }
      
      adminState.delete(chatId);
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}
    }
  });
};
