const fs = require('fs');
const path = require('path');

module.exports = (bot) => {
  // Handle switch ke HIDE API
  bot.on('callback_query', async (callbackQuery) => {
    const { data, from, message } = callbackQuery;
    const chatId = message?.chat?.id;
    const userId = from.id;

    if (data === 'switch_hide_menu') {
      try {
        // Path ke file handler
        const bekasamPath = path.join(__dirname, '../../../menu/bekasan');
        const bulananPath = path.join(__dirname, '../../../menu/bulanan');
        
        // File yang akan direname
        const bekasamOld = path.join(bekasamPath, 'handler_bekasan.js');
        const bekasamNew = path.join(bekasamPath, 'handler_bekasan_khfy.js');
        const bekasamHide = path.join(bekasamPath, 'handler_bekasan_hide.js');
        const bekasamTarget = path.join(bekasamPath, 'handler_bekasan.js');
        
        const bulananOld = path.join(bulananPath, 'handler_bulanan.js');
        const bulananNew = path.join(bulananPath, 'handler_bulanan_khfy.js');
        const bulananHide = path.join(bulananPath, 'handler_bulanan_hide.js');
        const bulananTarget = path.join(bulananPath, 'handler_bulanan.js');

        let messages = [];
        
        // === SWITCH BEKASAN HANDLER ===
        if (fs.existsSync(bekasamOld)) {
          // Backup current handler as KHFY version
          fs.renameSync(bekasamOld, bekasamNew);
          messages.push('✅ Backup handler_bekasan.js → handler_bekasan_khfy.js');
        }
        
        if (fs.existsSync(bekasamHide)) {
          // Activate HIDE handler
          fs.renameSync(bekasamHide, bekasamTarget);
          messages.push('⚪ Aktivasi handler_bekasan_hide.js → handler_bekasan.js');
        } else {
          messages.push('⚠️ File handler_bekasan_hide.js tidak ditemukan');
        }

        // === SWITCH BULANAN HANDLER ===
        if (fs.existsSync(bulananOld)) {
          // Backup current handler as KHFY version
          fs.renameSync(bulananOld, bulananNew);
          messages.push('✅ Backup handler_bulanan.js → handler_bulanan_khfy.js');
        }
        
        if (fs.existsSync(bulananHide)) {
          // Activate HIDE handler
          fs.renameSync(bulananHide, bulananTarget);
          messages.push('⚪ Aktivasi handler_bulanan_hide.js → handler_bulanan.js');
        } else {
          messages.push('⚠️ File handler_bulanan_hide.js tidak ditemukan');
        }

        // Send result
        const resultContent = `⚪ <b>SWITCH KE HIDE API</b>\n\n${messages.join('\n')}\n\n⚡ <b>Status:</b> Bot sekarang menggunakan HIDE API\n💡 <b>Info:</b> Restart bot untuk menerapkan perubahan`;
        
        if (message.caption) {
          // Message has photo, edit caption
          await bot.editMessageCaption(resultContent, {
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
          await bot.editMessageText(resultContent, {
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
        const errorContent = `❌ <b>ERROR SWITCH KE HIDE</b>\n\n${error.message}\n\n🔧 Periksa struktur file dan permission`;
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
};