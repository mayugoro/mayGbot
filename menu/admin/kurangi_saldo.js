const { kurangiSaldo, getUserSaldo } = require('../../db');

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
      
      // JANGAN hapus menu, kirim input form di bawah menu
      const inputMsg = await bot.sendMessage(chatId, '📝 Masukkan ID user yang akan dikurangi saldonya:\n\n💡 Ketik "exit" untuk membatalkan.');
      
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

    // === CEK CANCEL/EXIT ===
    if (['exit', 'EXIT', 'Exit'].includes(msg.text.trim())) {
      // Hapus pesan input bot dan user
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {
          // Ignore delete error
        }
      }
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        // Ignore delete error
      }
      
      adminState.delete(chatId);
      return;
    }

    // Step 1: input user id
    if (state.step === 'input_id') {
      state.userId = msg.text.trim();
      state.step = 'input_jumlah';
      adminState.set(chatId, state);
      
      // Hapus pesan input bot dan user sebelumnya
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {
          // Ignore delete error
        }
      }
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        // Ignore delete error
      }
      
      // Kirim pesan baru untuk step selanjutnya
      const jumlahMsg = await bot.sendMessage(chatId, '💰 Masukkan jumlah saldo yang akan dikurangkan:\n\n💡 Ketik "exit" untuk membatalkan.');
      state.inputMessageId = jumlahMsg.message_id;
      adminState.set(chatId, state);
      return;
    }
    
    // Step 2: input jumlah saldo
    if (state.step === 'input_jumlah') {
      const jumlah = parseFloat(msg.text.trim());
      if (isNaN(jumlah) || jumlah <= 0) {
        await bot.sendMessage(chatId, '❌ Format jumlah salah! Masukkan angka yang valid.');
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }
      
      state.jumlah = jumlah;
      state.step = 'input_pesan';
      adminState.set(chatId, state);
      
      // Hapus pesan input bot dan user sebelumnya
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {
          // Ignore delete error
        }
      }
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        // Ignore delete error
      }
      
      // Kirim pesan baru untuk step selanjutnya
      const pesanMsg = await bot.sendMessage(chatId, '💬 Masukkan pesan untuk user (opsional, ketik "skip" untuk lewati):\n\n💡 Ketik "exit" untuk membatalkan.');
      state.inputMessageId = pesanMsg.message_id;
      adminState.set(chatId, state);
      return;
    }

    // Step 3: input pesan untuk user
    if (state.step === 'input_pesan') {
      const pesanUser = msg.text.trim() === 'skip' ? '' : msg.text.trim();
      
      // Hapus pesan input bot dan user sebelumnya
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {
          // Ignore delete error
        }
      }
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        // Ignore delete error
      }
      
      try {
        // Cek saldo user sebelum dikurangi
        const saldoSekarang = await getUserSaldo(state.userId);
        if (saldoSekarang < state.jumlah) {
          let teksError = `❌ Saldo user tidak mencukupi!\nSaldo saat ini: Rp. ${saldoSekarang.toLocaleString('id-ID')}\nJumlah yang akan dikurangi: Rp. ${state.jumlah.toLocaleString('id-ID')}`;
          
          // Kirim error yang akan hilang 2 detik
          const errorMsg = await bot.sendMessage(chatId, teksError);
          setTimeout(async () => {
            try {
              await bot.deleteMessage(chatId, errorMsg.message_id);
            } catch (e) {
              // Ignore delete error
            }
          }, 2000);
          
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
        
        // Kirim hasil yang akan hilang 2 detik
        const hasilMsg = await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
        setTimeout(async () => {
          try {
            await bot.deleteMessage(chatId, hasilMsg.message_id);
          } catch (e) {
            // Ignore delete error
          }
        }, 2000);
        
      } catch (e) {
        let teksError = `❌ Gagal update saldo: ${e.message}`;
        
        // Kirim error yang akan hilang 2 detik
        const errorMsg = await bot.sendMessage(chatId, teksError);
        setTimeout(async () => {
          try {
            await bot.deleteMessage(chatId, errorMsg.message_id);
          } catch (e) {
            // Ignore delete error
          }
        }, 2000);
      }
      
      adminState.delete(chatId);
      return;
    }
  });
};
