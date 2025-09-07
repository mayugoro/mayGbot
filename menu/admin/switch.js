// === KEYBOARD MENU SWITCH API ===
const SWITCH_API_KEYBOARD = [
  [
    { text: '⚪ SWITCH KE HIDE', callback_data: 'switch_hide_menu' },
    { text: '🟢 SWITCH KE KHFY', callback_data: 'switch_khfy_menu' }
  ],
  [
    { text: '❗ STATUS HANDLER', callback_data: 'status_all_handler' }
  ],
  [ 
    { text: '🔙 KEMBALI', callback_data: 'menu_admin' }
  ]
];

const fs = require('fs');
const path = require('path');

module.exports = (bot) => {
  // Handle menu switch API
  bot.on('callback_query', async (callbackQuery) => {
    const { data, from, message } = callbackQuery;
    const chatId = message?.chat?.id;
    const userId = from.id;

    if (data === 'switch_api_menu') {
      const content = `🔄 <b>SWITCH API HANDLER</b>\n\n` +
        `🟢 <b>KHFY API:</b> Menggunakan API KHFY untuk semua operasi\n` +
        `⚪ <b>HIDE API:</b> Menggunakan API HIDE untuk semua operasi\n\n` +
        `💡 <b>Info:</b> Switch akan mengganti handler aktif dan membutuhkan restart bot`;

      try {
        if (message.caption) {
          // Message has photo, edit caption
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: SWITCH_API_KEYBOARD
            }
          });
        } else {
          // Message has text, edit text
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: SWITCH_API_KEYBOARD
            }
          });
        }
      } catch (error) {
        console.error('Error editing switch_api_menu message:', error.message);
      }

      try {
        await bot.answerCallbackQuery(callbackQuery.id);
      } catch (error) {
        // Ignore callback answer errors
      }
    }

    // Status checker untuk semua handler
    if (data === 'status_all_handler') {
      try {
        const bekasamPath = path.join(__dirname, '../../menu/bekasan');
        const bulananPath = path.join(__dirname, '../../menu/bulanan');
        
        // Check file existence
        const bekasamActive = fs.existsSync(path.join(bekasamPath, 'handler_bekasan.js'));
        const bekasamKhfy = fs.existsSync(path.join(bekasamPath, 'handler_bekasan_khfy.js'));
        const bekasamHide = fs.existsSync(path.join(bekasamPath, 'handler_bekasan_hide.js'));
        
        const bulananActive = fs.existsSync(path.join(bulananPath, 'handler_bulanan.js'));
        const bulananKhfy = fs.existsSync(path.join(bulananPath, 'handler_bulanan_khfy.js'));
        const bulananHide = fs.existsSync(path.join(bulananPath, 'handler_bulanan_hide.js'));

        // Determine active API
        let activeAPI = 'UNKNOWN';
        if (bekasamActive && bulananActive) {
          // Try to determine from available backup files
          if (bekasamKhfy && bulananKhfy) {
            activeAPI = 'HIDE API ⚪';
          } else if (bekasamHide && bulananHide) {
            activeAPI = 'KHFY API 🟢';
          } else {
            activeAPI = 'TIDAK DIKETAHUI ❓';
          }
        }

        const content = `❗ <b>STATUS HANDLER FILES</b>\n\n` +
          `🔄 <b>API Aktif:</b> ${activeAPI}\n\n` +
          `📁 <b>BEKASAN HANDLER:</b>\n` +
          `${bekasamActive ? '✅' : '❌'} handler_bekasan.js (AKTIF)\n` +
          `${bekasamKhfy ? '📂' : '❌'} handler_bekasan_khfy.js (BACKUP)\n` +
          `${bekasamHide ? '📂' : '❌'} handler_bekasan_hide.js (BACKUP)\n\n` +
          `📁 <b>BULANAN HANDLER:</b>\n` +
          `${bulananActive ? '✅' : '❌'} handler_bulanan.js (AKTIF)\n` +
          `${bulananKhfy ? '📂' : '❌'} handler_bulanan_khfy.js (BACKUP)\n` +
          `${bulananHide ? '📂' : '❌'} handler_bulanan_hide.js (BACKUP)\n\n` +
          `💡 <b>Keterangan:</b>\n` +
          `✅ File aktif digunakan\n` +
          `📂 File backup tersedia\n` +
          `❌ File tidak ada`;

        if (message.caption) {
          // Message has photo, edit caption
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 KEMBALI', callback_data: 'switch_api_menu' }]
              ]
            }
          });
        } else {
          // Message has text, edit text
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 KEMBALI', callback_data: 'switch_api_menu' }]
              ]
            }
          });
        }

      } catch (error) {
        const errorContent = `❌ <b>ERROR STATUS CHECK</b>\n\n${error.message}`;
        try {
          if (message.caption) {
            await bot.editMessageCaption(errorContent, {
              chat_id: chatId,
              message_id: message.message_id,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔙 KEMBALI', callback_data: 'switch_api_menu' }]
                ]
              }
            });
          } else {
            await bot.editMessageText(errorContent, {
              chat_id: chatId,
              message_id: message.message_id,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔙 KEMBALI', callback_data: 'switch_api_menu' }]
                ]
              }
            });
          }
        } catch (editError) {
          console.error('Error editing error message:', editError.message);
        }
      }

      try {
        await bot.answerCallbackQuery(callbackQuery.id);
      } catch (error) {
        // Ignore callback answer errors
      }
    }
  });

  // Load semua sub-tools SWITCH handler
  try {
    require('./switch_handler/use_khfy_handler')(bot);
    require('./switch_handler/use_hide_handler')(bot);
  } catch (error) {
    // Error dihandle secara silent - file akan dibuat
    console.error('Error loading switch API modules:', error.message);
    console.log('📁 Pastikan folder switch_handler/ dan file-filenya sudah dibuat:');
    console.log('   - ./switch_handler/use_khfy_handler.js');
    console.log('   - ./switch_handler/use_hide_handler.js');
  }
};
