const axios = require('axios');
require('dotenv').config({ quiet: true });

// API Configuration dari .env
const API_PRIMARY_BASE = process.env.API1;
const API_PRIMARY_ENDPOINT = process.env.CEKSLOT1;
const API_PRIMARY_TOKEN = process.env.APIKEY1;
const API_PRIMARY_FULL_URL = API_PRIMARY_BASE + API_PRIMARY_ENDPOINT;

const API_SECONDARY_BASE = process.env.API2;
const API_SECONDARY_ENDPOINT = process.env.CEKSLOT2;
const API_SECONDARY_AUTH = process.env.APIKEY2;
const API_SECONDARY_PASSWORD = process.env.PASSWORD2;
const API_SECONDARY_FULL_URL = API_SECONDARY_BASE + API_SECONDARY_ENDPOINT;

const ADMIN_ID = process.env.ADMIN_ID;

// Helper function untuk format nomor ke internasional (untuk API primary)
function formatNomorToInternational(nomor) {
  let cleanNomor = nomor.replace(/\D/g, '');
  
  if (cleanNomor.startsWith('08')) {
    cleanNomor = '628' + cleanNomor.substring(2);
  } else if (cleanNomor.startsWith('8') && !cleanNomor.startsWith('62')) {
    cleanNomor = '62' + cleanNomor;
  }
  
  return cleanNomor;
}

// Helper function untuk format nomor ke lokal (untuk API secondary)
function formatNomorToLocal(nomor) {
  let cleanNomor = nomor.replace(/\D/g, '');
  
  if (cleanNomor.startsWith('628')) {
    cleanNomor = '08' + cleanNomor.substring(3);
  } else if (cleanNomor.startsWith('62')) {
    cleanNomor = '0' + cleanNomor.substring(2);
  } else if (!cleanNomor.startsWith('0')) {
    cleanNomor = '0' + cleanNomor;
  }
  
  return cleanNomor;
}

// Helper function untuk format nomor untuk display (08xxxxx)
function formatNomorForDisplay(nomor) {
  let cleanNomor = nomor.replace(/\D/g, '');
  
  if (cleanNomor.startsWith('628')) {
    cleanNomor = '08' + cleanNomor.substring(3);
  } else if (cleanNomor.startsWith('62')) {
    cleanNomor = '0' + cleanNomor.substring(2);
  } else if (!cleanNomor.startsWith('0')) {
    cleanNomor = '0' + cleanNomor;
  }
  
  return cleanNomor;
}

// Helper function untuk parse tanggal expired dalam berbagai format
function parseExpiredDate(dateString) {
  if (!dateString || dateString === 'Tidak tersedia') {
    return null;
  }
  
  // Jika input adalah timestamp (number atau string number)
  if (!isNaN(dateString) && dateString.toString().length >= 10) {
    const timestamp = parseInt(dateString);
    return new Date(timestamp * 1000); // Convert to milliseconds
  }
  
  if (dateString.includes('-')) {
    const parts = dateString.split('-');
    if (parts[0].length === 4) {
      // Format YYYY-MM-DD
      return new Date(dateString);
    } else {
      // Format DD-MM-YYYY (seperti dari API scan bekasan)
      const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      return new Date(isoDate);
    }
  } else {
    return new Date(dateString);
  }
}

// Function untuk hit API PRIMARY (khfy-store)
async function hitApiPrimary(nomor_hp) {
  try {
    const formattedNomor = formatNomorToInternational(nomor_hp);
    
    // Format API KHFY yang BENAR: hanya token dan id_parent
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('id_parent', formattedNomor);
    
    const response = await axios.post(API_PRIMARY_FULL_URL, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });
    
    // Cek apakah response berhasil
    if (response.data && response.status === 200) {
      const responseData = response.data;
      
      // Cek status response
      if (responseData.status === false) {
        throw new Error(`Primary API error: ${responseData.message || 'Unknown error'}`);
      }
      
      return {
        success: true,
        source: 'primary',
        data: responseData
      };
    } else {
      throw new Error('Primary API returned invalid response');
    }

  } catch (error) {
    return {
      success: false,
      source: 'primary',
      error: error.message
    };
  }
}

