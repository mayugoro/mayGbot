// ❌ BIAYA TRX GAGAL
// Handler khusus untuk mengatur biaya transaksi yang gagal
// File ini dimuat secara dinamis oleh biaya_operasi.js

const { getKonfigurasi, setKonfigurasi } = require('../../../../db');
// Import Input Exiter utilities untuk modern pattern
const { sendStyledInputMessage, autoDeleteMessage, EXIT_KEYWORDS } = require('../../../../utils/exiter');

const adminState = new Map();

// Function untuk generate input form menggunakan modern Input Exiter pattern
const generateBiayaGagalInputMessage = (currentBiaya) => {
  const mainText = `❌ SET BIAYA TRX GAGAL\n\nBiaya saat ini: Rp. ${currentBiaya.toLocaleString('id-ID')}`;
  const subtitle = `Masukkan biaya baru untuk transaksi yang gagal:\n💡 Masukkan angka saja (contoh: 700)\n💡 Ketik 0 untuk tidak ada biaya gagal`;
  
  return { mainText, subtitle };
};

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (data === 'set_biaya_gagal') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      try {
        // Ambil nilai saat ini dari database
        const currentValue = await getKonfigurasi('harga_gagal');
        const currentBiaya = currentValue ? parseInt(currentValue) : 0;
        
        // Set state untuk input exiter (gunakan from.id yang konsistent)
        adminState.set(from.id, { type: 'biaya_gagal' });
        
        // Kirim styled input message menggunakan modern utility
        const inputMessage = generateBiayaGagalInputMessage(currentBiaya);
        const inputMsg = await sendStyledInputMessage(bot, chatId, inputMessage.mainText, inputMessage.subtitle);
        
        // Track input message untuk cleanup saat exit
        const currentState = adminState.get(from.id);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(from.id, currentState);
        
      } catch (e) {
        console.error('Error getting biaya gagal:', e);
        await bot.answerCallbackQuery(id, { 
          text: '❌ Gagal memuat data biaya gagal.', 
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
    if (!state || state.type !== 'biaya_gagal') return;

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
      // Update konfigurasi
      await setKonfigurasi('harga_gagal', nilai.toString());

      // Konfirmasi berhasil
      const successMsg = await bot.sendMessage(chatId, `✅ Biaya transaksi gagal berhasil diubah menjadi Rp. ${nilai.toLocaleString('id-ID')}`);
      await autoDeleteMessage(bot, chatId, successMsg.message_id, 3000);
      
    } catch (e) {
      const errorMsg = await bot.sendMessage(chatId, `❌ Gagal mengubah biaya gagal: ${e.message}`);
      await autoDeleteMessage(bot, chatId, errorMsg.message_id, 2000);
    }
    
    // Cleanup
    adminState.delete(msg.from.id);
    await autoDeleteMessage(bot, chatId, msg.message_id, 100);
    return;
  });
};
