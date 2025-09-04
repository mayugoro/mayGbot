// 🌍 MIN SALDO GLOBAL
// Handler khusus untuk mengatur minimal saldo akses menu global
// File ini dimuat secara dinamis oleh biaya_operasi.js

const { getKonfigurasi, setKonfigurasi } = require('../../../../db');

const adminState = new Map();

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (data === 'set_min_saldo_global') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      try {
        const currentValue = await getKonfigurasi('min_saldo_global');
        const currentSaldo = currentValue ? parseInt(currentValue) : 150000;
        
        adminState.set(chatId, { 
          mode: 'set_min_saldo_global', 
          menuMessageId: msgId 
        });
        
        const inputMsg = await bot.sendMessage(chatId, 
          `🌍 <b>SET MIN SALDO GLOBAL</b>\n\n` +
          `💳 <b>Minimal saldo saat ini:</b> Rp. ${currentSaldo.toLocaleString('id-ID')}\n\n` +
          `💡 Masukkan minimal saldo baru untuk akses menu global:\n\n` +
          `📝 <b>Catatan:</b>\n` +
          `• Masukkan angka saja (tanpa "Rp." atau titik)\n` +
          `• Contoh: 150000 untuk Rp. 150.000\n\n` +
          `💡 Ketik "exit" untuk membatalkan.`, {
          parse_mode: 'HTML'
        });
        
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        console.error('Error getting min saldo global:', e);
        await bot.answerCallbackQuery(id, { 
          text: '❌ Gagal memuat data minimal saldo global.', 
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
    if (!state || state.mode !== 'set_min_saldo_global') return;

    // === CEK CANCEL/EXIT ===
    if (['exit', 'EXIT', 'Exit'].includes(msg.text.trim())) {
      try {
        await bot.deleteMessage(chatId, state.inputMessageId);
      } catch (e) {}
      
      adminState.delete(chatId);
      await bot.deleteMessage(chatId, msg.message_id);
      return;
    }

    const nilai = parseFloat(msg.text.trim());
    if (isNaN(nilai) || nilai < 0) {
      await bot.sendMessage(chatId, '❌ Format nilai salah! Masukkan angka yang valid (minimal 0).');
      await bot.deleteMessage(chatId, msg.message_id);
      return;
    }

    try {
      await setKonfigurasi('min_saldo_global', nilai.toString());

      const successMessage = `✅ Minimal saldo global berhasil diubah menjadi Rp. ${nilai.toLocaleString('id-ID')}`;

      if (state.inputMessageId) {
        try {
          await bot.editMessageText(successMessage, {
            chat_id: chatId,
            message_id: state.inputMessageId
          });
        } catch (e) {
          await bot.sendMessage(chatId, successMessage);
        }
      } else {
        await bot.sendMessage(chatId, successMessage);
      }
      
      // Auto delete notifikasi hasil setelah 2 detik
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {}
      }, 2000);
      
    } catch (e) {
      const errorMessage = `❌ Gagal mengubah minimal saldo global: ${e.message}`;
      
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
