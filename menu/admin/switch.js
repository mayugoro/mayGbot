// === KEYBOARD MENU SWITCH API ===
const SWITCH_API_KEYBOARD = [
  [
    { text: '⚪ SWITCH HIDE', callback_data: 'switch_hide_menu' },
    { text: '🟢 SWITCH KHFY', callback_data: 'switch_khfy_menu' }
  ],
  [
    { text: '❗ STATUS API', callback_data: 'status_all_api' }
  ],
  [ 
    { text: '🔙 KEMBALI', callback_data: 'menu_admin' }
  ]
];

// Template konten menu
const SWITCH_API_CONTENT = '♻️ <b>SWITCH API</b>\n\nPilih API yang ingin di-switch:';

// Storage untuk status API states
const statusApiStates = new Map();

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === PENGECEKAN ADMIN UNTUK SEMUA FITUR SWITCH API ===
    const switchCallbacks = [
      'switch_api', 
      'switch_khfy_menu', 
      'switch_hide_menu',
      'status_all_api',
      // Callback dari api_khfy.js
      'switch_khfy_bekasan',
      'switch_khfy_bulanan', 
      'switch_khfy_both',
      // Callback dari api_hide.js
      'switch_hide_bekasan',
      'switch_hide_bulanan',
      'switch_hide_both'
    ];
    
    if (switchCallbacks.includes(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }
    }

    // === MENU SWITCH API ===
    if (data === 'switch_api') {
      
      const keyboard = SWITCH_API_KEYBOARD;
      const content = SWITCH_API_CONTENT;

      // Cek apakah message memiliki caption (dari photo message)
      if (message.caption) {
        // Cek apakah caption dan keyboard sudah sama
        if (message.caption === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu SWITCH API sudah aktif.',
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
              text: '✅ Menu SWITCH API sudah aktif.',
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
            text: '✅ Menu SWITCH API sudah aktif.',
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
              text: '✅ Menu SWITCH API sudah aktif.',
              show_alert: false
            });
          }
          // Error dihandle secara silent
        }
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === STATUS ALL API ===
    if (data === 'status_all_api') {
      try {
        const { getKonfigurasi } = require('../../db');
        
        const bulananAPI = await getKonfigurasi('api_bulanan') || 'API1';
        const bekasanAPI = await getKonfigurasi('api_bekasan') || 'API2';
        
        // Set state untuk menunggu exit command
        statusApiStates.set(chatId, {
          userId: from.id,
          active: true
        });

        const statusText = 
          '📊 <b>DATA PENGGUNAAN API</b>\n\n' +
          `🌙 <b>BULANAN</b> [${bulananAPI === 'API1' ? '🟢KHFY' : '⚪HIDE'}]\n` +
          `⚡ <b>BEKASAN</b> [${bekasanAPI === 'API1' ? '🟢KHFY' : '⚪HIDE'}]\n\n` +
          '<i>Ketik "exit" untuk keluar dari tampilan ini.</i>';

        const statusMsg = await bot.sendMessage(chatId, statusText, { parse_mode: 'HTML' });
        
        // Simpan message ID untuk bisa dihapus nanti
        const currentState = statusApiStates.get(chatId);
        if (currentState) {
          currentState.messageId = statusMsg.message_id;
          statusApiStates.set(chatId, currentState);
        }

        await bot.answerCallbackQuery(id);
      } catch (error) {
        await bot.answerCallbackQuery(id, {
          text: '❌ Error saat mengambil status API',
          show_alert: true
        });
      }
      return;
    }
  });

  // Handle text input untuk status API exit
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const state = statusApiStates.get(chatId);

    if (!state || !state.active || state.userId !== msg.from.id) return;

    try {
      // Handle exit command - bersihkan semua tanpa pesan
      if (['exit', 'EXIT', 'Exit'].includes(msg.text?.trim())) {
        // Hapus pesan status API dan pesan user
        if (state.messageId) {
          try {
            await bot.deleteMessage(chatId, state.messageId);
          } catch (e) {
            // Ignore delete error
          }
        }
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {
          // Ignore delete error
        }
        
        statusApiStates.delete(chatId);
        return;
      }
    } catch (error) {
      console.error('Error handling status API exit:', error.message);
      // Clean up state
      statusApiStates.delete(chatId);
    }
  });

  // Load semua sub-tools SWITCH API
  try {
    require('./switch_api/api_khfy')(bot);
    require('./switch_api/api_hide')(bot);
  } catch (error) {
    // Error dihandle secara silent - file akan dibuat
    console.error('Error loading switch API modules:', error.message);
    console.log('📁 Pastikan folder switch_api/ dan file-filenya sudah dibuat:');
    console.log('   - ./switch_api/api_khfy.js');
    console.log('   - ./switch_api/api_hide.js');
  }
};
