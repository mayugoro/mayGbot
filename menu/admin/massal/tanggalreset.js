const axios = require('axios');
require('dotenv').config({ quiet: true });
// Import Input Exiter utilities untuk modern pattern
const { sendStyledInputMessage, autoDeleteMessage, EXIT_KEYWORDS } = require('../../../utils/exiter');

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

// Function untuk generate input form menggunakan modern Input Exiter pattern
const generateTanggalResetInputMessage = () => {
  const mainText = `📅 SCAN TANGGAL RESET MASA AKTIF`;
  const subtitle = `🔍 Masukan nomor, pisah dengan enter/baris baru:\n\n📝 Contoh:\n08123456789\n08234567890\n08345678901`;
  
  return { mainText, subtitle };
};

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

        // Kirim styled input message menggunakan modern utility
        const inputMessage = generateTanggalResetInputMessage();
        const inputMsg = await sendStyledInputMessage(bot, chatId, inputMessage.mainText, inputMessage.subtitle);
        
        // Track input message untuk cleanup saat exit
        const currentState = stateResetTanggal.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        stateResetTanggal.set(chatId, currentState);
        
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
    if (!msg.text || !msg.from) return;
    
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const state = stateResetTanggal.get(chatId);

    // Check if this chat is in reset date input mode
    if (!state || state.step !== 'waiting_numbers') {
      return;
    }

    if (!isAuthorized(msg.from.id)) {
      await bot.sendMessage(chatId, '❌ Anda tidak memiliki akses untuk fitur ini.');
      return;
    }

    // === CEK CANCEL/EXIT ===
    if (EXIT_KEYWORDS.COMBINED.includes(text)) {
      // Cleanup input message jika ada
      if (state.inputMessageId) {
        await autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
      }
      // Clear state and auto delete user message
      stateResetTanggal.delete(chatId);
      await autoDeleteMessage(bot, chatId, msg.message_id, 100);
      return;
    }

    const nomorList = text.split(/\n|\r/).map(s => s.trim()).filter(s => s.length > 9);
    if (nomorList.length === 0) {
      try {
        const errorMsg = await bot.sendMessage(chatId, '❌ Masukkan minimal satu nomor.');
        await autoDeleteMessage(bot, chatId, errorMsg.message_id, 2000);
        await autoDeleteMessage(bot, chatId, msg.message_id, 100);
      } catch (e) {
        console.error('Error sending validation message:', e);
      }
      return;
    }

    // Hapus pesan input user dan input message (modern auto-delete)
    await autoDeleteMessage(bot, chatId, msg.message_id, 100);
    if (state.inputMessageId) {
      await autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
    }

    // Kirim pesan processing
    let processingMsg = null;
    try {
      processingMsg = await bot.sendMessage(chatId, '<i>Sedang diproses, mohon tunggu...</i>', { parse_mode: 'HTML' });
    } catch (e) {
      console.error('Error sending processing message:', e);
    }

    stateResetTanggal.delete(chatId);

    // Start concurrent scanning process
    let currentStatusMsg = null;
    let completedCount = 0;
    let primaryCount = 0;
    let secondaryCount = 0;
    let failedCount = 0;
    let rekapStokArray = [];

    // === CONCURRENT PROCESSING WITH REAL-TIME STREAMING ===
    
    // Hapus processing message dan kirim status awal setelah delay singkat
    setTimeout(async () => {
      if (processingMsg) {
        await autoDeleteMessage(bot, chatId, processingMsg.message_id, 100);
      }
      try {
        currentStatusMsg = await bot.sendMessage(chatId, `📅 CONCURRENT SCAN ${nomorList.length} nomor - Dual API Strategy!`);
      } catch (e) {
        console.error('Error sending initial status:', e);
      }
    }, 800);

    // Clear rekap data
    rekapResetData.clear();

    // Function untuk process dan kirim hasil secara real-time (seperti scan_bekasan.js)
    const processAndSendResult = async (result, originalIndex) => {
      completedCount++;
      const nomor_hp = result.nomor;
      
      try {
        if (result.success) {
          const expired = extractExpiredDate(result);
          const source = result.source;
          
          // Update counters
          if (source === 'primary') primaryCount++;
          else if (source === 'secondary') secondaryCount++;

          const displayNomor = formatNomorForDisplay(nomor_hp);
          const sourceIcon = getSourceIndicator(source);
          
          // 🚀 KIRIM LANGSUNG HASIL PER NOMOR (REAL-TIME!)
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
          const displayNomor = formatNomorForDisplay(nomor_hp);
          
          // 🚀 KIRIM LANGSUNG ERROR (REAL-TIME!)
          await bot.sendMessage(chatId, 
            `📱 <code>${displayNomor}</code> ❌ GAGAL\n` +
            `💥 ${result.error}`,
            { parse_mode: 'HTML' }
          );
        }

      } catch (sendError) {
        console.error('Error sending real-time result:', sendError);
      }
    };

    // Launch semua API calls dengan real-time processing (seperti scan_bekasan.js)
    const allPromises = nomorList.map((nomor_hp, index) => 
      scanWithDualStrategy(nomor_hp).then(result => {
        // Process dan kirim hasil segera setelah API call selesai
        return processAndSendResult({...result, nomor: nomor_hp, index}, index);
      }).catch(error => {
        // Handle error dan kirim juga
        const errorResult = {
          success: false,
          error: error.message,
          nomor: nomor_hp,
          index: index,
          source: 'promise_error'
        };
        return processAndSendResult(errorResult, index);
      })
    );

    // Tunggu SEMUA hasil dikirim (tapi pengiriman sudah real-time)
    await Promise.allSettled(allPromises);

    // Final completion message dengan tombol REKAP
    await bot.sendMessage(chatId,
      `🎉 <b>SCAN TANGGAL RESET PAKET BERHASIL</b>\n\n` +
      `📊 Total: ${nomorList.length} nomor\n` +
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

  });
};
