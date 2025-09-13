const { tambahSaldo } = require('../../db');

// Import utils EXITER untuk input yang konsisten dan aman
const { 
  sendStyledInputMessage,
  autoDeleteMessage,
  handleExitWithAutoDelete,
  EXIT_KEYWORDS
} = require('../../utils/exiter');

const adminState = new Map();

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (data === 'tambah_saldo') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }
      adminState.set(chatId, { mode: 'tambah_saldo', step: 'input_id', menuMessageId: msgId });
      
      // Input form dengan exiter pattern
      const inputMsg = await sendStyledInputMessage(bot, chatId,
        '📝 Masukkan ID user yang akan ditambah saldonya',
        '',
        'membatalkan'
      );
      
      // Simpan message ID untuk bisa dihapus nanti
      const currentState = adminState.get(chatId);
      currentState.inputMessageId = inputMsg.message_id;
      adminState.set(chatId, currentState);
      
      await bot.answerCallbackQuery(id);
    }
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;

    const state = adminState.get(chatId);
    if (!state || state.mode !== 'tambah_saldo') return;

    // Step 1: input user id
    if (state.step === 'input_id') {
      // Exit handling khusus untuk step 1
      if (EXIT_KEYWORDS.COMBINED.includes(msg.text.trim())) {
        autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
        autoDeleteMessage(bot, chatId, msg.message_id, 100);
        adminState.delete(chatId);
        return;
      }
      
      state.userId = msg.text.trim();
      state.step = 'input_jumlah';
      adminState.set(chatId, state);
      
      // Hapus pesan sebelumnya dengan exiter autoDeleteMessage yang aman
      autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
      autoDeleteMessage(bot, chatId, msg.message_id, 100);
      
      // Input form step 2 dengan exiter pattern
      const jumlahMsg = await sendStyledInputMessage(bot, chatId,
        '💰 Masukkan jumlah saldo yang akan ditambahkan',
        '',
        'membatalkan'
      );
      state.inputMessageId = jumlahMsg.message_id;
      adminState.set(chatId, state);
      return;
    }
    
    // Step 2: input jumlah saldo
    if (state.step === 'input_jumlah') {
      // Exit handling khusus untuk step 2
      if (EXIT_KEYWORDS.COMBINED.includes(msg.text.trim())) {
        autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
        autoDeleteMessage(bot, chatId, msg.message_id, 100);
        adminState.delete(chatId);
        return;
      }
      
      const jumlah = parseFloat(msg.text.trim());
      if (isNaN(jumlah) || jumlah <= 0) {
        // Error message dengan auto delete
        const errorMsg = await bot.sendMessage(chatId, '❌ Format jumlah salah! Masukkan angka yang valid.');
        autoDeleteMessage(bot, chatId, errorMsg.message_id, 3000);
        autoDeleteMessage(bot, chatId, msg.message_id, 100);
        return;
      }
      
      state.jumlah = jumlah;
      state.step = 'input_pesan';
      adminState.set(chatId, state);
      
      // Hapus pesan sebelumnya dengan exiter autoDeleteMessage yang aman
      autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
      autoDeleteMessage(bot, chatId, msg.message_id, 100);
      
      // Input form step 3 dengan exiter pattern
      const pesanMsg = await sendStyledInputMessage(bot, chatId,
        '💬 Masukkan pesan untuk user (opsional)',
        'Ketik "skip" untuk lewati',
        'membatalkan'
      );
      state.inputMessageId = pesanMsg.message_id;
      adminState.set(chatId, state);
      return;
    }

    // Step 3: input pesan untuk user
    if (state.step === 'input_pesan') {
      // Exit handling khusus untuk step 3
      if (EXIT_KEYWORDS.COMBINED.includes(msg.text.trim())) {
        autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
        autoDeleteMessage(bot, chatId, msg.message_id, 100);
        adminState.delete(chatId);
        return;
      }
      
      const pesanUser = msg.text.trim() === 'skip' ? '' : msg.text.trim();
      
      // Hapus pesan sebelumnya dengan exiter autoDeleteMessage yang aman
      autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
      autoDeleteMessage(bot, chatId, msg.message_id, 100);
      
      try {
        await tambahSaldo(state.userId, state.jumlah);
        
        // Kirim notifikasi ke user
        try {
          let notifText = `🎉 <b>Saldo Ditambahkan!</b>\n\n💰 Saldo Anda telah ditambahkan sebesar <code>Rp. ${state.jumlah.toLocaleString('id-ID')}</code>`;
          if (pesanUser) {
            notifText += `\n\n📝 <b>Pesan:</b> ${pesanUser}`;
          }
          notifText += `\n\n✨ Terima kasih!`;
          
          await bot.sendMessage(state.userId, notifText, {
            parse_mode: 'HTML'
          });
        } catch (e) {
          console.log('User tidak dapat menerima pesan privat');
        }
        
        let teksHasil = `✅ Saldo user <code>${state.userId}</code> berhasil DITAMBAH sebesar Rp. ${state.jumlah.toLocaleString('id-ID')}.`;
        
        // Kirim hasil dengan auto delete menggunakan exiter
        const hasilMsg = await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
        autoDeleteMessage(bot, chatId, hasilMsg.message_id, 20000);
        
      } catch (e) {
        let teksError = `❌ Gagal update saldo: ${e.message}`;
        
        // Kirim error dengan auto delete menggunakan exiter
        const errorMsg = await bot.sendMessage(chatId, teksError);
        autoDeleteMessage(bot, chatId, errorMsg.message_id, 20000);
      }
      
      adminState.delete(chatId);
      return;
    }
  });
};
