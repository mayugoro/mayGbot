// Handler untuk proses pembelian bulanan global
// Berinteraksi dengan API AKRAB GLOBAL untuk pembelian paket

const axios = require('axios');

// State management untuk bulanan global
const stateBulananGlobal = {};

// Function untuk set state
function setStateBulananGlobal(chatId, state) {
  stateBulananGlobal[chatId] = state;
}

// Function untuk get state
function getStateBulananGlobal(chatId) {
  return stateBulananGlobal[chatId] || null;
}

// Function untuk clear state
function clearStateBulananGlobal(chatId) {
  delete stateBulananGlobal[chatId];
}

module.exports = (bot) => {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const state = getStateBulananGlobal(chatId);

    if (!state) return;

    try {
      // Handle input nomor HP untuk bulanan global
      if (state.step === 'input_nomor_global') {
        // Validasi nomor HP
        const cleanNumber = text.replace(/\D/g, '');
        
        if (cleanNumber.length < 10 || cleanNumber.length > 15) {
          await bot.sendMessage(chatId, '❌ <b>Format nomor tidak valid!</b>\n\nContoh format yang benar:\n• 081234567890\n• 08123456789\n• +6281234567890', {
            parse_mode: 'HTML'
          });
          return;
        }

        // Format nomor HP (hapus awalan +62, ganti dengan 0)
        let nomorHP = cleanNumber;
        if (nomorHP.startsWith('62')) {
          nomorHP = '0' + nomorHP.substring(2);
        }
        if (!nomorHP.startsWith('0')) {
          nomorHP = '0' + nomorHP;
        }

        // Update state dengan nomor HP
        state.nomorHP = nomorHP;
        state.step = 'konfirmasi_global';

        // Hapus message nomor HP user untuk privacy
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {
          // Ignore error jika tidak bisa delete
        }

        // Tampilkan konfirmasi pembelian
        const { getKonfigurasi } = require('../../../db');
        const harga = await getKonfigurasi(`harga_global_${state.paket}`) || await getKonfigurasi(`harga_${state.paket}`);
        const hargaValue = harga ? parseInt(harga) : 0;

        const paketNames = {
          'supermini': 'SUPERMINI PROMO',
          'megabig': 'MEGABIG', 
          'mini': 'MINI',
          'big': 'BIG',
          'jumbo': 'JUMBO V2',
          'bigplus': 'BIG PLUS'
        };

        const paketName = paketNames[state.paket] || state.paket.toUpperCase();

        const confirmText = `🌍 <b>KONFIRMASI PEMBELIAN GLOBAL</b>\n\n` +
          `📦 <b>Paket:</b> ${paketName}\n` +
          `📱 <b>Nomor:</b> <code>${nomorHP}</code>\n` +
          `💰 <b>Harga:</b> Rp. ${hargaValue.toLocaleString('id-ID')}\n` +
          `🌐 <b>Provider:</b> AKRAB GLOBAL\n\n` +
          `💡 <i>Pastikan nomor sudah benar sebelum melanjutkan!</i>`;

        const keyboard = [
          [
            { text: '✅ KONFIRMASI BELI', callback_data: `confirm_buy_global_${state.paket}` },
            { text: '❌ BATALKAN', callback_data: 'cancel_buy_global' }
          ]
        ];

        await bot.sendMessage(chatId, confirmText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });

        return;
      }

    } catch (error) {
      console.error('Error in bulanan global handler:', error);
      await bot.sendMessage(chatId, '❌ Terjadi kesalahan sistem. Silakan coba lagi.', {
        parse_mode: 'HTML'
      });
      clearStateBulananGlobal(chatId);
    }
  });

  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const state = getStateBulananGlobal(chatId);

    try {
      // Handle pilih slot global (dari list_bulanan_global.js)
      if (state && state.step === 'pilih_slot_global') {
        // Hapus loading message
        if (state.loadingMessageId) {
          try {
            await bot.deleteMessage(chatId, state.loadingMessageId);
          } catch (e) {}
        }

        // Update state ke input nomor
        state.step = 'input_nomor_global';

        const inputText = `🌍 <b>INPUT NOMOR HP</b>\n\n` +
          `📝 Silakan masukkan nomor HP yang akan diisi paket:\n\n` +
          `💡 <b>Format yang diterima:</b>\n` +
          `• 081234567890\n` +
          `• 08123456789\n` +
          `• +6281234567890\n\n` +
          `⚠️ <i>Pastikan nomor aktif dan benar!</i>`;

        await bot.sendMessage(chatId, inputText, {
          parse_mode: 'HTML'
        });

        await bot.answerCallbackQuery(id);
        return;
      }

      // Handle konfirmasi pembelian global
      if (/^confirm_buy_global_/.test(data)) {
        if (!state || state.step !== 'konfirmasi_global') {
          return bot.answerCallbackQuery(id, {
            text: '❌ Session expired, silakan mulai lagi',
            show_alert: true
          });
        }

        // TODO: Implementasi API call ke AKRAB GLOBAL untuk pembelian
        // Sementara ini simulasi
        await bot.answerCallbackQuery(id, {
          text: '🔄 Memproses pembelian global...',
          show_alert: false
        });

        const prosesText = `🌍 <b>MEMPROSES PEMBELIAN GLOBAL</b>\n\n` +
          `📦 Paket: ${state.paket.toUpperCase()}\n` +
          `📱 Nomor: ${state.nomorHP}\n` +
          `🔄 Status: Sedang diproses...\n\n` +
          `⏳ <i>Mohon tunggu, proses membutuhkan waktu 1-3 menit</i>`;

        await bot.editMessageText(prosesText, {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: 'HTML'
        });

        // Clear state
        clearStateBulananGlobal(chatId);
        return;
      }

      // Handle batalkan pembelian global
      if (data === 'cancel_buy_global') {
        if (state) {
          clearStateBulananGlobal(chatId);
        }

        await bot.editMessageText('❌ <b>Pembelian dibatalkan</b>\n\nSilakan pilih paket lain jika diperlukan.', {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: 'HTML'
        });

        await bot.answerCallbackQuery(id, {
          text: 'Pembelian dibatalkan',
          show_alert: false
        });
        return;
      }

    } catch (error) {
      console.error('Error in bulanan global callback:', error);
      await bot.answerCallbackQuery(id, {
        text: '❌ Terjadi kesalahan sistem',
        show_alert: true
      });
      
      if (state) {
        clearStateBulananGlobal(chatId);
      }
    }
  });
};

// Export functions
module.exports.setStateBulananGlobal = setStateBulananGlobal;
module.exports.getStateBulananGlobal = getStateBulananGlobal;
module.exports.clearStateBulananGlobal = clearStateBulananGlobal;

// === END OF BULANAN GLOBAL HANDLER ===
