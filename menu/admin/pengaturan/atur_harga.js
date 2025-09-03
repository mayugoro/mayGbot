const { getHargaPaket, setKonfigurasi } = require('../../../db');

const adminState = new Map();

// === PRELOAD INLINE KEYBOARDS ===
const ATUR_HARGA_MAIN_KEYBOARD = [
  [
    { text: '🌙 BULANAN', callback_data: 'harga_bulanan' },
    { text: '⚡ BEKASAN', callback_data: 'harga_bekasan' }
  ],
  [
    { text: '🏪 HARGA PRIBADI', callback_data: 'harga_pribadi' }
  ],
  [
    { text: '🔙 KEMBALI', callback_data: 'atur_produk' }
  ]
];

const HARGA_BEKASAN_KEYBOARD = [
  [{ text: 'BEKASAN 3H', callback_data: 'edit_harga_3h' }],
  [{ text: 'BEKASAN 4H', callback_data: 'edit_harga_4h' }],
  [{ text: 'BEKASAN 5H', callback_data: 'edit_harga_5h' }],
  [{ text: 'BEKASAN 6H', callback_data: 'edit_harga_6h' }],
  [{ text: 'BEKASAN 7H', callback_data: 'edit_harga_7h' }],
  [{ text: 'BEKASAN 8H', callback_data: 'edit_harga_8h' }],
  [{ text: 'BEKASAN 9H', callback_data: 'edit_harga_9h' }],
  [{ text: 'BEKASAN 10H', callback_data: 'edit_harga_10h' }],
  [{ text: '🔙 KEMBALI', callback_data: 'atur_harga' }]
];

const HARGA_BULANAN_KEYBOARD = [
  [{ text: 'SUPERMINI', callback_data: 'edit_harga_supermini' }],
  [{ text: 'SUPERBIG', callback_data: 'edit_harga_superbig' }],
  [{ text: 'MINI', callback_data: 'edit_harga_mini' }],
  [{ text: 'BIG', callback_data: 'edit_harga_big' }],
  [{ text: 'LITE', callback_data: 'edit_harga_lite' }],
  [{ text: 'JUMBO', callback_data: 'edit_harga_jumbo' }],
  [{ text: 'MEGABIG', callback_data: 'edit_harga_megabig' }],
  [{ text: 'SUPER JUMBO', callback_data: 'edit_harga_superjumbo' }],
  [{ text: '🔙 KEMBALI', callback_data: 'atur_harga' }]
];

const HARGA_PRIBADI_KEYBOARD = [
  [{ text: '🔙 KEMBALI', callback_data: 'atur_harga' }]
];

// Preload template content
const ATUR_HARGA_MAIN_CONTENT = '💰 <b>ATUR HARGA PRODUK</b>\n\nPilih kategori produk yang akan diubah harganya:';
const HARGA_BEKASAN_CONTENT = '💰 <b>ATUR HARGA BEKASAN</b>\n\nPilih paket bekasan yang ingin diubah harganya:';
const HARGA_BULANAN_CONTENT = '💰 <b>ATUR HARGA BULANAN</b>\n\nPilih paket bulanan yang ingin diubah harganya:';
const HARGA_PRIBADI_CONTENT = '🏪 <b>HARGA STOK PRIBADI</b>\n\n📋 Menu harga stok pribadi sedang disiapkan...\n\n💡 <i>Fitur ini akan segera tersedia</i>';

