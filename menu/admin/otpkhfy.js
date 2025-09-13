require('dotenv').config({ quiet: true });
const axios = require('axios');
const { EXIT_KEYWORDS, sendStyledInputMessage, autoDeleteMessage } = require('../../utils/exiter');

// Storage untuk OTP KHFY states
const otpKhfyStates = new Map();

// Function untuk cek admin
function isAuthorized(id) {
  const adminUsers = (process.env.ADMIN_USERS || process.env.ADMIN_ID || '').split(',').map(adminId => parseInt(adminId.toString().trim()));
  return adminUsers.includes(id);
}

// Function untuk request OTP
const requestOTP = async (msisdn) => {
  try {
    // Format nomor HP
    let formattedMsisdn = msisdn.replace(/\D/g, '');
    if (formattedMsisdn.startsWith('0')) {
      formattedMsisdn = '62' + formattedMsisdn.substring(1);
    }
    if (!formattedMsisdn.startsWith('62') && formattedMsisdn.length >= 10) {
      formattedMsisdn = '62' + formattedMsisdn;
    }

    // Request OTP menggunakan GET method
    const otpUrl = `https://panel.khfy-store.com/api/khfy_v2/member/login_otp?action=request_otp&msisdn=${formattedMsisdn}`;
    
    const response = await axios.get(otpUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });

    return {
      status: 'success',
      data: response.data,
      msisdn: formattedMsisdn
    };

  } catch (error) {
    console.error(`❌ Error requesting OTP untuk ${msisdn}:`, error.message);
    
    return {
      status: 'error',
      message: error.response?.data?.message || error.message,
      msisdn: msisdn
    };
  }
};

// Function untuk verifikasi OTP
const verifyOTP = async (msisdn, otpCode) => {
  try {
    // Format nomor HP
    let formattedMsisdn = msisdn.replace(/\D/g, '');
    if (formattedMsisdn.startsWith('0')) {
      formattedMsisdn = '62' + formattedMsisdn.substring(1);
    }
    if (!formattedMsisdn.startsWith('62') && formattedMsisdn.length >= 10) {
      formattedMsisdn = '62' + formattedMsisdn;
    }

    // Verify OTP menggunakan GET method
    const verifyUrl = `https://panel.khfy-store.com/api/khfy_v2/member/login_otp?action=login_otp&msisdn=${formattedMsisdn}&otp=${otpCode}`;
    
    const response = await axios.get(verifyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });

    return {
      status: 'success',
      data: response.data,
      msisdn: formattedMsisdn
    };

  } catch (error) {
    console.error(`❌ Error verifying OTP untuk ${msisdn}:`, error.message);
    
    return {
      status: 'error',
      message: error.response?.data?.message || error.message,
      msisdn: msisdn
    };
  }
};

// Function untuk cek pulsa menggunakan API1 (KHFY Store)
const checkPulsaWithAPI1 = async (nomor_hp) => {
  try {
    // Format nomor HP
    let formattedMsisdn = nomor_hp.replace(/\D/g, '');
    if (formattedMsisdn.startsWith('62')) {
      formattedMsisdn = '0' + formattedMsisdn.substring(2);
    }
    if (!formattedMsisdn.startsWith('0') && formattedMsisdn.length >= 10 && formattedMsisdn.length <= 11) {
      formattedMsisdn = '0' + formattedMsisdn;
    }

    // Construct API URL
    const apiUrl = process.env.API1 + process.env.CEKPULSA1;
    
    const formData = new URLSearchParams();
    formData.append('token', process.env.APIKEY1);
    formData.append('msisdn', formattedMsisdn);

    const response = await axios.post(apiUrl, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });

    return {
      status: 'success',
      data: response.data,
      nomor: formattedMsisdn
    };

  } catch (error) {
    console.error(`❌ Error checking pulsa untuk ${nomor_hp}:`, error.message);
    
    return {
      status: 'error',
      message: error.response?.data?.message || error.message,
      nomor: nomor_hp
    };
  }
};

