// 💼 BIAYA OPERASI HUB
// File hub yang mengatur semua pengaturan biaya
// 
// Submenu yang dikelola:
// - ❌ Biaya TRX Gagal       -> ./biaya/biaya_gagal.js
// - 💰 Min Saldo Bekasan    -> ./biaya/minimal_bekasan.js  
// - 💎 Min Saldo Bulanan    -> ./biaya/minimal_bulanan.js
// - 📝 Pesan Tolak Bekasan  -> ./biaya/tolak_bekasan.js
// - 📋 Pesan Tolak Bulanan  -> ./biaya/tolak_bulanan.js

const { getKonfigurasi, setKonfigurasi } = require('../../../db');

// === PRELOAD INLINE KEYBOARDS ===
const BIAYA_OPERASI_KEYBOARD = [
  [{ text: '❌ BIAYA TRX GAGAL', callback_data: 'set_biaya_gagal' }],
  [{ text: '💰 MIN SALDO BEKASAN', callback_data: 'set_min_saldo_bekasan' }],
  [{ text: '💎 MIN SALDO BULANAN', callback_data: 'set_min_saldo_bulanan' }],
  [{ text: '🌍 MIN SALDO GLOBAL', callback_data: 'set_min_saldo_global' }],
  [{ text: '📝 PESAN TOLAK BEKASAN', callback_data: 'set_pesan_bekasan' }],
  [{ text: '📋 PESAN TOLAK BULANAN', callback_data: 'set_pesan_bulanan' }],
  [{ text: '🌍 PESAN TOLAK GLOBAL', callback_data: 'set_pesan_global' }],
  [{ text: '🔙 KEMBALI', callback_data: 'atur_produk' }]
];

// Preload template content
const BIAYA_OPERASI_CONTENT = '💼 <b>BIAYA OPERASI</b>\n\nPilih pengaturan biaya yang ingin diubah:';

module.exports = (bot) => {
  // Load semua sub-handler saat startup untuk menghindari race condition
  try {
    require('./biaya/biaya_gagal')(bot);
    require('./biaya/minimal_bekasan')(bot);
    require('./biaya/minimal_bulanan')(bot);
    require('./biaya/minimal_global')(bot);
    require('./biaya/tolak_bekasan')(bot);
    require('./biaya/tolak_bulanan')(bot);
    require('./biaya/tolak_global')(bot);
  } catch (error) {
    console.error('❌ Error loading biaya handlers:', error.message);
  }
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (data === 'biaya_operasi') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }
      
      const keyboard = BIAYA_OPERASI_KEYBOARD;
      const content = BIAYA_OPERASI_CONTENT;

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
        console.error('Error editing biaya_operasi:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }
  });
};
