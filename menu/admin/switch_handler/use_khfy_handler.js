const fs = require('fs');
const path = require('path');

module.exports = (bot) => {
  // Handle switch ke KHFY API
  bot.on('callback_query', async (callbackQuery) => {
    const { data, from, message } = callbackQuery;
    const chatId = message?.chat?.id;
    const userId = from.id;

    if (data === 'switch_khfy_menu') {
      try {
        // Path ke file handler
        const bekasamPath = path.join(__dirname, '../../../menu/bekasan');
        const bulananPath = path.join(__dirname, '../../../menu/bulanan');
        
        // File yang akan direname
        const bekasamOld = path.join(bekasamPath, 'handler_bekasan.js');
        const bekasamNew = path.join(bekasamPath, 'handler_bekasan_hide.js');
        const bekasamKhfy = path.join(bekasamPath, 'handler_bekasan_khfy.js');
        const bekasamTarget = path.join(bekasamPath, 'handler_bekasan.js');
        
        const bulananOld = path.join(bulananPath, 'handler_bulanan.js');
        const bulananNew = path.join(bulananPath, 'handler_bulanan_hide.js');
        const bulananKhfy = path.join(bulananPath, 'handler_bulanan_khfy.js');
        const bulananTarget = path.join(bulananPath, 'handler_bulanan.js');

        let messages = [];
        
        // === SWITCH BEKASAN HANDLER ===
        if (fs.existsSync(bekasamOld)) {
          // Backup current handler as HIDE version
          fs.renameSync(bekasamOld, bekasamNew);
          messages.push('✅ Backup handler_bekasan.js → handler_bekasan_hide.js');
        }
        
        if (fs.existsSync(bekasamKhfy)) {
          // Activate KHFY handler
          fs.renameSync(bekasamKhfy, bekasamTarget);
          messages.push('🟢 Aktivasi handler_bekasan_khfy.js → handler_bekasan.js');
        } else {
          messages.push('⚠️ File handler_bekasan_khfy.js tidak ditemukan');
        }

        // === SWITCH BULANAN HANDLER ===
        if (fs.existsSync(bulananOld)) {
          // Backup current handler as HIDE version
          fs.renameSync(bulananOld, bulananNew);
          messages.push('✅ Backup handler_bulanan.js → handler_bulanan_hide.js');
        }
        
        if (fs.existsSync(bulananKhfy)) {
          // Activate KHFY handler
          fs.renameSync(bulananKhfy, bulananTarget);
          messages.push('🟢 Aktivasi handler_bulanan_khfy.js → handler_bulanan.js');
        } else {
          messages.push('⚠️ File handler_bulanan_khfy.js tidak ditemukan');
        }

        // Send result
        await bot.editMessageText(
          `🟢 <b>SWITCH KE KHFY API</b>\n\n${messages.join('\n')}\n\n⚡ <b>Status:</b> Bot sekarang menggunakan KHFY API\n💡 <b>Info:</b> Restart bot untuk menerapkan perubahan`,
          {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 KEMBALI', callback_data: 'switch_api_menu' }]
              ]
            }
          }
        );

      } catch (error) {
        await bot.editMessageText(
          `❌ <b>ERROR SWITCH KE KHFY</b>\n\n${error.message}\n\n🔧 Periksa struktur file dan permission`,
          {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 KEMBALI', callback_data: 'switch_api_menu' }]
              ]
            }
          }
        );
      }

      try {
        await bot.answerCallbackQuery(callbackQuery.id);
      } catch (error) {
        // Ignore callback answer errors
      }
    }
  });
};