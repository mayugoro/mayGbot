// === PRELOAD INLINE KEYBOARDS ===
const MASSAL_MENU_KEYBOARD = [
  [
    { text: '🔍 SCAN BEKASAN', callback_data: 'infoakrab' }
  ],
  [
    { text: '🦵 KICK MASSAL', callback_data: 'kick_massal' }
  ],
  [
    { text: '⚡ ADD + KICK (Modern)', callback_data: 'modern_addkick_start' }
  ],
  [
    { text: '✨ CEK PULSA', callback_data: 'cek_pulsa' }
  ],
  [
    { text: '🗒️ CEK TANGGAL RESET', callback_data: 'reset_tanggal' }
  ],
  [
    { text: '🔙 KEMBALI', callback_data: 'menu_admin' }
  ]
];

// Preload template content
const MASSAL_CONTENT = '⚡ <b>MENU MASSAL</b>\n\nPilih tools massal yang ingin digunakan:';

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === PENGECEKAN ADMIN UNTUK SEMUA FITUR MASSAL ===
    const massalCallbacks = ['menu_massal', 'infoakrab', 'kick_massal', 'modern_addkick_start', 'modern_addkick_begin', 'modern_addkick_parallel', 'modern_addkick_cancel', 'modern_addkick_confirm', 'modern_addkick_confirm_parallel', 'cek_pulsa', 'reset_tanggal'];
    if (massalCallbacks.includes(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }
    }

    // === MASSAL MENU ===
    if (data === 'menu_massal') {
      
      const keyboard = MASSAL_MENU_KEYBOARD;
      const content = MASSAL_CONTENT;

      // Cek apakah message memiliki caption (dari photo message)
      if (message.caption) {
        // Cek apakah caption dan keyboard sudah sama
        if (message.caption === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Massal aktif.',
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
              text: '✅ Menu Massal aktif.',
              show_alert: false
            });
          }
          console.error('Error editing massal caption:', error.message);
        }
      } else {
        // Cek apakah text dan keyboard sudah sama
        if (message.text === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Massal aktif.',
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
              text: '✅ Menu Massal aktif.',
              show_alert: false
            });
          }
          console.error('Error editing massal text:', error.message);
        }
      }

      await bot.answerCallbackQuery(id);
      return;
    }
  });

  // Load semua sub-tools massal
  try {
    // console.log('🔄 [MASSAL] Loading massal modules...');
    require('./massal/scan_bekasan')(bot);
    // console.log('✅ [MASSAL] scan_bekasan loaded');
    require('./massal/kickmassal')(bot);
    // console.log('✅ [MASSAL] kickmassal loaded');
    require('./massal/add_kick')(bot);
    // console.log('✅ [MASSAL] add_kick loaded (Modern V2.0)');
    require('./massal/cekpulsa')(bot);
    // console.log('✅ [MASSAL] cekpulsa loaded');
    require('./massal/tanggalreset')(bot);
    // console.log('✅ [MASSAL] tanggalreset loaded');
  } catch (error) {
    console.error('Error loading massal modules:', error.message);
    // console.log('📁 Pastikan folder massal/ dan file-filenya sudah dibuat:');
    // console.log('   - ./massal/scan_bekasan.js');
    // console.log('   - ./massal/kickmassal.js');
    // console.log('   - ./massal/add_kick.js (Modern V2.0)');
    // console.log('   - ./massal/cekpulsa.js');
    // console.log('   - ./massal/tanggalreset.js');
  }
};
