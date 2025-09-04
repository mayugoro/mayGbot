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
        console.log('=== BEKASAN GLOBAL: USER INPUT NOMOR HP ===');
        console.log('Chat ID:', chatId);
        console.log('Input text:', text);
        console.log('User ID:', msg.from?.id);
        console.log('Username:', msg.from?.username);
        console.log('Tipe:', state.tipe);
        console.log('Hari:', state.hari);
        
        // Validasi nomor HP
        const cleanNumber = text.replace(/\D/g, '');
        console.log('Clean number:', cleanNumber);
        console.log('Number length:', cleanNumber.length);
        
        if (cleanNumber.length < 10 || cleanNumber.length > 15) {
          console.log('❌ Nomor tidak valid - length tidak sesuai');
          await bot.sendMessage(chatId, '❌ <b>Format nomor tidak valid!</b>\n\nContoh format yang benar:\n• 081234567890\n• 08123456789\n• +6281234567890', {
            parse_mode: 'HTML'
          });
          return;
        }

        // Format nomor HP ke format 628 (untuk API AKRAB GLOBAL)
        let nomorHP = cleanNumber;
        
        // Jika dimulai dengan +62, hapus +
        if (nomorHP.startsWith('62')) {
          nomorHP = nomorHP; // sudah dalam format 62
        }
        // Jika dimulai dengan 0, ganti dengan 62
        else if (nomorHP.startsWith('0')) {
          nomorHP = '62' + nomorHP.substring(1);
        }
        // Jika dimulai dengan 8 (tanpa 0), tambahkan 62
        else if (nomorHP.startsWith('8')) {
          nomorHP = '62' + nomorHP;
        }
        // Jika tidak sesuai format, tambahkan 628 di depan
        else {
          nomorHP = '628' + nomorHP;
        }

        console.log('Final formatted number (628 format):', nomorHP);

        // Update state dengan nomor HP
        state.nomorHP = nomorHP;
        state.step = 'konfirmasi_bekasan_global';
        console.log('📝 State diupdate ke: konfirmasi_bekasan_global');

        // Hapus message nomor HP user untuk privacy
        try {
          await bot.deleteMessage(chatId, msg.message_id);
          console.log('🔒 User input nomor berhasil dihapus (privacy)');
        } catch (e) {
          console.log('❌ Gagal hapus user input:', e.message);
        }

        // Tampilkan konfirmasi pembelian bekasan
        const { getKonfigurasi } = require('../../../db');
        const harga = await getKonfigurasi(`harga_bekasan_global_${state.tipe}_${state.hari}`) || 
                     await getKonfigurasi(`harga_bekasan_${state.tipe}_${state.hari}`) ||
                     await getKonfigurasi(`harga_bekasan_${state.hari}`);
        const hargaValue = harga ? parseInt(harga) : 0;
        console.log('Harga dari database:', harga, '→', hargaValue);

        const tipeNames = {
          'l': 'ANGGOTA L',
          'xl': 'ANGGOTA XL',
          'xxl': 'ANGGOTA XXL'
        };

        const tipeName = tipeNames[state.tipe] || state.tipe.toUpperCase();
        console.log('Tipe name:', tipeName);

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
        
        console.log('📤 Konfirmasi pembelian bekasan message berhasil dikirim');
        console.log('=== END BEKASAN GLOBAL: INPUT NOMOR ===\n');

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
      // Handle konfirmasi pembelian bekasan global
      if (/^confirm_buy_bekasan_global_/.test(data)) {
        console.log('=== BEKASAN GLOBAL: USER KONFIRMASI BELI ===');
        console.log('Callback data:', data);
        console.log('Chat ID:', chatId);
        console.log('User ID:', from?.id);
        console.log('Username:', from?.username);
        
        if (!state || state.step !== 'konfirmasi_bekasan_global') {
          console.log('❌ State tidak valid atau expired');
          console.log('Current state:', state);
          return bot.answerCallbackQuery(id, {
            text: '❌ Session expired, silakan mulai lagi',
            show_alert: true
          });
        }

        console.log('✅ State valid, melanjutkan proses API');
        console.log('State data:', {
          tipe: state.tipe,
          hari: state.hari,
          kodePaket: state.kodePaket,
          nomorHP: state.nomorHP,
          step: state.step
        });

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
        console.log('Time format generated:', timeFormat);

        // Generate unique transaction ID
        const trxId = `TRX${Date.now()}${Math.random().toString(36).substr(2, 5)}`;
        console.log('Transaction ID generated:', trxId);

        // Prepare API payload
        const apiPayload = {
          req: "topup",
          produk: state.kodePaket, // Menggunakan kode dari API global (ex: BPAL7, BPAXL30, BPAXXL15, dll)
          msisdn: state.nomorHP,
          reffid: trxId,
          time: timeFormat,
          kodereseller: process.env.KODERESSG,
          password: process.env.PASSWORDG,
          pin: process.env.PING
        };
        
        console.log('API Payload prepared:');
        console.log('- URL:', process.env.APIG_ORDER);
        console.log('- Payload:', JSON.stringify(apiPayload, null, 2));

        try {
          const tipeNames = {
            'l': 'ANGGOTA L',
            'xl': 'ANGGOTA XL',
            'xxl': 'ANGGOTA XXL'
          };

          const tipeName = tipeNames[state.tipe] || state.tipe.toUpperCase();

          const prosesText = `🌍 <b>MEMPROSES BEKASAN GLOBAL</b>\n\n` +
            `📦 Paket: ${tipeName} ${state.hari} HARI\n` +
            `🆔 Kode: ${state.kodePaket}\n` +
            `📱 Nomor: ${state.nomorHP}\n` +
            `🆔 TRX ID: ${trxId}\n` +
            `🔄 Status: Mengirim ke API AKRAB GLOBAL...\n\n` +
            `⏳ <i>Mohon tunggu, proses membutuhkan waktu 1-3 menit</i>`;

          await bot.editMessageText(prosesText, {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML'
          });
          
          console.log('📤 Processing message sent to user');
          console.log('🔄 Calling AKRAB GLOBAL API...');

          // Call AKRAB GLOBAL API
          const response = await axios.post(process.env.APIG_ORDER, apiPayload, {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
          });

          console.log('✅ AKRAB GLOBAL API Response received (Bekasan):');
          console.log('Status Code:', response.status);
          console.log('Response Data:', JSON.stringify(response.data, null, 2));

          // Process API response
          let statusText = '';
          let statusIcon = '';
          
          if (response.data && response.data.status === 'success') {
            statusIcon = '✅';
            statusText = 'BERHASIL';
            console.log('✅ Transaction SUCCESS');
          } else if (response.data && response.data.status === 'pending') {
            statusIcon = '⏳';
            statusText = 'PENDING';
            console.log('⏳ Transaction PENDING');
          } else {
            statusIcon = '❌';
            statusText = 'GAGAL';
            console.log('❌ Transaction FAILED');
          }

          const resultText = `🌍 <b>HASIL BEKASAN GLOBAL</b>\n\n` +
            `📦 Paket: ${tipeName} ${state.hari} HARI\n` +
            `🆔 Kode: ${state.kodePaket}\n` +
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
          
          console.log('📤 Final result sent to user');

        } catch (error) {
          console.error('❌ AKRAB GLOBAL API Error (Bekasan):');
          console.error('Error type:', error.name);
          console.error('Error message:', error.message);
          console.error('Error code:', error.code);
          if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
          }
          
          const tipeNames = {
            'l': 'ANGGOTA L',
            'xl': 'ANGGOTA XL',
            'xxl': 'ANGGOTA XXL'
          };

          const tipeName = tipeNames[state.tipe] || state.tipe.toUpperCase();

          const errorText = `🌍 <b>BEKASAN GLOBAL ERROR</b>\n\n` +
            `📦 Paket: ${tipeName} ${state.hari} HARI\n` +
            `🆔 Kode: ${state.kodePaket}\n` +
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
          
          console.log('📤 Error message sent to user');
        }

        // Clear state
        clearStateBekasanGlobal(chatId);
        console.log('🧹 State cleared for chat:', chatId);
        console.log('=== END BEKASAN GLOBAL: KONFIRMASI BELI ===\n');
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
