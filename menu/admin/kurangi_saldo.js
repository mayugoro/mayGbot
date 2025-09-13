const { kurangiSaldo, getUserSaldo } = require('../../db');

// Import utils EXITER untuk step-by-step flow yang aman
const { 
  sendStyledInputMessage,
  autoDeleteMessage,
  handleStepByStepExit,
  transitionToNextStep,
  EXIT_KEYWORDS
} = require('../../utils/exiter');

const adminState = new Map();

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (data === 'kurangi_saldo') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }
      adminState.set(chatId, { mode: 'kurangi_saldo', step: 'input_id', menuMessageId: msgId });
      
      // Input form dengan step-by-step exiter pattern
      const inputMsg = await sendStyledInputMessage(bot, chatId,
        '📝 Masukkan ID user yang akan dikurangi saldonya',
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
    if (!state || state.mode !== 'kurangi_saldo') return;

    // Step 1: input user id
    if (state.step === 'input_id') {
      // Exit handling khusus untuk step 1
      if (await handleStepByStepExit(bot, msg, chatId, state, adminState)) {
        return;
      }
      
      state.userId = msg.text.trim();
      
      // Transisi ke step 2 dengan smooth cleanup
      await transitionToNextStep(bot, chatId, state, adminState, msg, 'input_jumlah',
        '💰 Masukkan jumlah saldo yang akan dikurangkan',
        '',
        'membatalkan'
      );
      return;
    }
    
    // Step 2: input jumlah saldo
    if (state.step === 'input_jumlah') {
      // Exit handling khusus untuk step 2
      if (await handleStepByStepExit(bot, msg, chatId, state, adminState)) {
        return;
      }
      
      const jumlah = parseFloat(msg.text.trim());
      if (isNaN(jumlah) || jumlah <= 0) {
        // Error message dengan auto delete menggunakan exiter
        const errorMsg = await bot.sendMessage(chatId, '❌ Format jumlah salah! Masukkan angka yang valid.');
        autoDeleteMessage(bot, chatId, errorMsg.message_id, 3000);
        autoDeleteMessage(bot, chatId, msg.message_id, 100);
        return;
      }
      
      state.jumlah = jumlah;
      
      // Transisi ke step 3 dengan smooth cleanup
      await transitionToNextStep(bot, chatId, state, adminState, msg, 'input_pesan',
        '💬 Masukkan pesan untuk user (opsional)',
        'Ketik "skip" untuk lewati',
        'membatalkan'
      );
      return;
    }

    // Step 3: input pesan untuk user
    if (state.step === 'input_pesan') {
      // Exit handling khusus untuk step 3
      if (await handleStepByStepExit(bot, msg, chatId, state, adminState)) {
        return;
      }
      
      const pesanUser = msg.text.trim() === 'skip' ? '' : msg.text.trim();
      
      // Hapus pesan sebelumnya dengan exiter autoDeleteMessage yang aman
      autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
      autoDeleteMessage(bot, chatId, msg.message_id, 100);
      
      try {
        // Cek saldo user sebelum dikurangi
        const saldoSekarang = await getUserSaldo(state.userId);
        if (saldoSekarang < state.jumlah) {
          let teksError = `❌ Saldo user tidak mencukupi!\nSaldo saat ini: Rp. ${saldoSekarang.toLocaleString('id-ID')}\nJumlah yang akan dikurangi: Rp. ${state.jumlah.toLocaleString('id-ID')}`;
          
          // Error message dengan auto delete menggunakan exiter
          const errorMsg = await bot.sendMessage(chatId, teksError);
          autoDeleteMessage(bot, chatId, errorMsg.message_id, 2000);
          
          adminState.delete(chatId);
          return;
        }
        
        await kurangiSaldo(state.userId, state.jumlah);
        
        // Kirim notifikasi ke user
        try {
          let notifText = `📉 <b>Saldo Dikurangi</b>\n\n💰 Saldo Anda telah dikurangi sebesar <code>Rp. ${state.jumlah.toLocaleString('id-ID')}</code>`;
          if (pesanUser) {
            notifText += `\n\n📝 <b>Pesan:</b> ${pesanUser}`;
          }
          notifText += `\n\n📞 Silakan hubungi admin jika ada pertanyaan.`;
          
          await bot.sendMessage(state.userId, notifText, {
            parse_mode: 'HTML'
          });
        } catch (e) {
          console.log('User tidak dapat menerima pesan privat');
        }
        
        let teksHasil = `✅ Saldo user <code>${state.userId}</code> berhasil DIKURANGI sebesar Rp. ${state.jumlah.toLocaleString('id-ID')}.`;
        
        // Result message dengan auto delete menggunakan exiter
        const hasilMsg = await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
        autoDeleteMessage(bot, chatId, hasilMsg.message_id, 2000);
        
      } catch (e) {
        let teksError = `❌ Gagal update saldo: ${e.message}`;
        
        // Error message dengan auto delete menggunakan exiter
        const errorMsg = await bot.sendMessage(chatId, teksError);
        autoDeleteMessage(bot, chatId, errorMsg.message_id, 2000);
      }
      
      adminState.delete(chatId);
      return;
    }
  });
};
