require('dotenv').config({ quiet: true });
const axios = require('axios');

// Storage untuk OTP HIDE states
const otpHideStates = new Map();

// Function untuk cek admin
function isAuthorized(id) {
  const adminUsers = (process.env.ADMIN_USERS || process.env.ADMIN_ID || '').split(',').map(adminId => parseInt(adminId.toString().trim()));
  return adminUsers.includes(id);
}

// Function untuk request OTP menggunakan Hide Pulsa API
const requestOTPHide = async (nomor_hp) => {
  try {
    // Format nomor HP untuk Hide Pulsa API
    let formattedNumber = nomor_hp.replace(/\D/g, '');
    if (formattedNumber.startsWith('0')) {
      formattedNumber = '62' + formattedNumber.substring(1);
    }
    if (!formattedNumber.startsWith('62') && formattedNumber.length >= 10) {
      formattedNumber = '62' + formattedNumber;
    }

    // Request OTP menggunakan Hide Pulsa API
    const otpUrl = `https://api.hidepulsa.com/api/v1/minta-otp?nomor_hp=${formattedNumber}`;
    
    const response = await axios.get(otpUrl, {
      headers: {
        'Authorization': process.env.APIKEY2,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000
    });

    return {
      status: 'success',
      data: response.data,
      nomor: formattedNumber
    };

  } catch (error) {
    return {
      status: 'error',
      message: error.response?.data?.message || error.message,
      nomor: nomor_hp
    };
  }
};

// Function untuk verifikasi OTP Hide Pulsa
const verifyOTPHide = async (nomor_hp, otpCode) => {
  try {
    // Format nomor HP
    let formattedNumber = nomor_hp.replace(/\D/g, '');
    if (formattedNumber.startsWith('0')) {
      formattedNumber = '62' + formattedNumber.substring(1);
    }
    if (!formattedNumber.startsWith('62') && formattedNumber.length >= 10) {
      formattedNumber = '62' + formattedNumber;
    }

    // Verify OTP menggunakan endpoint yang benar
    const verifyUrl = `https://api.hidepulsa.com/api/v1/verif-otp?nomor_hp=${formattedNumber}&kode_otp=${otpCode}`;
    
    const response = await axios.get(verifyUrl, {
      headers: {
        'Authorization': process.env.APIKEY2,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000
    });

    return {
      status: 'success',
      data: response.data,
      nomor: formattedNumber
    };

  } catch (error) {
    return {
      status: 'error',
      message: error.response?.data?.message || error.message,
      nomor: nomor_hp
    };
  }
};

// Function untuk cek pulsa Hide Pulsa menggunakan API2+CEKPULSA2
const checkPulsaHide = async (nomor_hp) => {
  try {
    // Format nomor HP untuk Hide Pulsa (gunakan format asli 08xx)
    let formattedNumber = nomor_hp.replace(/\D/g, '');
    if (formattedNumber.startsWith('62')) {
      formattedNumber = '0' + formattedNumber.substring(2);
    }
    if (!formattedNumber.startsWith('0') && formattedNumber.length >= 10 && formattedNumber.length <= 11) {
      formattedNumber = '0' + formattedNumber;
    }

    // Construct URL dari environment variables: API2 + CEKPULSA2
    const apiUrl = process.env.API2 + process.env.CEKPULSA2;
    
    const requestBody = {
      action: "cek_kuota",
      id_telegram: process.env.ADMIN_ID,
      password: process.env.PASSWORD2,
      nomor_hp: formattedNumber
    };

    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.APIKEY2,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000
    });

    return {
      status: 'success',
      data: response.data,
      nomor: formattedNumber
    };

  } catch (error) {
    return {
      status: 'error',
      message: error.response?.data?.message || error.message,
      nomor: nomor_hp
    };
  }
};

