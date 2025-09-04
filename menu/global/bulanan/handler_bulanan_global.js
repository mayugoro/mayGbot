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
        console.log('=== BULANAN GLOBAL: USER INPUT NOMOR HP ===');
        console.log('Chat ID:', chatId);
        console.log('Input text:', text);
        console.log('User ID:', msg.from?.id);
        console.log('Username:', msg.from?.username);
        
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
        state.step = 'konfirmasi_global';
        console.log('📝 State diupdate ke: konfirmasi_global');

        // Hapus message nomor HP user untuk privacy
        try {
          await bot.deleteMessage(chatId, msg.message_id);
          console.log('🔒 User input nomor berhasil dihapus (privacy)');
        } catch (e) {
          console.log('❌ Gagal hapus user input:', e.message);
        }

        // Tampilkan konfirmasi pembelian
        const { getKonfigurasi } = require('../../../db');
        const harga = await getKonfigurasi(`harga_global_${state.paket}`) || await getKonfigurasi(`harga_${state.paket}`);
        const hargaValue = harga ? parseInt(harga) : 0;
        console.log('Harga dari database:', harga, '→', hargaValue);

        const paketNames = {
          'supermini': 'SUPERMINI PROMO',
          'megabig': 'MEGABIG', 
          'mini': 'MINI',
          'big': 'BIG',
          'jumbo': 'JUMBO V2',
          'bigplus': 'BIG PLUS'
        };

        const paketName = paketNames[state.paket] || state.paket.toUpperCase();
        console.log('Paket name:', paketName);

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
        
        console.log('📤 Konfirmasi pembelian message berhasil dikirim');
        console.log('=== END BULANAN GLOBAL: INPUT NOMOR ===\n');

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

    // Hanya handle callback jika ada state yang valid
    if (!state) return;

    try {
      // Handle konfirmasi pembelian global
      if (/^confirm_buy_global_/.test(data)) {
        console.log('=== BULANAN GLOBAL: USER KONFIRMASI BELI ===');
        console.log('Callback data:', data);
        console.log('Chat ID:', chatId);
        console.log('User ID:', from?.id);
        console.log('Username:', from?.username);
        
        if (!state || state.step !== 'konfirmasi_global') {
          console.log('❌ State tidak valid atau expired');
          console.log('Current state:', state);
          return bot.answerCallbackQuery(id, {
            text: '❌ Session expired, silakan mulai lagi',
            show_alert: true
          });
        }

        console.log('✅ State valid, melanjutkan proses API');
        console.log('State data:', {
          paket: state.paket,
          kodePaket: state.kodePaket,
          nomorHP: state.nomorHP,
          step: state.step
        });

        await bot.answerCallbackQuery(id, {
          text: '🔄 Memproses pembelian global...',
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
          produk: state.kodePaket, // Menggunakan kode dari API global (ex: XLA14, XLA89, dll)
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
          const prosesText = `🌍 <b>MEMPROSES PEMBELIAN GLOBAL</b>\n\n` +
            `📦 Paket: ${state.paket.toUpperCase()}\n` +
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

          console.log('✅ AKRAB GLOBAL API Response received:');
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

          const resultText = `🌍 <b>HASIL PEMBELIAN GLOBAL</b>\n\n` +
            `📦 Paket: ${state.paket.toUpperCase()}\n` +
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
          console.error('❌ AKRAB GLOBAL API Error:');
          console.error('Error type:', error.name);
          console.error('Error message:', error.message);
          console.error('Error code:', error.code);
          if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
          }
          
          const errorText = `🌍 <b>PEMBELIAN GLOBAL ERROR</b>\n\n` +
            `📦 Paket: ${state.paket.toUpperCase()}\n` +
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
        clearStateBulananGlobal(chatId);
        console.log('🧹 State cleared for chat:', chatId);
        console.log('=== END BULANAN GLOBAL: KONFIRMASI BELI ===\n');
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
