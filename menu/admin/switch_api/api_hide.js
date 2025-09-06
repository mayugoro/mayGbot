const { getKonfigurasi, setKonfigurasi } = require('../../../db');

// === KEYBOARD MENU SWITCH HIDE ===
const SWITCH_HIDE_KEYBOARD = [
  [
    { text: '🌙 SWITCH BULANAN', callback_data: 'switch_hide_bulanan' },
    { text: '⚡ SWITCH BEKASAN', callback_data: 'switch_hide_bekasan' }
  ],
  [
    { text: '🌙 BULANAN +⚡ BEKASAN', callback_data: 'switch_hide_both' }
  ],
  [
    { text: '🔙 KEMBALI', callback_data: 'switch_api' }
  ]
];

// Template konten menu
const SWITCH_HIDE_CONTENT = '⚪ <b>SWITCH HIDE API</b>\n\nPilih handler yang ingin menggunakan Hide API:';

// Function untuk get current API status
const getCurrentAPIStatus = async (handler) => {
  try {
    const config = await getKonfigurasi(`api_${handler}`);
    return config || (handler === 'bekasan' ? 'API2' : 'API1'); // default bekasan=API2, bulanan=API1
  } catch (error) {
    return handler === 'bekasan' ? 'API2' : 'API1'; // default fallback
  }
};

// Function untuk set API configuration
const setAPIConfiguration = async (handler, apiType) => {
  try {
    await setKonfigurasi(`api_${handler}`, apiType);
    return true;
  } catch (error) {
    console.error(`Error setting API config for ${handler}:`, error.message);
    return false;
  }
};

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === MENU SWITCH HIDE ===
    if (data === 'switch_hide_menu') {
      
      const keyboard = SWITCH_HIDE_KEYBOARD;
      const content = SWITCH_HIDE_CONTENT;

      // Cek apakah message memiliki caption (dari photo message)
      if (message.caption) {
        // Cek apakah caption dan keyboard sudah sama
        if (message.caption === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu SWITCH HIDE sudah aktif.',
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
              text: '✅ Menu SWITCH HIDE sudah aktif.',
              show_alert: false
            });
          }
          // Error dihandle secara silent
        }
      } else {
        // Cek apakah text dan keyboard sudah sama
        if (message.text === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu SWITCH HIDE sudah aktif.',
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
              text: '✅ Menu SWITCH HIDE sudah aktif.',
              show_alert: false
            });
          }
          // Error dihandle secara silent
        }
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === SWITCH BULANAN + BEKASAN KE HIDE ===
    if (data === 'switch_hide_both') {
      try {
        const bulananAPI = await getCurrentAPIStatus('bulanan');
        const bekasanAPI = await getCurrentAPIStatus('bekasan');
        
        // Cek apakah kedua handler sudah menggunakan Hide API
        if (bulananAPI === 'API2' && bekasanAPI === 'API2') {
          return bot.answerCallbackQuery(id, {
            text: '✅ Kedua handler (BULANAN & BEKASAN) sudah menggunakan Hide API (API2)',
            show_alert: true
          });
        }

        // Switch kedua handler ke Hide API
        const bulananSuccess = await setAPIConfiguration('bulanan', 'API2');
        const bekasanSuccess = await setAPIConfiguration('bekasan', 'API2');
        
        if (bulananSuccess && bekasanSuccess) {
          await bot.answerCallbackQuery(id, {
            text: '🔄 Kedua handler (BULANAN & BEKASAN) berhasil di-switch ke Hide API (API2)!',
            show_alert: true
          });
        } else if (bulananSuccess && !bekasanSuccess) {
          await bot.answerCallbackQuery(id, {
            text: '⚠️ BULANAN berhasil, tapi BEKASAN gagal di-switch ke Hide API',
            show_alert: true
          });
        } else if (!bulananSuccess && bekasanSuccess) {
          await bot.answerCallbackQuery(id, {
            text: '⚠️ BEKASAN berhasil, tapi BULANAN gagal di-switch ke Hide API',
            show_alert: true
          });
        } else {
          await bot.answerCallbackQuery(id, {
            text: '❌ Gagal switch kedua handler ke Hide API',
            show_alert: true
          });
        }
      } catch (error) {
        await bot.answerCallbackQuery(id, {
          text: '❌ Error saat switch kedua handler ke Hide API',
          show_alert: true
        });
      }
      return;
    }

    // === SWITCH BULANAN KE HIDE ===
    if (data === 'switch_hide_bulanan') {
      try {
        const currentAPI = await getCurrentAPIStatus('bulanan');
        
        if (currentAPI === 'API2') {
          return bot.answerCallbackQuery(id, {
            text: '✅ Handler BULANAN sudah menggunakan Hide API (API2)',
            show_alert: true
          });
        }

        const success = await setAPIConfiguration('bulanan', 'API2');
        
        if (success) {
          await bot.answerCallbackQuery(id, {
            text: '🔄 Handler BULANAN berhasil di-switch ke Hide API (API2)!',
            show_alert: true
          });
        } else {
          await bot.answerCallbackQuery(id, {
            text: '❌ Gagal switch handler BULANAN ke Hide API',
            show_alert: true
          });
        }
      } catch (error) {
        await bot.answerCallbackQuery(id, {
          text: '❌ Error saat switch BULANAN ke Hide API',
          show_alert: true
        });
      }
      return;
    }

    // === SWITCH BEKASAN KE HIDE ===
    if (data === 'switch_hide_bekasan') {
      try {
        const currentAPI = await getCurrentAPIStatus('bekasan');
        
        if (currentAPI === 'API2') {
          return bot.answerCallbackQuery(id, {
            text: '✅ Handler BEKASAN sudah menggunakan Hide API (API2)',
            show_alert: true
          });
        }

        const success = await setAPIConfiguration('bekasan', 'API2');
        
        if (success) {
          await bot.answerCallbackQuery(id, {
            text: '🔄 Handler BEKASAN berhasil di-switch ke Hide API (API2)!',
            show_alert: true
          });
        } else {
          await bot.answerCallbackQuery(id, {
            text: '❌ Gagal switch handler BEKASAN ke Hide API',
            show_alert: true
          });
        }
      } catch (error) {
        await bot.answerCallbackQuery(id, {
          text: '❌ Error saat switch BEKASAN ke Hide API',
          show_alert: true
        });
      }
      return;
    }
  });
};
