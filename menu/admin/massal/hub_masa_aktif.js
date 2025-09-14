// === MASA AKTIF HUB MENU ===
// Hub untuk tools masa aktif

// === PRELOAD INLINE KEYBOARDS ===
const MASA_AKTIF_MENU_KEYBOARD = [
  [
    { text: '➕ TAMBAH MASA AKTIF', callback_data: 'tambah_masa_aktif' }
  ],
  [
    { text: '🔍 CEK MASA AKTIF', callback_data: 'cek_masa_aktif' }
  ],
  [
    { text: '🔙 KEMBALI', callback_data: 'menu_massal' }
  ]
];

// Preload template content
const MASA_AKTIF_CONTENT = '⌚ <b>MENU MASA AKTIF</b>\n\nPilih tools masa aktif yang ingin digunakan:';

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === PENGECEKAN ADMIN UNTUK MASA AKTIF ===
    const masaAktifCallbacks = ['masa_aktif', 'tambah_masa_aktif', 'cek_masa_aktif'];
    if (masaAktifCallbacks.includes(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }
    }

    // === MASA AKTIF MENU ===
    if (data === 'masa_aktif') {
      
      const keyboard = MASA_AKTIF_MENU_KEYBOARD;
      const content = MASA_AKTIF_CONTENT;

      // Cek apakah message memiliki caption (dari photo message)
      if (message.caption) {
        // Cek apakah caption dan keyboard sudah sama
        if (message.caption === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Masa Aktif aktif.',
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
              text: '✅ Menu Masa Aktif aktif.',
              show_alert: false
            });
          }
          console.error('Error editing masa aktif caption:', error.message);
        }
      } else {
        // Cek apakah text dan keyboard sudah sama
        if (message.text === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Masa Aktif aktif.',
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
              text: '✅ Menu Masa Aktif aktif.',
              show_alert: false
            });
          }
          console.error('Error editing masa aktif text:', error.message);
        }
      }

      await bot.answerCallbackQuery(id);
      return;
    }
  });

  // Load sub-tools masa aktif
  try {
    console.log('🔄 [MASA_AKTIF] Loading masa aktif modules...');
    require('./masa_aktif/tambah_masa_aktif')(bot);
    console.log('✅ [MASA_AKTIF] tambah_masa_aktif loaded');
    require('./masa_aktif/cek_masa_aktif')(bot);
    console.log('✅ [MASA_AKTIF] cek_masa_aktif loaded');
  } catch (error) {
    console.error('Error loading masa aktif modules:', error.message);
    console.log('📁 Pastikan folder masa_aktif/ dan file-filenya sudah dibuat:');
    console.log('   - ./masa_aktif/tambah_masa_aktif.js');
    console.log('   - ./masa_aktif/cek_masa_aktif.js');
  }
};