// Function untuk hit API SECONDARY (hidepulsa)  
async function hitApiSecondary(nomor_hp) {
  try {
    const formattedNomor = formatNomorToLocal(nomor_hp);
    
    const requestData = {
      action: "info",
      id_telegram: ADMIN_ID,
      password: API_SECONDARY_PASSWORD,
      nomor_hp: formattedNomor
    };
    
    const response = await axios.post(API_SECONDARY_FULL_URL, requestData, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": API_SECONDARY_AUTH
      },
      timeout: 20000
    });
    
    if (response.data && response.status === 200) {
      const responseData = response.data;
      
      // Cek status response
      if (responseData.status !== 'success' || responseData.code !== 0) {
        throw new Error(`Secondary API error: ${responseData.message || 'Unknown error'}`);
      }
      
      return {
        success: true,
        source: 'secondary',
        data: responseData
      };
    } else {
      throw new Error('Secondary API returned invalid response');
    }

  } catch (error) {
    return {
      success: false,
      source: 'secondary', 
      error: error.message
    };
  }
}

// Dual strategy function
async function scanWithDualStrategy(nomor_hp) {
  const primaryResult = await hitApiPrimary(nomor_hp);
  
  if (primaryResult.success) {
    return primaryResult;
  }
  
  const secondaryResult = await hitApiSecondary(nomor_hp);
  
  if (secondaryResult.success) {
    return secondaryResult;
  }
  
  return {
    success: false,
    source: 'both_failed',
    error: `Primary: ${primaryResult.error}, Secondary: ${secondaryResult.error}`
  };
}