module.exports = (bot) => {
  // Handle callback untuk otp_hide
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (data === 'otp_hide') {
      // Cek admin authorization
      if (!isAuthorized(from.id)) {
        return bot.answerCallbackQuery(id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }

      try {
        // Set state untuk menunggu input nomor HP
        otpHideStates.set(chatId, {
          step: 'waiting_number',
          userId: from.id,
          menuMessageId: msgId
        });

        const instructionText = 
          '⚪ <b>OTP HIDE - REQUEST OTP</b>\n' +
          '<i>~Masukan Nomor~\n' +
          '💡 Ketik "exit" untuk membatalkan</i>';

        // Kirim pesan baru langsung (tidak edit)
        const inputMsg = await bot.sendMessage(chatId, instructionText, { parse_mode: 'HTML' });
        
        // Simpan message ID untuk bisa dihapus nanti
        const currentState = otpHideStates.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        otpHideStates.set(chatId, currentState);

      } catch (error) {
        await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      }

      await bot.answerCallbackQuery(id);
      return;
    }
  });

  // Handle text input untuk OTP Hide process
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const state = otpHideStates.get(chatId);

    if (!state || !isAuthorized(msg.from.id)) return;

    try {
      // Handle exit command - bersihkan semua tanpa pesan
      if (['exit', 'EXIT', 'Exit'].includes(msg.text?.trim())) {
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
        
        otpHideStates.delete(chatId);
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
          
          if (state.inputMessageId) {
            try {
              await bot.deleteMessage(chatId, state.inputMessageId);
            } catch (e) {}
          }
          
          const errorMsg = await bot.sendMessage(chatId, '❌ <b>Format nomor tidak valid!</b>\nContoh: 087824020447\n\n<i>Ketik "exit" untuk batal</i>', { parse_mode: 'HTML' });
          
          // Update state dengan message ID baru
          const currentState = otpHideStates.get(chatId);
          currentState.inputMessageId = errorMsg.message_id;
          otpHideStates.set(chatId, currentState);
          return;
        }

        // Hapus pesan input bot dan user sebelumnya
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}

        // Update state dan request OTP
        otpHideStates.set(chatId, {
          ...state,
          step: 'requesting_otp',
          phoneNumber: phoneNumber
        });

        // Kirim pesan loading
        const waitingMessage = await bot.sendMessage(chatId, '<i>🔄 Mengirim request OTP ke Hide Pulsa, mohon tunggu...</i>', { parse_mode: 'HTML' });

        // Request OTP Hide
        const result = await requestOTPHide(phoneNumber);

        // Hapus pesan loading
        try {
          await bot.deleteMessage(chatId, waitingMessage.message_id);
        } catch (e) {}

        // Improved validation logic seperti menu_otp.js
        const isOtpSent = result.status === 'success' && 
                         result.data && 
                         result.data.status === 'success';

        if (isOtpSent) {
          // OTP berhasil dikirim - kirim pesan sementara
          const tempSuccessText = '✅ <b>OTP HIDE BERHASIL DIKIRIM!</b>';
          const tempMessage = await bot.sendMessage(chatId, tempSuccessText, { parse_mode: 'HTML' });

          // Tunggu 1 detik lalu ubah jadi pesan input OTP
          setTimeout(async () => {
            try {
              await bot.editMessageText('❗<b>MASUKAN OTP HIDE</b>', {
                chat_id: chatId,
                message_id: tempMessage.message_id,
                parse_mode: 'HTML'
              });
            } catch (e) {}
          }, 1000);

          // Update state untuk menunggu OTP
          otpHideStates.set(chatId, {
            ...state,
            step: 'waiting_otp',
            phoneNumber: phoneNumber,
            otpData: result.data,
            inputMessageId: tempMessage.message_id // Update input message ID
          });

        } else {
          // OTP gagal dikirim - dengan error detail
          
          const errorText = 
            '🔴 <b>OTP HIDE GAGAL DIKIRIM</b>\n' +
            `💬 Error: ${result.data?.message || result.data?.data?.message || result.message || 'Gagal kirim OTP'}`;

          const errorMsg = await bot.sendMessage(chatId, errorText, { parse_mode: 'HTML' });

          // Reset state untuk input nomor lagi dengan message ID baru
          otpHideStates.set(chatId, {
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
          try {
            await bot.deleteMessage(chatId, msg.message_id);
          } catch (e) {}
          
          if (state.inputMessageId) {
            try {
              await bot.deleteMessage(chatId, state.inputMessageId);
            } catch (e) {}
          }
          
          const errorMsg = await bot.sendMessage(chatId, '❌ <b>Kode OTP tidak valid!</b>\nMasukkan 4-8 digit angka\n\n<i>Ketik "exit" untuk batal</i>', { parse_mode: 'HTML' });
          
          // Update state dengan message ID baru
          const currentState = otpHideStates.get(chatId);
          currentState.inputMessageId = errorMsg.message_id;
          otpHideStates.set(chatId, currentState);
          return;
        }

        // Check if phoneNumber exists in state
        if (!state.phoneNumber) {
          const errorMsg = await bot.sendMessage(chatId, '❌ <b>Session expired!</b>\nNomor HP tidak ditemukan. Silakan mulai ulang dengan klik tombol OTP HIDE.', { parse_mode: 'HTML' });
          otpHideStates.delete(chatId);
          return;
        }

        // Hapus pesan input bot dan user sebelumnya
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}

        // Kirim pesan loading
        const waitingMessage = await bot.sendMessage(chatId, '<i>🔄 Memverifikasi OTP Hide, mohon tunggu...</i>', { parse_mode: 'HTML' });

        // Verify OTP dengan phoneNumber yang sudah validated
        const result = await verifyOTPHide(state.phoneNumber, cleanOTP);

        // Hapus pesan loading
        try {
          await bot.deleteMessage(chatId, waitingMessage.message_id);
        } catch (e) {}

        // Improved validation logic seperti menu_otp.js
        const isOtpValid = result.status === 'success' && 
                          result.data && 
                          result.data.status === 'success' && 
                          result.data.data && 
                          result.data.data.status === 'success';

        if (isOtpValid) {
          // OTP berhasil diverifikasi, langsung hit API cek pulsa
          const pulsaResult = await checkPulsaHide(state.phoneNumber);

          if (pulsaResult.status === 'success') {
            // Format response data untuk field penting yang serupa dengan KHFY
            try {
              if (pulsaResult.data && pulsaResult.data.data) {
                const apiData = pulsaResult.data.data;
                
                // Field setara dengan KHFY API:
                // KHFY: nomor, subscription_status, subscriber, remaining, expired_at
                // Hide: nomor, sub_type, tier, balance.pulsa, balance.expired
                
                const nomor = apiData.nomor || state.phoneNumber;
                const subscription_status = apiData.sub_type || 'N/A'; // PREPAID/POSTPAID
                const subscriber = apiData.tier || 'N/A'; // Gold/Silver/etc
                const remaining = apiData.balance?.pulsa || 0;
                const expired_at = apiData.balance?.expired || 'N/A';
                
                // Format tanggal expired (sama seperti KHFY)
                let expiredDate = expired_at;
                if (expired_at && expired_at !== 'N/A' && expired_at.includes('-')) {
                  // Convert "17-September-2025" ke format Indonesia jika perlu
                  const dateParts = expired_at.split('-');
                  if (dateParts.length === 3) {
                    const day = dateParts[0].padStart(2, '0');
                    const monthName = dateParts[1];
                    const year = dateParts[2];
                    expiredDate = `${day} ${monthName} ${year}`;
                  }
                }

                const finalResultText = 
                  '✅ <b>OTP HIDE VERIFIKASI & CEK PULSA BERHASIL!</b>\n\n' +
                  `📱 Nomor: <code>${nomor}</code>\n` +
                  `📡 Status: ${subscription_status}\n` +
                  `💳 Subscriber: ${subscriber}\n` +
                  `💰 Saldo: Rp ${remaining.toLocaleString()}\n` +
                  `⏰ Expired: ${expiredDate}\n\n` +
                  '🎯 <b>Nomor berhasil diverifikasi dengan Hide Pulsa API!</b>';

                const resultMsg = await bot.sendMessage(chatId, finalResultText, { parse_mode: 'HTML' });
                
                // Auto delete setelah 3 detik
                setTimeout(async () => {
                  try {
                    await bot.deleteMessage(chatId, resultMsg.message_id);
                  } catch (e) {
                    // Ignore delete error
                  }
                }, 3000);
              } else {
                throw new Error('Invalid response structure');
              }
            } catch (e) {
              // Fallback format sederhana
              const fallbackText = 
                '✅ <b>OTP HIDE VERIFIKASI & CEK PULSA BERHASIL!</b>\n\n' +
                `📱 Nomor: <code>${state.phoneNumber}</code>\n` +
                `💬 Status: ${pulsaResult.data?.status || 'success'}\n\n` +
                '🎯 <b>Nomor berhasil diverifikasi dengan Hide Pulsa API!</b>';

              const fallbackMsg = await bot.sendMessage(chatId, fallbackText, { parse_mode: 'HTML' });
              
              // Auto delete setelah 3 detik
              setTimeout(async () => {
                try {
                  await bot.deleteMessage(chatId, fallbackMsg.message_id);
                } catch (e) {
                  // Ignore delete error
                }
              }, 3000);
            }

          } else {
            // Cek pulsa gagal setelah OTP sukses
            const errorResultText = 
              '🎉 <b>OTP HIDE BERHASIL DIVERIFIKASI!</b>\n\n' +
              `📱 Nomor: <code>${state.phoneNumber}</code>\n` +
              `💬 Message: ${result.data?.message || 'Success'}\n\n` +
              '❌ <b>Namun gagal mengecek status pulsa:</b>\n' +
              `💬 Error: ${pulsaResult.message || 'Unknown error'}`;

            const errorMsg = await bot.sendMessage(chatId, errorResultText, { parse_mode: 'HTML' });
            
            // Auto delete setelah 3 detik
            setTimeout(async () => {
              try {
                await bot.deleteMessage(chatId, errorMsg.message_id);
              } catch (e) {
                // Ignore delete error
              }
            }, 3000);
          }

        } else {
          // OTP gagal diverifikasi - dengan error detail
          const displayOTP = cleanOTP.split('').join('-');
          
          const errorText = 
            '🔴 <b>OTP HIDE SALAH!</b>\n' +
            `<i>Otp yg anda masukan ${displayOTP}</i>\n` +
            `💬 Error: ${result.data?.message || result.data?.data?.message || result.message || 'OTP tidak valid'}`;

          const errorMsg = await bot.sendMessage(chatId, errorText, { parse_mode: 'HTML' });

          // Auto delete setelah 3 detik lalu kirim prompt baru
          setTimeout(async () => {
            try {
              await bot.deleteMessage(chatId, errorMsg.message_id);
              
              // Kirim prompt baru untuk input OTP lagi
              const retryMsg = await bot.sendMessage(chatId, '❗<b>MASUKAN OTP HIDE</b>\n<i>Ketik "exit" untuk batal</i>', { parse_mode: 'HTML' });
              
              // Update state dengan message ID baru
              const currentState = otpHideStates.get(chatId);
              if (currentState) {
                currentState.inputMessageId = retryMsg.message_id;
                otpHideStates.set(chatId, currentState);
              }
            } catch (e) {
              // Ignore delete error
            }
          }, 3000);

          return;
        }

        // Clean up state
        otpHideStates.delete(chatId);
        return;
      }

    } catch (error) {
      // Hapus pesan user jika ada
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}
      
      // Hapus pesan input bot jika ada
      if (state?.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {}
      }
      
      const errorMsg = await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      
      // Auto delete error message setelah 3 detik
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, errorMsg.message_id);
        } catch (e) {
          // Ignore delete error
        }
      }, 3000);
      
      // Clean up states
      otpHideStates.delete(chatId);
    }
  });
};
