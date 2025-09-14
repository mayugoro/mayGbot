// === TAMBAH MASA AKTIF TOOL ===
// Tool untuk menambah masa aktif nomor

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === TAMBAH MASA AKTIF ===
    if (data === 'tambah_masa_aktif') {
      try {
        const content = 
          `➕ <b>TAMBAH MASA AKTIF</b>\n\n` +
          `🚧 <b>Tool sedang dalam pengembangan</b>\n\n` +
          `⚡ Fitur yang akan tersedia:\n` +
          `• Input nomor telepon\n` +
          `• Pilih paket masa aktif\n` +
          `• Eksekusi penambahan masa aktif\n` +
          `• Real-time status tracking\n\n` +
          `🔜 <b>Coming Soon!</b>`;

        const keyboard = [
          [
            { text: '🔙 KEMBALI', callback_data: 'masa_aktif' }
          ]
        ];

        // Edit message berdasarkan tipe (text atau caption)
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

        await bot.answerCallbackQuery(id, {
          text: '🚧 Tool dalam pengembangan',
          show_alert: false
        });

      } catch (error) {
        console.error('Error in tambah_masa_aktif:', error.message);
        await bot.answerCallbackQuery(id, {
          text: '❌ Terjadi error',
          show_alert: true
        });
      }
    }
  });
};