// Function untuk extract expired date dari berbagai format response
function extractExpiredDate(result) {
  if (!result.success || !result.data) {
    return null;
  }
  
  if (result.source === 'primary') {
    // KHFY format - structure yang benar
    const data = result.data.data;
    if (data && data.member_info && data.member_info.end_date) {
      // Convert timestamp to readable date dengan timezone Indonesia
      const expiredTimestamp = data.member_info.end_date;
      const expiredDate = new Date(expiredTimestamp * 1000);
      
      // Format ke DD-MM-YYYY dengan timezone Indonesia (WIB)
      const options = {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      };
      const formattedDate = expiredDate.toLocaleDateString('en-GB', options);
      return formattedDate.replace(/\//g, '-'); // Ubah DD/MM/YYYY ke DD-MM-YYYY
    }
  } else if (result.source === 'secondary') {
    // Hidepulsa format
    const data = result.data.data;
    if (data && data.expired) {
      return data.expired;
    }
  }
  
  return null;
}

// Function untuk get source indicator
function getSourceIndicator(source) {
  switch (source) {
    case 'primary': return '🟢 KHFY';
    case 'secondary': return '⚪ H-P';
    default: return '❌ FAIL';
  }
}

const stateResetTanggal = new Map();
const rekapResetData = new Map(); // Untuk menyimpan data berdasarkan tanggal
const globalRekapData = new Map(); // Untuk menyimpan rekap global per chat

function isAuthorized(id) {
  return id.toString() === process.env.ADMIN_ID;
}

// Function untuk format tanggal reset (DD MMMM YYYY)
function formatResetDate(dateObj) {
  const options = { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  };
  return dateObj.toLocaleDateString('id-ID', options);
}

module.exports = (bot) => {
  // Handler untuk callback query reset_tanggal
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // Tambah handler untuk rekap
    if (data !== 'reset_tanggal' && data !== 'rekap_reset') {
      return;
    }

    if (!isAuthorized(from.id)) {
      await bot.answerCallbackQuery(id, {
        text: 'Anda tidak memiliki akses untuk fitur ini',
        show_alert: true
      });
      return;
    }

    if (data === 'reset_tanggal') {
      try {
        if (!isAuthorized(from.id)) {
          try {
            if (message && message.text) {
              await bot.editMessageText('❌ Anda tidak memiliki akses untuk fitur ini.', {
                chat_id: chatId,
                message_id: msgId
              });
            } else {
              await bot.sendMessage(chatId, '❌ Anda tidak memiliki akses untuk fitur ini.');
            }
          } catch (error) {
            await bot.sendMessage(chatId, '❌ Anda tidak memiliki akses untuk fitur ini.');
          }
          return;
        }

        // Clear previous state and data
        stateResetTanggal.clear();
        rekapResetData.clear();
        globalRekapData.delete(chatId);

        // Set initial state  
        stateResetTanggal.set(chatId, {
          step: 'waiting_numbers',
          startTime: Date.now(),
          results: []
        });

        // Kirim message baru untuk input (seperti scan_bekasan.js)
        await bot.sendMessage(chatId,
          `📅 <b>SCAN TANGGAL RESET MASA AKTIF</b>\n\n` +
          `🔍 Masukan nomor, pisah dengan enter/baris baru:\n\n` +
          `📝 <b>Contoh:</b>\n` +
          `08123456789\n08234567890\n08345678901\n\n` +
          `⚠️ Ketik "exit" untuk membatalkan`,
          { parse_mode: 'HTML' }
        );

      } catch (error) {
        console.error('Error handling reset_tanggal:', error);
        await bot.answerCallbackQuery(id, {
          text: 'Terjadi kesalahan sistem',
          show_alert: true
        });
      }
    }

    if (data === 'rekap_reset') {
      try {
        const rekapData = globalRekapData.get(chatId) || [];
        if (rekapData.length === 0) {
          await bot.answerCallbackQuery(id, {
            text: "Tidak ada data rekap tanggal reset",
            show_alert: true
          });
          return;
        }

        // Sort berdasarkan tanggal dari muda ke tua
        const sortedData = [...rekapData].sort((a, b) => {
          const dateA = parseExpiredDate(a.expired);
          const dateB = parseExpiredDate(b.expired);
          
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          
          return dateA.getTime() - dateB.getTime(); // Ascending (muda ke tua)
        });

        // Group berdasarkan tanggal
        const groupedData = new Map();
        sortedData.forEach(item => {
          const resetDate = formatResetDate(parseExpiredDate(item.expired));
          if (!groupedData.has(resetDate)) {
            groupedData.set(resetDate, []);
          }
          groupedData.get(resetDate).push(item);
        });

        // Format rekap text
        let rekapText = `📅 <b>REKAP TANGGAL RESET</b>\n`;
        rekapText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        for (const [resetDate, items] of groupedData) {
          rekapText += `🗓️ <b>${resetDate}</b> (${items.length} nomor)\n`;
          
          for (const item of items) {
            const sourceIcon = getSourceIndicator(item.source);
            rekapText += `   📱 <code>${item.nomor}</code> ${sourceIcon}\n`;
          }
          rekapText += `\n`;
        }

        // Kirim rekap dalam chunks jika terlalu panjang
        const maxLength = 4000;
        if (rekapText.length > maxLength) {
          const chunks = [];
          let currentChunk = '';
          const lines = rekapText.split('\n');
          
          for (const line of lines) {
            if (currentChunk.length + line.length + 1 > maxLength) {
              if (currentChunk) chunks.push(currentChunk);
              currentChunk = line + '\n';
            } else {
              currentChunk += line + '\n';
            }
          }
          if (currentChunk) chunks.push(currentChunk);

          for (let i = 0; i < chunks.length; i++) {
            await bot.sendMessage(chatId, 
              `${chunks[i]}${i < chunks.length - 1 ? '\n<i>...lanjutan berikutnya...</i>' : ''}`,
              { parse_mode: 'HTML' }
            );
          }
        } else {
          await bot.sendMessage(chatId, rekapText, { 
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 KEMBALI", callback_data: "menu_admin" }]
              ]
            }
          });
        }

        await bot.answerCallbackQuery(id);

      } catch (error) {
        console.error('Error handling rekap_reset:', error);
        await bot.answerCallbackQuery(id, {
          text: 'Terjadi kesalahan saat membuat rekap',
          show_alert: true
        });
      }
    }
  });

  // Handler untuk menerima nomor HP
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const state = stateResetTanggal.get(chatId);

    if (!state || state.step !== 'waiting_numbers') {
      return;
    }

    if (!isAuthorized(msg.from.id)) {
      await bot.sendMessage(chatId, '❌ Anda tidak memiliki akses untuk fitur ini.');
      return;
    }

    try {
      // Check untuk exit command
      if (text.toLowerCase() === 'exit') {
        stateResetTanggal.delete(chatId);
        await bot.sendMessage(chatId, 
          '❌ <b>Scan tanggal reset dibatalkan</b>\n\n' +
          'Silakan pilih menu lain dari daftar yang tersedia.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Parse nomor dari input
      let nomorList = [];
      if (text.includes('\n')) {
        nomorList = text.split('\n').map(n => n.trim()).filter(n => n);
      } else if (text.includes(',')) {
        nomorList = text.split(',').map(n => n.trim()).filter(n => n);
      } else {
        nomorList = [text.trim()];
      }

      // Validasi nomor
      const validNomor = [];
      for (const nomor of nomorList) {
        const cleanNomor = nomor.replace(/\D/g, '');
        if (cleanNomor.length >= 10 && cleanNomor.length <= 15) {
          if (cleanNomor.startsWith('08') || cleanNomor.startsWith('628') || cleanNomor.startsWith('62')) {
            validNomor.push(nomor.trim());
          }
        }
      }

      if (validNomor.length === 0) {
        await bot.sendMessage(chatId, 
          '❌ Tidak ada nomor valid yang ditemukan.\n\n' +
          'Pastikan format nomor benar (08xxx atau 628xxx).'
        );
        return;
      }

      // Update state  
      stateResetTanggal.set(chatId, {
        ...state,
        step: 'processing',
        numbers: validNomor
      });

      // Clear rekap data
      rekapResetData.clear();

      // Status tracking
      let completedCount = 0;
      let primaryCount = 0;
      let secondaryCount = 0;
      let failedCount = 0;

      // Process each number sequentially (satu per satu)
      for (let index = 0; index < validNomor.length; index++) {
        const nomor = validNomor[index];
        
        try {
          const result = await scanWithDualStrategy(nomor);
          completedCount++;

          if (result.success) {
            const expired = extractExpiredDate(result);
            const source = result.source;
            
            // Update counters
            if (source === 'primary') primaryCount++;
            else if (source === 'secondary') secondaryCount++;

            const displayNomor = formatNomorForDisplay(nomor);
            const sourceIcon = getSourceIndicator(source);
            
            // Kirim hasil per nomor (pesan baru)
            await bot.sendMessage(chatId, 
              `📱 <code>${displayNomor}</code> ${sourceIcon}\n` +
              `📅 ${expired || 'Tidak tersedia'}`,
              { parse_mode: 'HTML' }
            );
            
            if (expired && expired !== 'Tidak tersedia') {
              // Parse expired date
              const expiredDate = parseExpiredDate(expired);
              if (expiredDate && !isNaN(expiredDate.getTime())) {
                const resetDate = formatResetDate(expiredDate);

                // Grouping berdasarkan tanggal reset
                if (!rekapResetData.has(resetDate)) {
                  rekapResetData.set(resetDate, []);
                }
                rekapResetData.get(resetDate).push({
                  nomor: displayNomor,
                  expired: expired,
                  source: source
                });

                // Simpan juga ke global rekap data untuk tombol REKAP
                if (!globalRekapData.has(chatId)) {
                  globalRekapData.set(chatId, []);
                }
                globalRekapData.get(chatId).push({
                  nomor: displayNomor,
                  expired: expired,
                  source: source
                });
              }
            }

          } else {
            failedCount++;
            const displayNomor = formatNomorForDisplay(nomor);
            
            // Kirim hasil error per nomor
            await bot.sendMessage(chatId, 
              `📱 <code>${displayNomor}</code> ❌ GAGAL\n` +
              `💥 ${result.error}`,
              { parse_mode: 'HTML' }
            );
          }

        } catch (error) {
          console.error('Error processing nomor:', nomor, error);
          failedCount++;
          
          const displayNomor = formatNomorForDisplay(nomor);
          await bot.sendMessage(chatId, 
            `📱 <code>${displayNomor}</code> ❌ ERROR\n` +
            `💥 ${error.message}`,
            { parse_mode: 'HTML' }
          );
        }
      }

      // Final completion message dengan tombol REKAP
      await bot.sendMessage(chatId,
        `🎉 <b>SCAN TANGGAL RESET PAKET BERHASIL</b>\n\n` +
        `📊 Total: ${validNomor.length} nomor\n` +
        `✅ Berhasil: ${primaryCount + secondaryCount}\n` +
        `❌ Gagal: ${failedCount}\n\n` +
        `👆 <b>KLIK TOMBOL REKAP UNTUK MELIHAT PENGELOMPOKAN</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📅 REKAP RESET", callback_data: "rekap_reset" }
              ],
              [
                { text: "🔙 KEMBALI", callback_data: "menu_admin" }
              ]
            ]
          }
        }
      );

      // Clear state
      stateResetTanggal.delete(chatId);

    } catch (error) {
      console.error('Error processing numbers for reset tanggal:', error);
      await bot.sendMessage(chatId, 
        '💥 Terjadi kesalahan saat memproses nomor.\n' +
        'Silakan coba lagi dengan format yang benar.'
      );
      stateResetTanggal.delete(chatId);
    }
  });
};
