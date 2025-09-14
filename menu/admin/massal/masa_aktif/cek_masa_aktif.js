// === CEK MASA AKTIF TOOL ===
// Tool untuk mengecek masa aktif nomor

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === CEK MASA AKTIF ===
    if (data === 'cek_masa_aktif') {
      try {
        const content = 
          `🔍 <b>CEK MASA AKTIF</b>\n\n` +
          `🚧 <b>Tool sedang dalam pengembangan</b>\n\n` +
          `⚡ Fitur yang akan tersedia:\n` +
          `• Input nomor telepon (single/multiple)\n` +
          `• Cek masa aktif real-time\n` +
          `• Format output yang rapi\n` +
          `• Export hasil ke file\n` +
          `• Batch processing untuk multiple numbers\n\n` +
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
        console.error('Error in cek_masa_aktif:', error.message);
        await bot.answerCallbackQuery(id, {
          text: '❌ Terjadi error',
          show_alert: true
        });
      }
    }
  });
};