module.exports = (bot) => {
  // Handle callback untuk otp_khfy
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (data === 'otp_khfy') {
      // Cek admin authorization
      if (!isAuthorized(from.id)) {
        return bot.answerCallbackQuery(id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }

      try {
        // Set state untuk menunggu input nomor HP
        otpKhfyStates.set(chatId, {
          step: 'waiting_number',
          userId: from.id,
          menuMessageId: msgId
        });

        const instructionText = '🟢 <b>OTP KHFY - REQUEST OTP</b>';
        const subtitle = '~Masukan Nomor~';

        // Kirim pesan styled dengan modern STEP EXITER
        const inputMsg = await sendStyledInputMessage(bot, chatId, instructionText, subtitle, 'membatalkan');
        
        // Simpan message ID untuk bisa dihapus nanti
        const currentState = otpKhfyStates.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        otpKhfyStates.set(chatId, currentState);

      } catch (error) {
        console.error('Error handling otp_khfy:', error.message);
        await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      }

      await bot.answerCallbackQuery(id);
      return;
    }
  });

  // Handle text input untuk OTP process
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const state = otpKhfyStates.get(chatId);

    if (!state || !isAuthorized(msg.from.id)) return;

    try {
      // Handle exit command - bersihkan semua tanpa pesan
      if (EXIT_KEYWORDS.COMBINED.includes(msg.text?.trim())) {
        // Hapus pesan input bot dan user dengan auto cleanup
        if (state.inputMessageId) {
          autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
        }
        autoDeleteMessage(bot, chatId, msg.message_id, 100);
        
        otpKhfyStates.delete(chatId);
        return;
      }

      // Step 1: Waiting for phone number
      if (state.step === 'waiting_number') {
        const phoneNumber = msg.text?.trim();
        
        if (!phoneNumber || phoneNumber.startsWith('/')) {
          return; // Skip commands
        }

        // Validate phone number
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        if (cleanNumber.length < 10 || cleanNumber.length > 15) {
          // Hapus pesan user yang tidak valid
          try {
            await bot.deleteMessage(chatId, msg.message_id);
          } catch (e) {}
          
          // Hapus pesan user yang salah format
          autoDeleteMessage(bot, chatId, msg.message_id, 100);
          
          const errorText = '❌ <b>Format nomor tidak valid!</b>';
          const errorSubtitle = 'Contoh: 087824020447';
          const errorMsg = await sendStyledInputMessage(bot, chatId, errorText, errorSubtitle, 'membatalkan');
          
          // Update state dengan message ID baru
          const currentState = otpKhfyStates.get(chatId);
          currentState.inputMessageId = errorMsg.message_id;
          otpKhfyStates.set(chatId, currentState);
          return;
        }

        // Hapus pesan input bot dan user sebelumnya dengan auto cleanup
        if (state.inputMessageId) {
          autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
        }
        autoDeleteMessage(bot, chatId, msg.message_id, 100);

        // Update state dan request OTP
        otpKhfyStates.set(chatId, {
          ...state,
          step: 'requesting_otp',
          phoneNumber: phoneNumber
        });

        // Kirim pesan loading
        const waitingMessage = await bot.sendMessage(chatId, '<i>🔄 Mengirim request OTP, mohon tunggu...</i>', { parse_mode: 'HTML' });

        // Request OTP
        const result = await requestOTP(phoneNumber);

        // Hapus pesan loading
        try {
          await bot.deleteMessage(chatId, waitingMessage.message_id);
        } catch (e) {}

        if (result.status === 'success' && result.data.status === true) {
          // OTP berhasil dikirim - kirim pesan sementara
          const tempSuccessText = '✅ <b>OTP BERHASIL DIKIRIM!</b>';
          const tempMessage = await bot.sendMessage(chatId, tempSuccessText, { parse_mode: 'HTML' });

          // Tunggu 1 detik lalu ubah jadi modern styled input OTP
          setTimeout(async () => {
            try {
              // Hapus pesan sukses
              autoDeleteMessage(bot, chatId, tempMessage.message_id, 100);
              
              // Kirim styled input message untuk OTP
              const otpText = '❗<b>MASUKAN OTP</b>';
              const otpSubtitle = 'Masukkan kode OTP yang diterima';
              const otpInputMsg = await sendStyledInputMessage(bot, chatId, otpText, otpSubtitle, 'membatalkan');
              
              // Update state dengan message ID baru
              const currentState = otpKhfyStates.get(chatId);
              if (currentState) {
                currentState.inputMessageId = otpInputMsg.message_id;
                otpKhfyStates.set(chatId, currentState);
              }
            } catch (e) {
              // Ignore error
            }
          }, 1000);

          // Update state untuk menunggu OTP
          otpKhfyStates.set(chatId, {
            ...state,
            step: 'waiting_otp',
            phoneNumber: phoneNumber, // Pastikan phoneNumber tetap tersimpan
            otpData: result.data,
            inputMessageId: tempMessage.message_id // Temporary, akan diupdate di setTimeout
          });

        } else {
          // OTP gagal dikirim
          const errorText = '🔴 <b>OTP GAGAL DIKIRIM</b>';
          const errorSubtitle = 'Silakan coba lagi dengan nomor yang berbeda';

          const errorMsg = await sendStyledInputMessage(bot, chatId, errorText, errorSubtitle, 'membatalkan');

          // Reset state untuk input nomor lagi dengan message ID baru
          otpKhfyStates.set(chatId, {
            ...state,
            step: 'waiting_number',
            inputMessageId: errorMsg.message_id
          });
        }

        return;
      }

      // Step 2: Waiting for OTP code
      if (state.step === 'waiting_otp') {
        const otpCode = msg.text?.trim();
        
        if (!otpCode || otpCode.startsWith('/')) {
          return; // Skip commands
        }

        // Validate OTP code
        const cleanOTP = otpCode.replace(/\D/g, '');
        if (cleanOTP.length < 4 || cleanOTP.length > 8) {
          // Hapus pesan user yang tidak valid
          autoDeleteMessage(bot, chatId, msg.message_id, 100);
          
          const errorText = '❌ <b>Kode OTP tidak valid!</b>';
          const errorSubtitle = 'Masukkan 4-8 digit angka';
          const errorMsg = await sendStyledInputMessage(bot, chatId, errorText, errorSubtitle, 'membatalkan');
          
          // Update state dengan message ID baru
          const currentState = otpKhfyStates.get(chatId);
          currentState.inputMessageId = errorMsg.message_id;
          otpKhfyStates.set(chatId, currentState);
          return;
        }

        // Check if phoneNumber exists in state
        if (!state.phoneNumber) {
          const errorMsg = await bot.sendMessage(chatId, '❌ <b>Session expired!</b>\nNomor HP tidak ditemukan. Silakan mulai ulang dengan klik tombol OTP KHFY.', { parse_mode: 'HTML' });
          autoDeleteMessage(bot, chatId, errorMsg.message_id, 5000); // Delete after 5 seconds
          otpKhfyStates.delete(chatId);
          return;
        }

        // Hapus pesan input bot dan user sebelumnya dengan auto cleanup
        if (state.inputMessageId) {
          autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
        }
        autoDeleteMessage(bot, chatId, msg.message_id, 100);

        // Kirim pesan loading
        const waitingMessage = await bot.sendMessage(chatId, '<i>🔄 Memverifikasi OTP, mohon tunggu...</i>', { parse_mode: 'HTML' });

        // Verify OTP dengan phoneNumber yang sudah validated
        const result = await verifyOTP(state.phoneNumber, cleanOTP);

        // Hapus pesan loading dengan auto cleanup
        autoDeleteMessage(bot, chatId, waitingMessage.message_id, 100);

        if (result.status === 'success' && result.data.status === true) {
          // OTP berhasil diverifikasi, langsung hit API cek pulsa
          const pulsaResult = await checkPulsaWithAPI1(state.phoneNumber);

          if (pulsaResult.status === 'success' && pulsaResult.data.status === true) {
            const apiData = pulsaResult.data.data;
            
            // Format tanggal expired
            let expiredDate = 'N/A';
            if (apiData.balance?.expired_at) {
              const date = new Date(apiData.balance.expired_at * 1000);
              const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
              const day = date.getDate().toString().padStart(2, '0');
              const month = months[date.getMonth()];
              const year = date.getFullYear();
              expiredDate = `${day} ${month} ${year}`;
            }

            const finalResultText = 
              '✅ <b>OTP VERIFIKASI & CEK PULSA BERHASIL!</b>\n\n' +
              `📱 Nomor: <code>${pulsaResult.nomor}</code>\n` +
              `📡 Status: ${apiData.subscription_status || 'N/A'}\n` +
              `💳 Subscriber: ${pulsaResult.data.subscriber || 'N/A'}\n` +
              `💰 Saldo: Rp ${apiData.balance?.remaining?.toLocaleString() || '0'}\n` +
              `⏰ Expired: ${expiredDate}\n\n` +
              '🎯 <b>Nomor berhasil diverifikasi dan status pulsa berhasil dicek!</b>';

            const resultMsg = await bot.sendMessage(chatId, finalResultText, { parse_mode: 'HTML' });
            
            // Auto delete result dengan modern method
            autoDeleteMessage(bot, chatId, resultMsg.message_id, 3000);

          } else {
            // Cek pulsa gagal setelah OTP sukses
            const errorResultText = 
              '🎉 <b>OTP BERHASIL DIVERIFIKASI!</b>\n\n' +
              `📱 MSISDN: <code>${result.data.data?.msisdn || result.msisdn}</code>\n` +
              `💬 Message: ${result.data.message}\n\n` +
              '❌ <b>Namun gagal mengecek status pulsa:</b>\n' +
              `💬 Error: ${pulsaResult.message || 'Unknown error'}`;

            const errorMsg = await bot.sendMessage(chatId, errorResultText, { parse_mode: 'HTML' });
            
            // Auto delete setelah 3 detik
            // Auto delete error message dengan modern method
            autoDeleteMessage(bot, chatId, errorMsg.message_id, 3000);
          }

        } else {
          // OTP gagal diverifikasi
          const displayOTP = cleanOTP.split('').join('-');
          
          const errorText = 
            '🔴 <b>OTP SALAH!</b>\n' +
            `<i>Otp yg anda masukan ${displayOTP}</i>`;

          const errorMsg = await bot.sendMessage(chatId, errorText, { parse_mode: 'HTML' });

          // Auto delete error dan kirim prompt baru
          autoDeleteMessage(bot, chatId, errorMsg.message_id, 3000);
          
          // Set delay 3 detik lalu kirim prompt baru
          setTimeout(async () => {
            try {
              const retryText = '❗<b>MASUKAN OTP</b>';
              const retrySubtitle = '';
              const retryMsg = await sendStyledInputMessage(bot, chatId, retryText, retrySubtitle, 'membatalkan');
              
              // Update state dengan message ID baru
              const currentState = otpKhfyStates.get(chatId);
              if (currentState) {
                currentState.inputMessageId = retryMsg.message_id;
                otpKhfyStates.set(chatId, currentState);
              }
            } catch (e) {
              // Ignore error
            }
          }, 3000);

          return;
        }

        // Clean up state
        otpKhfyStates.delete(chatId);
        return;
      }

    } catch (error) {
      console.error('Error handling OTP KHFY input:', error.message);
      
      // Hapus pesan user dan input bot jika ada dengan auto cleanup
      autoDeleteMessage(bot, chatId, msg.message_id, 100);
      
      if (state?.inputMessageId) {
        autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
      }
      
      const errorMsg = await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      
      // Auto delete error message dengan modern method
      autoDeleteMessage(bot, chatId, errorMsg.message_id, 3000);
      
      // Clean up states
      otpKhfyStates.delete(chatId);
    }
  });
};
