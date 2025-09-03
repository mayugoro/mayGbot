const { getDeskripsiPaket, setKonfigurasi } = require('../../../db');

// === PRELOAD KEYBOARDS ===
const ATUR_DESKRIPSI_KEYBOARD = [
  [
    { text: '🌙 BULANAN', callback_data: 'deskripsi_bulanan' },
    { text: '⚡ BEKASAN', callback_data: 'deskripsi_bekasan' }
  ],
  [
    { text: '🔙 KEMBALI', callback_data: 'atur_produk' }
  ]
];

// === PRELOAD CONTENT ===
const ATUR_DESKRIPSI_CONTENT = '📝 <b>ATUR DESKRIPSI PRODUK</b>\n\nPilih kategori produk yang akan diubah deskripsinya:';

module.exports = (bot) => {
  // Import modul terpisah untuk bekasan dan bulanan
  require('./deskripsi/deskripsi_bekasan')(bot);
  require('./deskripsi/deskripsi_bulanan')(bot);

  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === ATUR DESKRIPSI (Menu Utama) ===
    if (data === 'atur_deskripsi') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }

      // Cek apakah message memiliki caption (dari photo message)
      if (message.caption) {
        // Cek apakah caption dan keyboard sudah sama
        if (message.caption === ATUR_DESKRIPSI_CONTENT && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(ATUR_DESKRIPSI_KEYBOARD)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Atur Deskripsi aktif.',
            show_alert: false
          });
        }

        try {
          await bot.editMessageCaption(ATUR_DESKRIPSI_CONTENT, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: ATUR_DESKRIPSI_KEYBOARD }
          });
        } catch (error) {
          if (error.message.includes('message is not modified')) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu Atur Deskripsi aktif.',
              show_alert: false
            });
          }
          console.error('Error editing atur_deskripsi caption:', error.message);
        }
      } else {
        // Cek apakah text dan keyboard sudah sama
        if (message.text === ATUR_DESKRIPSI_CONTENT && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(ATUR_DESKRIPSI_KEYBOARD)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Atur Deskripsi aktif.',
            show_alert: false
          });
        }

        try {
          await bot.editMessageText(ATUR_DESKRIPSI_CONTENT, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: ATUR_DESKRIPSI_KEYBOARD }
          });
        } catch (error) {
          if (error.message.includes('message is not modified')) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu Atur Deskripsi aktif.',
              show_alert: false
            });
          }
          console.error('Error editing atur_deskripsi text:', error.message);
        }
      }

      await bot.answerCallbackQuery(id);
      return;
    }
  });
};
