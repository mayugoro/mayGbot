// 📝 PESAN TOLAK BEKASAN
// Handler khusus untuk mengatur pesan penolakan akses menu bekasan
// File ini dimuat secara dinamis oleh biaya_operasi.js

const { getKonfigurasi, setKonfigurasi } = require('../../../../db');

const adminState = new Map();

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (data === 'set_pesan_bekasan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      try {
        const currentValue = await getKonfigurasi('pesan_tolak_bekasan');
        const currentPesan = currentValue || 'Saldo tidak cukup untuk akses menu ini\\n\\n⏤͟͟ᴍᴀʏᴜɢᴏʀᴏ';
        
        adminState.set(chatId, { 
          mode: 'set_pesan_bekasan', 
          menuMessageId: msgId 
        });
        
        const inputMsg = await bot.sendMessage(chatId, 
          `📝 <b>SET PESAN TOLAK BEKASAN</b>\n\n` +
          `💬 <b>Pesan saat ini:</b>\n${currentPesan}\n\n` +
          `💡 Masukkan pesan baru yang akan muncul saat user tidak punya saldo cukup untuk akses bekasan:\n\n` +
          `📝 <b>Catatan:</b>\n` +
          `• Gunakan \\n untuk baris baru\n` +
          `• Maksimal 200 karakter\n` +
          `• Contoh: "Saldo tidak cukup!\\nMinimal Rp. 5.000"\n\n` +
          `💡 Ketik "exit" untuk membatalkan.`, {
          parse_mode: 'HTML'
        });
        
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        console.error('Error getting pesan bekasan:', e);
        await bot.answerCallbackQuery(id, { 
          text: '❌ Gagal memuat data pesan bekasan.', 
          show_alert: true 
        });
        return;
      }
      
      await bot.answerCallbackQuery(id);
      return;
    }
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;

    const state = adminState.get(chatId);
    if (!state || state.mode !== 'set_pesan_bekasan') return;

    // === CEK CANCEL/EXIT ===
    if (['exit', 'EXIT', 'Exit'].includes(msg.text.trim())) {
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {}
      }
      
      adminState.delete(chatId);
      await bot.deleteMessage(chatId, msg.message_id);
      return;
    }

    const pesan = msg.text.trim();
    
    if (pesan.length > 200) {
      await bot.sendMessage(chatId, '❌ Pesan terlalu panjang! Maksimal 200 karakter.');
      await bot.deleteMessage(chatId, msg.message_id);
      return;
    }

    try {
      await setKonfigurasi('pesan_tolak_bekasan', pesan);

      const successMessage = `✅ Pesan tolak bekasan berhasil diubah menjadi:\n${pesan}`;

      if (state.inputMessageId) {
        try {
          await bot.editMessageText(successMessage, {
            chat_id: chatId,
            message_id: state.inputMessageId,
            parse_mode: 'HTML'
          });
        } catch (e) {
          await bot.sendMessage(chatId, successMessage, { parse_mode: 'HTML' });
        }
      } else {
        await bot.sendMessage(chatId, successMessage, { parse_mode: 'HTML' });
      }
      
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {}
      }, 3000);
      
    } catch (e) {
      const errorMessage = `❌ Gagal mengubah pesan: ${e.message}`;
      
      if (state.inputMessageId) {
        try {
          await bot.editMessageText(errorMessage, {
            chat_id: chatId,
            message_id: state.inputMessageId
          });
        } catch (e) {
          await bot.sendMessage(chatId, errorMessage);
        }
      } else {
        await bot.sendMessage(chatId, errorMessage);
      }
      
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {}
      }, 2000);
    }
    
    adminState.delete(chatId);
    await bot.deleteMessage(chatId, msg.message_id);
    return;
  });
};
