require('dotenv').config({ quiet: true });
const axios = require('axios');

// Storage untuk cek pulsa states
const cekPulsaStates = new Map();

// Function untuk cek admin
function isAuthorized(id) {
  const adminUsers = (process.env.ADMIN_USERS || process.env.ADMIN_ID || '').split(',').map(adminId => parseInt(adminId.toString().trim()));
  return adminUsers.includes(id);
}

// Function untuk cek pulsa single nomor menggunakan API1 (KHFY Store)
const checkPulsaSingle = async (nomor_hp) => {
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

// Function untuk memproses request cek pulsa massal (concurrent)
const processCekPulsaRequest = async (chatId, uniqueNumbers, bot) => {
  try {
    // Kirim pesan penunggu dulu
    const waitingMessage = await bot.sendMessage(chatId, '<i>Sedang diproses, mohon tunggu...</i>', { parse_mode: 'HTML' });
    let waitingMessageDeleted = false;
    
    let totalSuccess = 0;
    let totalFailed = 0;
    let completedCount = 0;
    
    // Array untuk menyimpan nomor dengan pulsa bermasalah
    let problematicNumbers = [];

    // Function untuk process single nomor
    const processSingleNomor = async (nomor_hp, index) => {
      try {
        const result = await checkPulsaSingle(nomor_hp);
        
        // Format nomor untuk display
        let displayNumber = nomor_hp;
        if (displayNumber.startsWith('62')) {
          displayNumber = '0' + displayNumber.substring(2);
        } else if (displayNumber.length === 10 && !displayNumber.startsWith('0')) {
          displayNumber = '0' + displayNumber;
        }

        return {
          success: result.status === 'success',
          nomor: displayNumber,
          index: index,
          data: result.data,
          error: result.message
        };

      } catch (error) {
        let displayNumber = nomor_hp;
        if (displayNumber.startsWith('62')) {
          displayNumber = '0' + displayNumber.substring(2);
        } else if (displayNumber.length === 10 && !displayNumber.startsWith('0')) {
          displayNumber = '0' + displayNumber;
        }

        return {
          success: false,
          nomor: displayNumber,
          index: index,
          error: error.message
        };
      }
    };

    // Function untuk send hasil segera setelah API call selesai
    const processAndSendResult = async (result) => {
      completedCount++;
      
      // Hapus pesan penunggu saat hasil pertama datang
      if (!waitingMessageDeleted) {
        try {
          await bot.deleteMessage(chatId, waitingMessage.message_id);
          waitingMessageDeleted = true;
        } catch (e) {}
      }
      
      try {
        if (result.success && result.data) {
          // Format hasil khusus untuk KHFY Store CEK PULSA API
          let resultText = '';
          
          if (typeof result.data === 'object' && result.data.status === true && result.data.data) {
            const apiData = result.data.data;
            
            // Format field yang diminta user
            resultText = `📡 Status: ${apiData.subscription_status || 'N/A'}\n`;
            resultText += `💳 Subscriber: ${result.data.subscriber || 'N/A'}\n`;
            
            // Format saldo dengan indikator visual di belakang (2 simbol)
            const saldoAmount = apiData.balance?.remaining || 0;
            let saldoIndicator = ''; // Indikator di belakang
            
            if (saldoAmount === 0) {
              saldoIndicator = ' ❗❗'; // Pulsa habis
              // Tambahkan ke daftar nomor bermasalah
              problematicNumbers.push({
                nomor: result.nomor,
                amount: saldoAmount,
                indicator: '❗❗'
              });
            } else if (saldoAmount < 10000) {
              saldoIndicator = ' ⚠️⚠️'; // Pulsa di bawah 10rb
              // Tambahkan ke daftar nomor bermasalah
              problematicNumbers.push({
                nomor: result.nomor,
                amount: saldoAmount,
                indicator: '⚠️⚠️'
              });
            } else if (saldoAmount > 150000) {
              saldoIndicator = ' ✅✅'; // Pulsa di atas 150rb
            }
            
            resultText += `💰 Pulsa: Rp ${saldoAmount.toLocaleString()}${saldoIndicator}\n`;
            
            // Format tanggal expired yang lebih readable
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
            resultText += `⏰ Expired: ${expiredDate}`;
            
          } else {
            // Fallback untuk response format lain
            if (typeof result.data === 'object') {
              if (result.data.status) {
                resultText += `📊 Status: ${result.data.status}\n`;
              }
              if (result.data.message) {
                resultText += `💬 Message: ${result.data.message}\n`;
              }
              if (result.data.balance || result.data.saldo) {
                // Format saldo dengan indikator visual di belakang (2 simbol) untuk fallback
                const saldoAmount = parseInt(result.data.balance || result.data.saldo || 0);
                let saldoIndicator = ''; // Indikator di belakang
                
                if (saldoAmount === 0) {
                  saldoIndicator = ' ❗❗'; // Pulsa habis
                  // Tambahkan ke daftar nomor bermasalah
                  problematicNumbers.push({
                    nomor: result.nomor,
                    amount: saldoAmount,
                    indicator: '❗❗'
                  });
                } else if (saldoAmount < 10000) {
                  saldoIndicator = ' ⚠️⚠️'; // Pulsa di bawah 10rb
                  // Tambahkan ke daftar nomor bermasalah
                  problematicNumbers.push({
                    nomor: result.nomor,
                    amount: saldoAmount,
                    indicator: '⚠️⚠️'
                  });
                } else if (saldoAmount > 150000) {
                  saldoIndicator = ' ✅✅'; // Pulsa di atas 150rb
                }
                
                resultText += `💰 Pulsa: Rp ${saldoAmount.toLocaleString()}${saldoIndicator}\n`;
              }
              if (result.data.operator) {
                resultText += `📱 Provider: ${result.data.operator}\n`;
              }
              
              // Jika tidak ada format khusus, tampilkan JSON yang rapi
              if (!resultText) {
                resultText = JSON.stringify(result.data, null, 2);
              }
            } else {
              // Jika response berupa string
              resultText = result.data.toString();
            }
          }
          
          // Format header berdasarkan jumlah nomor
          let headerText;
          if (uniqueNumbers.length === 1) {
            // Single nomor - tanpa counter
            headerText = `✅ <b>Hasil Cek Pulsa</b>\n📱 <code>${result.nomor}</code>\n\n${resultText}`;
          } else {
            // Multiple nomor - dengan counter
            headerText = `✅ <b>NOMOR ${result.index + 1}/${uniqueNumbers.length}</b> <code>[${completedCount}/${uniqueNumbers.length}]</code>\n📱 <code>${result.nomor}</code>\n\n${resultText}`;
          }
          
          await bot.sendMessage(chatId, headerText, { parse_mode: 'HTML' });
          totalSuccess++;
          
        } else {
          // Handle error hasil
          let errorText;
          if (uniqueNumbers.length === 1) {
            errorText = `❌ <b>Gagal Cek Pulsa</b>\n📱 <code>${result.nomor}</code>\n\n<i>${result.error || 'Error tidak diketahui'}</i>`;
          } else {
            errorText = `❌ <b>NOMOR ${result.index + 1}/${uniqueNumbers.length}</b> <code>[${completedCount}/${uniqueNumbers.length}]</code>\n📱 <code>${result.nomor}</code>\n\n<i>${result.error || 'Error tidak diketahui'}</i>`;
          }
          
          await bot.sendMessage(chatId, errorText, { parse_mode: 'HTML' });
          totalFailed++;
        }

      } catch (sendError) {
        console.error('Error sending result:', sendError.message);
        totalFailed++;
      }
    };

    // Jalankan semua API call secara concurrent
    const allPromises = uniqueNumbers.map((nomor_hp, index) => 
      processSingleNomor(nomor_hp, index).then(result => {
        return processAndSendResult(result);
      }).catch(error => {
        const errorResult = {
          success: false,
          error: error.message,
          nomor: nomor_hp,
          index: index
        };
        return processAndSendResult(errorResult);
      })
    );

    // Tunggu SEMUA hasil dikirim (concurrent execution)
    await Promise.allSettled(allPromises);

    // Kirim daftar nomor bermasalah jika ada (hanya untuk multiple numbers)
    if (problematicNumbers.length > 0 && uniqueNumbers.length > 1) {
      let problemText = '───────────────────\n';
      problemText += '<b>📋 DAFTAR NOMOR BERMASALAH:</b>\n\n';
      
      // Urutkan berdasarkan tingkat masalah (❗❗ dulu, lalu ⚠️⚠️)
      problematicNumbers.sort((a, b) => {
        if (a.indicator === '❗❗' && b.indicator === '⚠️⚠️') return -1;
        if (a.indicator === '⚠️⚠️' && b.indicator === '❗❗') return 1;
        return 0;
      });
      
      for (const item of problematicNumbers) {
        problemText += `<code>${item.nomor}</code>${item.indicator} Rp.${item.amount.toLocaleString()}\n`;
      }
      
      await bot.sendMessage(chatId, problemText, { parse_mode: 'HTML' });
    }
    
  } catch (error) {
    console.error('❌ Error dalam processCekPulsaRequest:', error);
    await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
  }
};

module.exports = (bot) => {
  // Handle callback untuk cek_pulsa dari menu massal
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;

    if (data === 'cek_pulsa') {
      // Cek authorization
      if (!isAuthorized(from.id)) {
        return bot.answerCallbackQuery(id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }

      // Set state untuk input nomor
      cekPulsaStates.set(chatId, { step: 'input_nomor' });
      
      const inputMsg = await bot.sendMessage(chatId,
        '📱 <i>Masukkan nomor untuk cek pulsa . . .\n' +
        'Bisa massal, pisahkan dengan Enter.\n\n' +
        '💡 Ketik "exit" untuk membatalkan</i>',
        { parse_mode: 'HTML' }
      );
      
      // Simpan message ID
      const currentState = cekPulsaStates.get(chatId);
      currentState.inputMessageId = inputMsg.message_id;
      cekPulsaStates.set(chatId, currentState);

      await bot.answerCallbackQuery(id);
      return;
    }
  });

  // Handle text input untuk cek pulsa
  bot.on('message', async (msg) => {
    if (!msg || !msg.chat || !msg.from || !msg.text) return;
    
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    const state = cekPulsaStates.get(chatId);
    if (!state || state.step !== 'input_nomor') return;
    
    if (text.startsWith("/")) return;
    
    try {
      // Cek cancel/exit
      if (['exit', 'EXIT', 'Exit'].includes(text)) {
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        
        cekPulsaStates.delete(chatId);
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      // Parse nomor HP (multiple lines)
      const lines = text.split(/\n|\r/).map(line => line.trim()).filter(line => line);
      const validNumbers = [];
      
      for (const line of lines) {
        const cleanNumber = line.replace(/\D/g, '');
        if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
          validNumbers.push(cleanNumber);
        }
      }
      
      // Hilangkan duplikasi nomor
      const uniqueNumbers = [...new Set(validNumbers)];
      
      if (uniqueNumbers.length === 0) {
        await bot.sendMessage(chatId, 
          '❌ <b>Tidak ada nomor yang valid!</b>\n\n' +
          'Format: 10-15 digit angka per baris.\n' +
          'Coba lagi atau ketik "exit" untuk batal.',
          { parse_mode: 'HTML' }
        );
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      // Hapus pesan input
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {}
      }
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}

      // Langsung eksekusi cek pulsa concurrent
      await processCekPulsaRequest(chatId, uniqueNumbers, bot);

      // Clean up state
      cekPulsaStates.delete(chatId);

    } catch (error) {
      console.error('Error handling cek pulsa input:', error.message);
      await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      cekPulsaStates.delete(chatId);
    }
  });
};