// Template input form untuk edit harga
const generateEditHargaForm = (jenis, kategori, hargaSekarang) => {
  const jenisText = jenis === 'bekasan' ? 'BEKASAN' : 'BULANAN';
  const contohHarga = jenis === 'bekasan' ? '15000' : '50000';
  
  return `💰 <b>EDIT HARGA ${jenisText} ${kategori.toUpperCase()}</b>\n\n` +
    `Harga saat ini: <code>Rp. ${hargaSekarang.toLocaleString('id-ID')}</code>\n\n` +
    `Masukkan harga baru (tanpa tanda titik atau koma):\n\n` +
    `💡 Contoh: ${contohHarga}\n` +
    `💡 Ketik "exit" untuk membatalkan.`;
};

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === ATUR HARGA ===
    if (data === 'atur_harga') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = ATUR_HARGA_MAIN_KEYBOARD;
      const content = ATUR_HARGA_MAIN_CONTENT;

      // Cek apakah message memiliki caption (dari photo message)
      if (message.caption) {
        // Cek apakah caption dan keyboard sudah sama
        if (message.caption === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Atur Harga aktif.',
            show_alert: false
          });
        }

        try {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } catch (error) {
          if (error.message.includes('message is not modified')) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu Atur Harga aktif.',
              show_alert: false
            });
          }
          console.error('Error editing atur_harga caption:', error.message);
        }
      } else {
        // Cek apakah text dan keyboard sudah sama
        if (message.text === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Atur Harga aktif.',
            show_alert: false
          });
        }

        try {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } catch (error) {
          if (error.message.includes('message is not modified')) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu Atur Harga aktif.',
              show_alert: false
            });
          }
          console.error('Error editing atur_harga text:', error.message);
        }
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === HARGA BEKASAN ===
    if (data === 'harga_bekasan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = HARGA_BEKASAN_KEYBOARD;
      const content = HARGA_BEKASAN_CONTENT;

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
        console.error('Error editing harga_bekasan:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === HARGA BULANAN ===
    if (data === 'harga_bulanan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = HARGA_BULANAN_KEYBOARD;
      const content = HARGA_BULANAN_CONTENT;

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
        console.error('Error editing harga_bulanan:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === HARGA PRIBADI ===
    if (data === 'harga_pribadi') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      // Load handler stok pribadi secara dinamis
      try {
        require('../stok_pribadi/harga_stok_pribadi')(bot);
        
        const content = HARGA_PRIBADI_CONTENT;
        const keyboard = HARGA_PRIBADI_KEYBOARD;
        
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
          console.error('Error editing harga_pribadi:', error.message);
        }
        
      } catch (e) {
        console.log('🏪 Harga Stok Pribadi handler loaded (placeholder)');
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === EDIT HARGA SPESIFIK (BEKASAN) ===
    if (/^edit_harga_\d+h$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const kategori = data.split('_')[2].toUpperCase();
      
      try {
        const hargaSekarang = await getHargaPaket(kategori);
        
        adminState.set(chatId, { mode: 'edit_harga', kategori });
        
        const inputMsg = await bot.sendMessage(chatId, generateEditHargaForm('bekasan', kategori, hargaSekarang), {
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

    // === EDIT HARGA SPESIFIK (BULANAN) ===
    if (/^edit_harga_(supermini|superbig|mini|big|lite|jumbo|megabig|superjumbo)$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const paket = data.split('_')[2].toLowerCase();
      
      try {
        const hargaSekarang = await getHargaPaket(paket);
        
        adminState.set(chatId, { mode: 'edit_harga', kategori: paket });
        
        const inputMsg = await bot.sendMessage(chatId, generateEditHargaForm('bulanan', paket, hargaSekarang), {
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
    if (!state || state.mode !== 'edit_harga') return;

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
      const hargaBaru = parseInt(msg.text.trim());
      
      if (isNaN(hargaBaru) || hargaBaru <= 0) {
        await bot.sendMessage(chatId, '❌ Format harga salah! Masukkan angka yang valid.');
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }
      
      const key = `harga_${state.kategori.toLowerCase()}`;
      await setKonfigurasi(key, hargaBaru.toString());
      
      const jenisText = /^\d+h$/i.test(state.kategori) ? 'BEKASAN' : 'BULANAN';
      const teksHasil = `✅ <b>Harga berhasil diubah!</b>\n\n` +
        `📦 Paket: ${jenisText} ${state.kategori.toUpperCase()}\n` +
        `💰 Harga baru: <code>Rp. ${hargaBaru.toLocaleString('id-ID')}</code>`;
      
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
      
      // Auto delete notifikasi hasil setelah 2 detik
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {
          // Ignore delete error
        }
      }, 2000); // Ubah dari waktu lama ke 2 detik
      
      adminState.delete(chatId);
      await bot.deleteMessage(chatId, msg.message_id);
      
    } catch (e) {
      const teksError = `❌ Gagal menyimpan harga: ${e.message}`;
      
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
