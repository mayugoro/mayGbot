// 💰 MIN SALDO BEKASAN
// Handler khusus untuk mengatur minimal saldo akses menu bekasan
// File ini dimuat secara dinamis oleh biaya_operasi.js

const { getKonfigurasi, setKonfigurasi } = require('../../../../db');
// Import Input Exiter utilities untuk modern pattern
const { sendStyledInputMessage, autoDeleteMessage, EXIT_KEYWORDS } = require('../../../../utils/exiter');

const adminState = new Map();

// Function untuk generate input form menggunakan modern Input Exiter pattern
const generateMinSaldoBekezanInputMessage = (currentSaldo) => {
  const mainText = `💰 SET MIN SALDO BEKASAN\n\nMinimal saldo saat ini: Rp. ${currentSaldo.toLocaleString('id-ID')}`;
  const subtitle = `Masukkan minimal saldo baru untuk akses menu bekasan:\n💡 Masukkan angka saja (contoh: 5000)`;
  
  return { mainText, subtitle };
};

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (data === 'set_min_saldo_bekasan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      try {
        const currentValue = await getKonfigurasi('min_saldo_bekasan');
        const currentSaldo = currentValue ? parseInt(currentValue) : 5000;
        
        // Set state untuk input exiter (gunakan from.id yang konsistent)
        adminState.set(from.id, { type: 'min_saldo_bekasan' });
        
        // Kirim styled input message menggunakan modern utility
        const inputMessage = generateMinSaldoBekezanInputMessage(currentSaldo);
        const inputMsg = await sendStyledInputMessage(bot, chatId, inputMessage.mainText, inputMessage.subtitle);
        
        // Track input message untuk cleanup saat exit
        const currentState = adminState.get(from.id);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(from.id, currentState);
        
      } catch (e) {
        console.error('Error getting min saldo bekasan:', e);
        await bot.answerCallbackQuery(id, { 
          text: '❌ Gagal memuat data minimal saldo bekasan.', 
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

    const state = adminState.get(msg.from.id);
    if (!state || state.type !== 'min_saldo_bekasan') return;

    const userInput = msg.text.trim();
    
    // Check modern exit keywords
    if (EXIT_KEYWORDS.COMBINED.includes(userInput)) {
      // Cleanup input message jika ada
      if (state.inputMessageId) {
        await autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
      }
      adminState.delete(msg.from.id);
      await autoDeleteMessage(bot, chatId, msg.message_id, 100);
      return;
    }

    const nilai = parseFloat(userInput);
    if (isNaN(nilai) || nilai < 0) {
      const errorMsg = await bot.sendMessage(chatId, '❌ Format nilai salah! Masukkan angka yang valid (minimal 0).');
      await autoDeleteMessage(bot, chatId, errorMsg.message_id, 2000);
      await autoDeleteMessage(bot, chatId, msg.message_id, 100);
      return;
    }

    try {
      await setKonfigurasi('min_saldo_bekasan', nilai.toString());

      // Konfirmasi berhasil
      const successMsg = await bot.sendMessage(chatId, `✅ Minimal saldo bekasan berhasil diubah menjadi Rp. ${nilai.toLocaleString('id-ID')}`);
      await autoDeleteMessage(bot, chatId, successMsg.message_id, 3000);
      
    } catch (e) {
      const errorMsg = await bot.sendMessage(chatId, `❌ Gagal mengubah minimal saldo bekasan: ${e.message}`);
      await autoDeleteMessage(bot, chatId, errorMsg.message_id, 2000);
    }
    
    // Cleanup
    adminState.delete(msg.from.id);
    await autoDeleteMessage(bot, chatId, msg.message_id, 100);
    return;
  });
};
