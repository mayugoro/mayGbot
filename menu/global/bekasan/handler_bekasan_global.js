// Handler untuk proses pembelian bekasan global
// Berinteraksi dengan API AKRAB GLOBAL untuk pembelian paket bekasan

const axios = require('axios');

// State management untuk bekasan global
const stateBekasanGlobal = {};

// Function untuk set state
function setStateBekasanGlobal(chatId, state) {
  stateBekasanGlobal[chatId] = state;
}

// Function untuk get state
function getStateBekasanGlobal(chatId) {
  return stateBekasanGlobal[chatId] || null;
}

// Function untuk clear state
function clearStateBekasanGlobal(chatId) {
  delete stateBekasanGlobal[chatId];
}

module.exports = (bot) => {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const state = getStateBekasanGlobal(chatId);

    if (!state) return;

    try {
      // Handle input nomor HP untuk bekasan global
      if (state.step === 'input_nomor_bekasan_global') {
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
        state.step = 'konfirmasi_bekasan_global';

        // Hapus message nomor HP user untuk privacy
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {
          // Ignore error jika tidak bisa delete
        }

        // Tampilkan konfirmasi pembelian bekasan
        const { getKonfigurasi } = require('../../../db');
        const harga = await getKonfigurasi(`harga_bekasan_global_${state.tipe}_${state.hari}`) || 
                     await getKonfigurasi(`harga_bekasan_${state.tipe}_${state.hari}`) ||
                     await getKonfigurasi(`harga_bekasan_${state.hari}`);
        const hargaValue = harga ? parseInt(harga) : 0;

        const tipeNames = {
          'l': 'ANGGOTA L',
          'xl': 'ANGGOTA XL',
          'xxl': 'ANGGOTA XXL'
        };

        const tipeName = tipeNames[state.tipe] || state.tipe.toUpperCase();

        const confirmText = `🌍 <b>KONFIRMASI BEKASAN GLOBAL</b>\n\n` +
          `📦 <b>Paket:</b> ${tipeName} ${state.hari} HARI\n` +
          `📱 <b>Nomor:</b> <code>${nomorHP}</code>\n` +
          `💰 <b>Harga:</b> Rp. ${hargaValue.toLocaleString('id-ID')}\n` +
          `🌐 <b>Provider:</b> AKRAB GLOBAL\n\n` +
          `💡 <i>Pastikan nomor sudah benar sebelum melanjutkan!</i>`;

        const keyboard = [
          [
            { text: '✅ KONFIRMASI BELI', callback_data: `confirm_buy_bekasan_global_${state.tipe}_${state.hari}` },
            { text: '❌ BATALKAN', callback_data: 'cancel_buy_bekasan_global' }
          ]
        ];

        await bot.sendMessage(chatId, confirmText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });

        return;
      }

    } catch (error) {
      console.error('Error in bekasan global handler:', error);
      await bot.sendMessage(chatId, '❌ Terjadi kesalahan sistem. Silakan coba lagi.', {
        parse_mode: 'HTML'
      });
      clearStateBekasanGlobal(chatId);
    }
  });

  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const state = getStateBekasanGlobal(chatId);

    try {
      // Handle pilih slot bekasan global (dari list_bekasan_global.js)
      if (state && state.step === 'pilih_slot_bekasan_global') {
        // Hapus loading message
        if (state.loadingMessageId) {
          try {
            await bot.deleteMessage(chatId, state.loadingMessageId);
          } catch (e) {}
        }

        // Update state ke input nomor
        state.step = 'input_nomor_bekasan_global';

        const tipeNames = {
          'l': 'ANGGOTA L',
          'xl': 'ANGGOTA XL',
          'xxl': 'ANGGOTA XXL'
        };

        const tipeName = tipeNames[state.tipe] || state.tipe.toUpperCase();

        const inputText = `🌍 <b>INPUT NOMOR HP</b>\n\n` +
          `📦 Paket: ${tipeName} ${state.hari} HARI\n\n` +
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

      // Handle konfirmasi pembelian bekasan global
      if (/^confirm_buy_bekasan_global_/.test(data)) {
        if (!state || state.step !== 'konfirmasi_bekasan_global') {
          return bot.answerCallbackQuery(id, {
            text: '❌ Session expired, silakan mulai lagi',
            show_alert: true
          });
        }

        await bot.answerCallbackQuery(id, {
          text: '🔄 Memproses pembelian bekasan global...',
          show_alert: false
        });

        // Get current date in DDMMYY format
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String(now.getFullYear()).slice(-2);
        const timeFormat = day + month + year;

        // Generate unique transaction ID
        const trxId = `TRX${Date.now()}${Math.random().toString(36).substr(2, 5)}`;

        // Prepare API payload
        const apiPayload = {
          req: "topup",
          produk: state.kodePaket,
          msisdn: state.nomorHP,
          reffid: trxId,
          time: timeFormat,
          kodereseller: process.env.KODERESSG,
          password: process.env.PASSWORDG,
          pin: process.env.PING
        };

        try {
          const tipeNames = {
            'l': 'ANGGOTA L',
            'xl': 'ANGGOTA XL',
            'xxl': 'ANGGOTA XXL'
          };

          const tipeName = tipeNames[state.tipe] || state.tipe.toUpperCase();

          const prosesText = `🌍 <b>MEMPROSES BEKASAN GLOBAL</b>\n\n` +
            `📦 Paket: ${tipeName} ${state.hari} HARI\n` +
            `📱 Nomor: ${state.nomorHP}\n` +
            `🆔 TRX ID: ${trxId}\n` +
            `🔄 Status: Mengirim ke API AKRAB GLOBAL...\n\n` +
            `⏳ <i>Mohon tunggu, proses membutuhkan waktu 1-3 menit</i>`;

          await bot.editMessageText(prosesText, {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML'
          });

          // Call AKRAB GLOBAL API
          const response = await axios.post(process.env.APIG_ORDER, apiPayload, {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
          });

          console.log('AKRAB GLOBAL API Response (Bekasan):', response.data);

          // Process API response
          let statusText = '';
          let statusIcon = '';
          
          if (response.data && response.data.status === 'success') {
            statusIcon = '✅';
            statusText = 'BERHASIL';
          } else if (response.data && response.data.status === 'pending') {
            statusIcon = '⏳';
            statusText = 'PENDING';
          } else {
            statusIcon = '❌';
            statusText = 'GAGAL';
          }

          const resultText = `🌍 <b>HASIL BEKASAN GLOBAL</b>\n\n` +
            `📦 Paket: ${tipeName} ${state.hari} HARI\n` +
            `📱 Nomor: ${state.nomorHP}\n` +
            `🆔 TRX ID: ${trxId}\n` +
            `${statusIcon} Status: ${statusText}\n\n` +
            `💬 Pesan: ${response.data?.message || 'Transaksi diproses'}\n\n` +
            `🌐 <i>Powered by AKRAB GLOBAL</i>`;

          await bot.editMessageText(resultText, {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML'
          });

        } catch (error) {
          console.error('Error calling AKRAB GLOBAL API (Bekasan):', error);
          
          const tipeNames = {
            'l': 'ANGGOTA L',
            'xl': 'ANGGOTA XL',
            'xxl': 'ANGGOTA XXL'
          };

          const tipeName = tipeNames[state.tipe] || state.tipe.toUpperCase();

          const errorText = `🌍 <b>BEKASAN GLOBAL ERROR</b>\n\n` +
            `📦 Paket: ${tipeName} ${state.hari} HARI\n` +
            `📱 Nomor: ${state.nomorHP}\n` +
            `🆔 TRX ID: ${trxId}\n` +
            `❌ Status: GAGAL\n\n` +
            `💬 Error: ${error.response?.data?.message || error.message || 'Koneksi timeout'}\n\n` +
            `🔄 <i>Silakan coba lagi atau hubungi admin</i>`;

          await bot.editMessageText(errorText, {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML'
          });
        }

        // Clear state
        clearStateBekasanGlobal(chatId);
        return;
      }

      // Handle batalkan pembelian bekasan global
      if (data === 'cancel_buy_bekasan_global') {
        if (state) {
          clearStateBekasanGlobal(chatId);
        }

        await bot.editMessageText('❌ <b>Pembelian bekasan dibatalkan</b>\n\nSilakan pilih paket lain jika diperlukan.', {
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
      console.error('Error in bekasan global callback:', error);
      await bot.answerCallbackQuery(id, {
        text: '❌ Terjadi kesalahan sistem',
        show_alert: true
      });
      
      if (state) {
        clearStateBekasanGlobal(chatId);
      }
    }
  });
};

// Export functions
module.exports.setStateBekasanGlobal = setStateBekasanGlobal;
module.exports.getStateBekasanGlobal = getStateBekasanGlobal;
module.exports.clearStateBekasanGlobal = clearStateBekasanGlobal;

// === END OF BEKASAN GLOBAL HANDLER ===
