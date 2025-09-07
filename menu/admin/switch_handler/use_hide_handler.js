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
        // KONSEP: handler_bekasan.js ↔ handler_bekasan_old.js (swap)
        // KONSEP: handler_bulanan.js ↔ handler_bulanan_old.js (swap)
        
        let messages = [];
        
        // === SWITCH BEKASAN HANDLER ===
        const bekasamActive = path.join(bekasamPath, 'handler_bekasan.js');
        const bekasamHide = path.join(bekasamPath, 'handler_bekasan_old.js');
        const bekasamTemp = path.join(bekasamPath, 'handler_bekasan_temp.js');
        
        if (fs.existsSync(bekasamActive) && fs.existsSync(bekasamHide)) {
          // Swap files: active ↔ old
          fs.renameSync(bekasamActive, bekasamTemp);    // active → temp
          fs.renameSync(bekasamHide, bekasamActive);     // old → active (HIDE menjadi aktif)
          fs.renameSync(bekasamTemp, bekasamHide);       // temp → old (KHFY jadi backup)
          messages.push('✅ Bekasan: HIDE ↔ KHFY (swapped)');
        } else {
          messages.push('⚠️ File bekasan tidak lengkap untuk swap');
        }

        // === SWITCH BULANAN HANDLER ===
        const bulananActive = path.join(bulananPath, 'handler_bulanan.js');
        const bulananHide = path.join(bulananPath, 'handler_bulanan_old.js');
        const bulananTemp = path.join(bulananPath, 'handler_bulanan_temp.js');
        
        if (fs.existsSync(bulananActive) && fs.existsSync(bulananHide)) {
          // Swap files: active ↔ old
          fs.renameSync(bulananActive, bulananTemp);    // active → temp
          fs.renameSync(bulananHide, bulananActive);     // old → active (HIDE menjadi aktif)
          fs.renameSync(bulananTemp, bulananHide);       // temp → old (KHFY jadi backup)
          messages.push('✅ Bulanan: HIDE ↔ KHFY (swapped)');
        } else {
          messages.push('⚠️ File bulanan tidak lengkap untuk swap');
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