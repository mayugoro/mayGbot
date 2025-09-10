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
        
        // Check file existence untuk swap system
        const bekasamActive = fs.existsSync(path.join(bekasamPath, 'handler_bekasan.js'));
        const bulananActive = fs.existsSync(path.join(bulananPath, 'handler_bulanan.js'));

        // Determine active API by reading file content
        let activeAPI = '';
        let inactiveAPI = '';
        
        try {
          if (bekasamActive && bulananActive) {
            const bekasamContent = fs.readFileSync(path.join(bekasamPath, 'handler_bekasan.js'), 'utf8');
            const bulananContent = fs.readFileSync(path.join(bulananPath, 'handler_bulanan.js'), 'utf8');
            
            // Check first line comment for API type
            const bekasamFirstLine = bekasamContent.split('\n')[0];
            const bulananFirstLine = bulananContent.split('\n')[0];
            
            if (bekasamFirstLine.includes('INI API HIDEPULSA') || bulananFirstLine.includes('INI API HIDEPULSA')) {
              activeAPI = '⚪ HIDE';
              inactiveAPI = '🟢 KHFY';
            } else if (bekasamFirstLine.includes('INI API KHFY STORE') || bulananFirstLine.includes('INI API KHFY STORE')) {
              activeAPI = '🟢 KHFY';
              inactiveAPI = '⚪ HIDE';
            } else {
              // Fallback check dengan URL detection
              if (bekasamContent.includes('api.hidepulsa.com') || bulananContent.includes('api.hidepulsa.com')) {
                activeAPI = '⚪ HIDE';
                inactiveAPI = '🟢 KHFY';
              } else if (bekasamContent.includes('khairilpedia.com') || bulananContent.includes('khairilpedia.com')) {
                activeAPI = '🟢 KHFY';
                inactiveAPI = '⚪ HIDE';
              } else {
                activeAPI = '❓ TIDAK DIKETAHUI';
                inactiveAPI = '❓ TIDAK DIKETAHUI';
              }
            }
          } else {
            activeAPI = '❌ FILE TIDAK ADA';
            inactiveAPI = '❌ FILE TIDAK ADA';
          }
        } catch (error) {
          activeAPI = '❌ ERROR READING FILE';
          inactiveAPI = '❌ ERROR READING FILE';
        }

        const content = `SEDANG MENGGUNAKAN API DARI handler_bekasan.js & handler_bulanan.js\n\n` +
          `API DIGUNAKAN: ${activeAPI}\n` +
          `API DIISTIRAHATKAN: ${inactiveAPI}`;

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
