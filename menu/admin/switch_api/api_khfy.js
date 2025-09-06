const { getKonfigurasi, setKonfigurasi } = require('../../../db');

// === KEYBOARD MENU SWITCH KHFY ===
const SWITCH_KHFY_KEYBOARD = [
  [
    { text: '🌙 SWITCH BULANAN', callback_data: 'switch_khfy_bulanan' },
    { text: '⚡ SWITCH BEKASAN', callback_data: 'switch_khfy_bekasan' }
  ],
  [
    { text: '🌙 BULANAN +⚡ BEKASAN', callback_data: 'switch_khfy_both' }
  ],
  [
    { text: '🔙 KEMBALI', callback_data: 'switch_api' }
  ]
];

// Template konten menu
const SWITCH_KHFY_CONTENT = '🟢 <b>SWITCH KHFY API</b>\n\nPilih handler yang ingin menggunakan KHFY API:';

// Function untuk get current API status
const getCurrentAPIStatus = async (handler) => {
  try {
    const config = await getKonfigurasi(`api_${handler}`);
    return config || 'API1'; // default API1 untuk KHFY
  } catch (error) {
    return 'API1'; // default fallback
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

    // === MENU SWITCH KHFY ===
    if (data === 'switch_khfy_menu') {
      
      const keyboard = SWITCH_KHFY_KEYBOARD;
      const content = SWITCH_KHFY_CONTENT;

      // Cek apakah message memiliki caption (dari photo message)
      if (message.caption) {
        // Cek apakah caption dan keyboard sudah sama
        if (message.caption === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu SWITCH KHFY sudah aktif.',
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
              text: '✅ Menu SWITCH KHFY sudah aktif.',
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
            text: '✅ Menu SWITCH KHFY sudah aktif.',
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
              text: '✅ Menu SWITCH KHFY sudah aktif.',
              show_alert: false
            });
          }
          // Error dihandle secara silent
        }
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === SWITCH BULANAN + BEKASAN KE KHFY ===
    if (data === 'switch_khfy_both') {
      try {
        const bulananAPI = await getCurrentAPIStatus('bulanan');
        const bekasanAPI = await getCurrentAPIStatus('bekasan');
        
        // Cek apakah kedua handler sudah menggunakan KHFY API
        if (bulananAPI === 'API1' && bekasanAPI === 'API1') {
          return bot.answerCallbackQuery(id, {
            text: '✅ Kedua handler (BULANAN & BEKASAN) sudah menggunakan KHFY API (API1)',
            show_alert: true
          });
        }

        // Switch kedua handler ke KHFY API
        const bulananSuccess = await setAPIConfiguration('bulanan', 'API1');
        const bekasanSuccess = await setAPIConfiguration('bekasan', 'API1');
        
        if (bulananSuccess && bekasanSuccess) {
          await bot.answerCallbackQuery(id, {
            text: '🔄 Kedua handler (BULANAN & BEKASAN) berhasil di-switch ke KHFY API (API1)!',
            show_alert: true
          });
        } else if (bulananSuccess && !bekasanSuccess) {
          await bot.answerCallbackQuery(id, {
            text: '⚠️ BULANAN berhasil, tapi BEKASAN gagal di-switch ke KHFY API',
            show_alert: true
          });
        } else if (!bulananSuccess && bekasanSuccess) {
          await bot.answerCallbackQuery(id, {
            text: '⚠️ BEKASAN berhasil, tapi BULANAN gagal di-switch ke KHFY API',
            show_alert: true
          });
        } else {
          await bot.answerCallbackQuery(id, {
            text: '❌ Gagal switch kedua handler ke KHFY API',
            show_alert: true
          });
        }
      } catch (error) {
        await bot.answerCallbackQuery(id, {
          text: '❌ Error saat switch kedua handler ke KHFY API',
          show_alert: true
        });
      }
      return;
    }

    // === SWITCH BULANAN KE KHFY ===
    if (data === 'switch_khfy_bulanan') {
      try {
        const currentAPI = await getCurrentAPIStatus('bulanan');
        
        if (currentAPI === 'API1') {
          return bot.answerCallbackQuery(id, {
            text: '✅ Handler BULANAN sudah menggunakan KHFY API (API1)',
            show_alert: true
          });
        }

        const success = await setAPIConfiguration('bulanan', 'API1');
        
        if (success) {
          await bot.answerCallbackQuery(id, {
            text: '🔄 Handler BULANAN berhasil di-switch ke KHFY API (API1)!',
            show_alert: true
          });
        } else {
          await bot.answerCallbackQuery(id, {
            text: '❌ Gagal switch handler BULANAN ke KHFY API',
            show_alert: true
          });
        }
      } catch (error) {
        await bot.answerCallbackQuery(id, {
          text: '❌ Error saat switch BULANAN ke KHFY API',
          show_alert: true
        });
      }
      return;
    }

    // === SWITCH BEKASAN KE KHFY ===
    if (data === 'switch_khfy_bekasan') {
      try {
        const currentAPI = await getCurrentAPIStatus('bekasan');
        
        if (currentAPI === 'API1') {
          return bot.answerCallbackQuery(id, {
            text: '✅ Handler BEKASAN sudah menggunakan KHFY API (API1)',
            show_alert: true
          });
        }

        const success = await setAPIConfiguration('bekasan', 'API1');
        
        if (success) {
          await bot.answerCallbackQuery(id, {
            text: '🔄 Handler BEKASAN berhasil di-switch ke KHFY API (API1)!',
            show_alert: true
          });
        } else {
          await bot.answerCallbackQuery(id, {
            text: '❌ Gagal switch handler BEKASAN ke KHFY API',
            show_alert: true
          });
        }
      } catch (error) {
        await bot.answerCallbackQuery(id, {
          text: '❌ Error saat switch BEKASAN ke KHFY API',
          show_alert: true
        });
      }
      return;
    }
  });
};
