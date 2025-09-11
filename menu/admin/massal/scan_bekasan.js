const axios = require('axios');
require('dotenv').config({ quiet: true });
const { calculateDaysDiff, formatDaysDiff, parseToJakartaDate } = require('../../../utils/date');

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

// Helper function untuk parse tanggal expired dalam berbagai format
function parseExpiredDate(dateString) {
  if (!dateString || dateString === 'Tidak tersedia') {
    return new Date('9999-12-31');
  } else if (dateString.includes('-')) {
    const parts = dateString.split('-');
    if (parts[0].length === 4) {
      // Format YYYY-MM-DD - gunakan parseToJakartaDate dari utils
      return parseToJakartaDate(dateString) || new Date('9999-12-31');
    } else {
      // Format DD-MM-YYYY (seperti dari API scan bekasan)
      const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      return parseToJakartaDate(isoDate) || new Date('9999-12-31');
    }
  } else {
    return new Date(dateString);
  }
}

// Function untuk hit API PRIMARY (khfy-store)
async function hitApiPrimary(nomor_hp) {
  try {
    const formattedNomor = formatNomorToInternational(nomor_hp);
    
    // Buat form data sesuai dokumentasi API
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('nomor_hp', formattedNomor);
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
      const message = responseData.message || '';
      
      // Cek pesan error dalam response
      if (message.includes('Tidak mendapatkan respon yang di inginkan') || 
          message.includes('tidak ditemukan') ||
          message.includes('tidak di temukan') ||
          message.includes('gagal') ||
          responseData.status === false ||
          !responseData.data) {
        throw new Error(`Primary API error: ${message}`);
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
    
    if (response.data) {
      return {
        success: true,
        source: 'secondary',
        data: response.data
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

// Function untuk scan dengan dual API strategy
async function scanWithDualStrategy(nomor_hp) {
  // Step 1: Try API PRIMARY
  const primaryResult = await hitApiPrimary(nomor_hp);
  
  if (primaryResult.success) {
    return primaryResult;
  }
  
  // Step 2: Fallback to API SECONDARY
  const secondaryResult = await hitApiSecondary(nomor_hp);
  
  if (secondaryResult.success) {
    return secondaryResult;
  }
  
  // Both failed
  return {
    success: false,
    source: 'both_failed',
    error: `Primary: ${primaryResult.error}, Secondary: ${secondaryResult.error}`
  };
}

const stateInfoAkrab = new Map();
const rekapStokData = new Map();
const rekapWarningData = new Map(); // Tambahan untuk rekap warning
const rekapDangerData = new Map(); // Tambahan untuk rekap danger

function isAuthorized(id) {
  return id.toString() === process.env.ADMIN_ID;
}

// Helper function untuk menghitung selisih hari dengan timezone Jakarta (+1 adjustment untuk scan_bekasan)
function calculateDaysDiffScanBekasan(expiredString) {
  if (expiredString === 'Tidak tersedia') {
    return null;
  }
  
  // Gunakan utility dari utils/date.js untuk konsistensi timezone
  const standardDiff = calculateDaysDiff(expiredString);
  
  // Tambahkan +1 hari sesuai business logic scan_bekasan
  return standardDiff + 1;
}

// Helper function untuk format header berdasarkan selisih hari
function formatDaysHeader(expiredString) {
  if (expiredString === 'Tidak tersedia') {
    return `<b>Expired: Tidak tersedia</b>\n`;
  }
  
  const diffDays = calculateDaysDiffScanBekasan(expiredString);
  
  if (diffDays > 1) {
    return `<b>⚡️BEKASAN ${diffDays} HARI</b>\n`;
  } else if (diffDays === 1) {
    return `<b>⚡️BEKASAN HARI INI</b>\n`;
  } else {
    return `<b>⚡️BEKASAN EXPIRED ${Math.abs(diffDays)} HARI LALU</b>\n`;
  }
}

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const messageId = message?.message_id;
    const idTelegram = from?.id;

    // Hanya handle callback query yang spesifik untuk scan bekasan
    if (data !== "infoakrab" && data !== "rekap_stok" && data !== "rekap_warning" && data !== "rekap_danger") {
      return; // Biarkan handler lain yang menangani
    }

    if (!chatId || !messageId || !idTelegram) {
      console.error('Invalid callback query data in scan_bekasan');
      return;
    }

    if (!isAuthorized(idTelegram)) {
      return bot.answerCallbackQuery(id, {
        text: "ente mau ngapain wak🗿",
        show_alert: true
      }).catch(err => console.error('Error answering callback query:', err));
    }

    try {
      if (data === "infoakrab") {
        stateInfoAkrab.set(chatId, { mode: 'scan_bekasan', menuMessageId: messageId });
        rekapStokData.delete(chatId);
        rekapWarningData.delete(chatId); // Clear warning data juga
        rekapDangerData.delete(chatId); // Clear danger data juga
        
        // JANGAN hapus menu, kirim input form di bawah menu (sama seperti tambah_stok dll)
        const inputMsg = await bot.sendMessage(chatId, '🔍 <b>SCAN BEKASAN</b>\n\nMasukan nomor, pisah dengan enter/baris baru:\n\nContoh:\n087777111111\n087777222222\n087777333333\n\n💡 Ketik "exit" untuk membatalkan', {
          parse_mode: 'HTML'
        });
        
        // Simpan message ID input untuk bisa diedit nanti
        const currentState = stateInfoAkrab.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        stateInfoAkrab.set(chatId, currentState);
        
        await bot.answerCallbackQuery(id);
        return;
      }

      if (data === "rekap_stok") {
        const rekapData = rekapStokData.get(chatId) || [];
        if (rekapData.length === 0) {
          return bot.answerCallbackQuery(id, {
            text: "Tidak ada data rekap stok",
            show_alert: true
          });
        }

        // Group data berdasarkan expired date
        const groupedByExpired = {};
        rekapData.forEach(item => {
          const expiredKey = item.expired || 'Tidak tersedia';
          if (!groupedByExpired[expiredKey]) {
            groupedByExpired[expiredKey] = [];
          }
          groupedByExpired[expiredKey].push(item.nomor);
        });

        // Sort expired dates (yang paling cepat expired di atas)
        const sortedExpiredDates = Object.keys(groupedByExpired).sort((a, b) => {
          const dateA = parseExpiredDate(a);
          const dateB = parseExpiredDate(b);
          return dateA - dateB;
        });

        let rekapText = `<b>REKAP ✅</b>\n\n`;
        
        sortedExpiredDates.forEach(expired => {
          const nomorList = groupedByExpired[expired];
          rekapText += formatDaysHeader(expired);
          
          // TIDAK menghilangkan duplikasi - tampilkan semua nomor sesuai jumlah slot kosong
          nomorList.forEach(nomor => {
            rekapText += `<code>${nomor}</code>\n`;
          });
          rekapText += `\n`;
        });

        // Kirim rekap sebagai message baru, bukan edit menu
        const rekapMsg = await bot.sendMessage(chatId, rekapText, {
          parse_mode: 'HTML'
        });
        
        await bot.answerCallbackQuery(id);
        return;
      }

      if (data === "rekap_warning") {
        const rekapWarning = rekapWarningData.get(chatId) || [];
        if (rekapWarning.length === 0) {
          return bot.answerCallbackQuery(id, {
            text: "Tidak ada data rekap ⚠️",
            show_alert: true
          });
        }

        // Group data berdasarkan expired date (khusus warning)
        const groupedByExpired = {};
        rekapWarning.forEach(item => {
          const expiredKey = item.expired || 'Tidak tersedia';
          if (!groupedByExpired[expiredKey]) {
            groupedByExpired[expiredKey] = [];
          }
          groupedByExpired[expiredKey].push(item.nomor);
        });

        // Sort expired dates (yang paling cepat expired di atas)
        const sortedExpiredDates = Object.keys(groupedByExpired).sort((a, b) => {
          const dateA = new Date(a === 'Tidak tersedia' ? '9999-12-31' : a);
          const dateB = new Date(b === 'Tidak tersedia' ? '9999-12-31' : b);
          return dateA - dateB;
        });

        let rekapText = `<b>REKAP ⚠️</b>\n\n`;
        
        sortedExpiredDates.forEach(expired => {
          const nomorList = groupedByExpired[expired];
          rekapText += formatDaysHeader(expired);
          
          // Tampilkan semua nomor warning sesuai jumlah slot warning
          nomorList.forEach(nomor => {
            rekapText += `<code>${nomor}</code>\n`;
          });
          rekapText += `\n`;
        });

        // Kirim rekap warning sebagai message baru
        const rekapMsg = await bot.sendMessage(chatId, rekapText, {
          parse_mode: 'HTML'
        });
        
        await bot.answerCallbackQuery(id);
        return;
      }

      if (data === "rekap_danger") {
        const rekapDanger = rekapDangerData.get(chatId) || [];
        if (rekapDanger.length === 0) {
          return bot.answerCallbackQuery(id, {
            text: "Tidak ada data rekap ❗",
            show_alert: true
          });
        }

        // Group data berdasarkan expired date (khusus danger)
        const groupedByExpired = {};
        rekapDanger.forEach(item => {
          const expiredKey = item.expired || 'Tidak tersedia';
          if (!groupedByExpired[expiredKey]) {
            groupedByExpired[expiredKey] = [];
          }
          groupedByExpired[expiredKey].push(item.nomor);
        });

        // Sort expired dates (yang paling cepat expired di atas)
        const sortedExpiredDates = Object.keys(groupedByExpired).sort((a, b) => {
          const dateA = new Date(a === 'Tidak tersedia' ? '9999-12-31' : a);
          const dateB = new Date(b === 'Tidak tersedia' ? '9999-12-31' : b);
          return dateA - dateB;
        });

        let rekapText = `<b>REKAP ❗</b>\n\n`;
        
        sortedExpiredDates.forEach(expired => {
          const nomorList = groupedByExpired[expired];
          rekapText += formatDaysHeader(expired);
          
          // Tampilkan semua nomor danger sesuai jumlah slot danger
          nomorList.forEach(nomor => {
            rekapText += `<code>${nomor}</code>\n`;
          });
          rekapText += `\n`;
        });

        // Kirim rekap danger sebagai message baru
        const rekapMsg = await bot.sendMessage(chatId, rekapText, {
          parse_mode: 'HTML'
        });
        
        await bot.answerCallbackQuery(id);
        return;
      }

    } catch (error) {
      console.error('Error in scan_bekasan callback_query:', error);
      try {
        await bot.answerCallbackQuery(id, {
          text: "Terjadi kesalahan",
          show_alert: true
        });
      } catch (e) {
        console.error('Error answering callback query after error:', e);
      }
    }
  });

  bot.on('message', async (msg) => {
    if (!msg || !msg.chat || !msg.from || !msg.text) return;
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text.trim();

    const state = stateInfoAkrab.get(chatId);
    if (!state || state.mode !== 'scan_bekasan') return;
    
    if (text.startsWith("/")) return;
    if (!isAuthorized(userId)) {
      try {
        await bot.sendMessage(chatId, "ente siapa njir🗿");
      } catch (e) {
        console.error('Error sending unauthorized message:', e);
      }
      return;
    }

    // === CEK CANCEL/EXIT ===
    if (['exit', 'EXIT', 'Exit'].includes(text)) {
      // Hapus input form
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {
          // Ignore delete error
        }
      }
      
      stateInfoAkrab.delete(chatId);
      await bot.deleteMessage(chatId, msg.message_id);
      return;
    }

    const nomorList = text.split(/\n|\r/).map(s => s.trim()).filter(s => s.length > 9);
    if (nomorList.length === 0) {
      try {
        await bot.sendMessage(chatId, '❌ Masukkan minimal satu nomor.');
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        console.error('Error sending validation message:', e);
      }
      return;
    }

    // Hapus pesan input user dan form input
    if (state.inputMessageId) {
      try {
        await bot.deleteMessage(chatId, state.inputMessageId);
      } catch (e) {}
    }
    try {
      await bot.deleteMessage(chatId, msg.message_id);
    } catch (e) {}

    let rekapStokArray = [];
    let currentStatusMsg = null;

    // === MASSAL SERENTAK HARDCORE - NO RATE LIMIT ===
    
    // Kirim status awal
    try {
      currentStatusMsg = await bot.sendMessage(chatId, `📝 HARDCORE SCAN ${nomorList.length} nomor - NO RATE LIMIT!`);
    } catch (e) {
      console.error('Error sending initial status:', e);
    }

    // Function untuk scan single nomor dengan API Primary/Secondary strategy
    const scanSingleNomor = async (nomor_hp, index) => {
      try {
        const apiResult = await scanWithDualStrategy(nomor_hp);
        
        if (apiResult.success) {
          let data, slotList, expiredText;
          
          if (apiResult.source === 'primary') {
            // Data dari API utama (khfy-store)
            const primaryData = apiResult.data;
            
            // Convert API primary structure to secondary format
            const memberInfo = primaryData?.data?.member_info;
            if (memberInfo) {
              const allMembers = [...(memberInfo.members || []), ...(memberInfo.additional_members || [])];
              
              // Convert to secondary API format (data_slot)
              const convertedSlots = allMembers.map(member => ({
                "slot-ke": member.slot_id === 0 ? 0 : (member.slot_id || 1), // 0 untuk parent, >0 untuk member
                "nomor": member.msisdn || "",
                "nama": member.alias || "",
                "sisa-add": member.add_chances || 0
              }));
              
              // Extract expired date (convert timestamp to readable format)
              const expiredTimestamp = memberInfo.end_date;
              let convertedExpired = 'Tidak tersedia';
              if (expiredTimestamp) {
                const expiredDate = new Date(expiredTimestamp * 1000);
                convertedExpired = expiredDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
              }
              
              data = {
                data_slot: convertedSlots,
                expired: convertedExpired
              };
              
              slotList = data.data_slot;
              expiredText = data.expired;
              
            } else {
              // Fallback jika struktur tidak sesuai
              data = {
                data_slot: [],
                expired: 'Tidak tersedia'
              };
              slotList = [];
              expiredText = 'Tidak tersedia';
            }
            
          } else if (apiResult.source === 'secondary') {
            // Data dari API secondary (hidepulsa) - sudah fallback
            data = apiResult.data?.data || apiResult.data;
            slotList = data?.data_slot || [];
            expiredText = data?.expired || 'Tidak tersedia';
            
            // Cek apakah perlu retry untuk secondary API karena Redis cache issue
            const needsRetry = (!slotList || slotList.length === 0) && expiredText === 'Tidak tersedia';
            
            if (needsRetry) {
              try {
                const retryResponse = await axios.post(API_SECONDARY_FULL_URL, {
                  action: "info",
                  id_telegram: ADMIN_ID,
                  password: API_SECONDARY_PASSWORD,
                  nomor_hp
                }, {
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: API_SECONDARY_AUTH
                  },
                  timeout: 60000
                });
                
                if (retryResponse.data?.data) {
                  const retryData = retryResponse.data.data;
                  const retrySlotList = retryData?.data_slot || [];
                  const retryExpiredText = retryData?.expired || 'Tidak tersedia';
                  
                  // Gunakan hasil retry jika lebih baik
                  if (retrySlotList.length > 0 || retryExpiredText !== 'Tidak tersedia') {
                    return {
                      success: true,
                      data: retryData,
                      nomor: nomor_hp,
                      index: index,
                      source: 'secondary_retry'
                    };
                  }
                }
              } catch (retryError) {
                // Silently handle retry error
              }
              
              // Return original secondary result jika retry gagal/tidak ada improvement
              return {
                success: true,
                data: data,
                nomor: nomor_hp,
                index: index,
                source: 'secondary',
                emptyAfterRetry: true
              };
            }
          }
          
          // Return successful result
          return {
            success: true,
            data: data,
            nomor: nomor_hp,
            index: index,
            source: apiResult.source
          };
          
        } else {
          // Kedua API gagal
          return {
            success: false,
            error: apiResult.error,
            nomor: nomor_hp,
            index: index,
            source: 'both_failed'
          };
        }
        
      } catch (error) {
        return {
          success: false,
          error: error.message,
          nomor: nomor_hp,
          index: index,
          source: 'error'
        };
      }
    };

    // Update status ke scanning
    try {
      if (currentStatusMsg) {
        await bot.editMessageText(`♻️ LAUNCHING ${nomorList.length} CONCURRENT API CALLS!`, {
          chat_id: chatId,
          message_id: currentStatusMsg.message_id
        });
      }
    } catch (e) {
      console.error('Error updating status:', e);
    }

    // === FIRE ALL REQUESTS SIMULTANEOUSLY WITH REAL-TIME STREAMING! ===
    
    // Update status ke real-time streaming
    try {
      if (currentStatusMsg) {
        await bot.editMessageText(`⚡ REAL-TIME STREAMING ${nomorList.length} RESULTS...`, {
          chat_id: chatId,
          message_id: currentStatusMsg.message_id
        });
      }
    } catch (e) {
      console.error('Error updating streaming status:', e);
    }
    
    // Tracking variables untuk real-time statistics
    let primaryCount = 0;
    let secondaryCount = 0;
    let retryCount = 0;
    let failedCount = 0;
    let completedCount = 0;
    let scanResults = [];
    
    // Function untuk process dan kirim hasil secara real-time
    const processAndSendResult = async (result, originalIndex) => {
      completedCount++;
      const nomor_hp = result.nomor;
      const index = result.index;
      
      // Update statistics counter
      if (result.success) {
        if (result.source === 'primary') {
          primaryCount++;
        } else if (result.source === 'secondary') {
          secondaryCount++;
        } else if (result.source === 'secondary_retry') {
          retryCount++;
        }
      } else {
        failedCount++;
      }
      
      try {
        if (result.success && result.data) {
          const data = result.data;
          const slotList = data?.data_slot || [];
          const expiredText = data?.expired || 'Tidak tersedia';

          const slotKosong = slotList.filter(slot => 
            slot["slot-ke"] !== 0 && (!slot.nomor || slot.nomor === "")
          );
          
          // Pisahkan slot kosong berdasarkan sisa_add dengan validasi ketat
          const slotKosongNormal = slotKosong.filter(slot => {
            const sisaAdd = slot['sisa-add'] || 0;
            return sisaAdd === 2 || sisaAdd === 3; // Hanya 2 atau 3
          });
          const slotKosongWarning = slotKosong.filter(slot => (slot['sisa-add'] || 0) === 1);
          const slotKosongDanger = slotKosong.filter(slot => (slot['sisa-add'] || 0) === 0);
          
          const jumlahSlotKosong = slotKosong.length;
          const jumlahSlotNormal = slotKosongNormal.length;
          const jumlahSlotWarning = slotKosongWarning.length;
          const jumlahSlotDanger = slotKosongDanger.length;

          let teks = `✅ <b>NOMOR ${index + 1}/${nomorList.length}</b> <code>[${completedCount}/${nomorList.length}]</code>`;
          
          // Info API source dengan icon
          if (result.source === 'primary') {
            teks += ` 🟢 KHFY`; // API Primary dengan bola hijau dan keterangan KHFY
          } else if (result.source === 'secondary') {
            teks += ` ⚪ H-P`; // API Secondary dengan bola putih dan keterangan H-P
          } else if (result.source === 'secondary_retry') {
            teks += ` ⚪ H-P (retry)`; // Secondary retry dengan bola putih dan keterangan H-P
          }
          
          // Info retry status tambahan (jika ada)
          if (result.emptyAfterRetry) {
            teks += ` ⚠️`;
          }
          
          teks += `\n📱 : <code>${nomor_hp}</code>\n`;
          teks += `📅 Expired : ${expiredText}\n\n`;
          
          if (jumlahSlotKosong > 0) {
            // Tambahkan nomor ke rekap normal (hanya sisa_add 2 atau 3)
            for (let j = 0; j < jumlahSlotNormal; j++) {
              rekapStokArray.push({
                nomor: nomor_hp,
                expired: expiredText,
                expiredDate: new Date(expiredText === 'Tidak tersedia' ? '9999-12-31' : expiredText),
                type: 'normal'
              });
            }
            
            // Tambahkan nomor ke rekap warning (khusus slot sisa_add = 1)
            for (let j = 0; j < jumlahSlotWarning; j++) {
              rekapStokArray.push({
                nomor: nomor_hp,
                expired: expiredText,
                expiredDate: new Date(expiredText === 'Tidak tersedia' ? '9999-12-31' : expiredText),
                type: 'warning'
              });
            }
            
            // Tambahkan nomor ke rekap danger (khusus slot sisa_add = 0)
            for (let j = 0; j < jumlahSlotDanger; j++) {
              rekapStokArray.push({
                nomor: nomor_hp,
                expired: expiredText,
                expiredDate: new Date(expiredText === 'Tidak tersedia' ? '9999-12-31' : expiredText),
                type: 'danger'
              });
            }
          } else {
            teks += `❌ TIDAK ADA SLOT KOSONG\n\n`;
          }

          // Detail slot
          teks += `📋 <b>DETAIL SLOT:</b>\n`;
          if (slotList.length > 0) {
            for (const slot of slotList) {
              if (slot["slot-ke"] === 0) continue;
              const sisaAdd = slot['sisa-add'] || 0;
              let status;
              if (slot.nomor && slot.nomor !== "") {
                status = '❌ Terisi';
              } else {
                // Slot kosong - cek sisa_add untuk simbol khusus
                if (sisaAdd === 1) {
                  status = '⚠️ Kosong';  // Simbol khusus untuk sisa_add = 1
                } else if (sisaAdd === 0) {
                  status = '❗ Kosong';  // Simbol khusus untuk sisa_add = 0
                } else {
                  status = '✅ Kosong';  // Normal kosong (sisa_add = 2 atau 3)
                }
              }
              teks += `SLOT ${slot["slot-ke"]}: (${sisaAdd}) ${status}\n`;
            }
          } else {
            teks += `<i>Tidak ada data slot</i>\n`;
          }

          // Info tambahan jika data kosong setelah retry
          if (result.emptyAfterRetry) {
            teks += `\n⚠️ <i>Data tetap kosong setelah 2x hit API</i>\n`;
          }

          // Simpan hasil scan
          scanResults.push(teks);

          // 🚀 KIRIM LANGSUNG HASIL SCAN (REAL-TIME!)
          await bot.sendMessage(chatId, teks, { parse_mode: 'HTML' });

        } else {
          // Handle API error - KIRIM LANGSUNG JUGA
          const error = result.error || 'Unknown error';
          const errorText = `❌ <b>GAGAL SCAN NOMOR ${index + 1}/${nomorList.length}</b> <code>[${completedCount}/${nomorList.length}]</code>\n📱 : <code>${nomor_hp}</code>\n\n🚫 Error: ${error}`;
          
          scanResults.push(errorText);
          
          // 🚀 KIRIM LANGSUNG ERROR (REAL-TIME!)
          await bot.sendMessage(chatId, errorText, { parse_mode: 'HTML' });
        }
      } catch (sendError) {
        console.error('Error sending real-time result:', sendError);
      }
    };
    
    // Launch semua API calls dengan real-time processing
    const allPromises = nomorList.map((nomor_hp, index) => 
      scanSingleNomor(nomor_hp, index).then(result => {
        // Process dan kirim hasil segera setelah API call selesai
        return processAndSendResult(result, index);
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

    // Hapus status message yang tidak perlu lagi
    if (currentStatusMsg) {
      try {
        await bot.deleteMessage(chatId, currentStatusMsg.message_id);
      } catch (e) {
        // Ignore delete error
      }
    }

    // Sortir berdasarkan tanggal expired (yang paling cepat expired di atas)
    rekapStokArray.sort((a, b) => a.expiredDate - b.expiredDate);
    
    // Pisahkan data normal, warning, dan danger
    const rekapNormal = rekapStokArray.filter(item => item.type === 'normal');
    const rekapWarning = rekapStokArray.filter(item => item.type === 'warning');
    const rekapDanger = rekapStokArray.filter(item => item.type === 'danger');
    
    rekapStokData.set(chatId, rekapNormal);
    rekapWarningData.set(chatId, rekapWarning);
    rekapDangerData.set(chatId, rekapDanger);

    // Summary hasil scan
    const totalNomor = nomorList.length;
    const totalSlotNormal = rekapNormal.length;
    const totalSlotWarning = rekapWarning.length;
    const totalSlotDanger = rekapDanger.length;
    const totalSlotKosong = totalSlotNormal + totalSlotWarning + totalSlotDanger;
    const nomorBerhasil = scanResults.filter(result => result.includes('✅')).length;
    const nomorGagal = scanResults.filter(result => result.includes('❌ GAGAL')).length;

    try {
      const summaryText = `<code>🎯 REAL-TIME STREAMING COMPLETED!\n` +
        `\n` +
        `📊 Total Nomor : ${totalNomor}\n` +
        `✅ Berhasil    : ${nomorBerhasil}\n` +
        `❌ Gagal       : ${nomorGagal}\n` +
        `SLOT ❗        : ${totalSlotDanger}\n` +
        `SLOT ⚠️        : ${totalSlotWarning}\n` +
        `SLOT ✅        : ${totalSlotNormal}\n` +
        `\n` +
        `🟢 API KHFY    : ${primaryCount}\n` +
        `⚪ API H-P     : ${secondaryCount}\n` +
        `⚪ H-P Retry   : ${retryCount}\n` +
        `❌ Both Failed : ${failedCount}\n` +
        `\n` +
        `⚡ Semua hasil dikirim REAL-TIME!\n` +
        `===Limit 0 ======Limit 1======Limit 2=</code>`;

      const completionMsg = await bot.sendMessage(chatId, summaryText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: "❗ REKAP ❗", callback_data: "rekap_danger" },
              { text: "⚠️ REKAP ⚠️", callback_data: "rekap_warning" },
              { text: "✅ REKAP ✅", callback_data: "rekap_stok" }
            ],
            [
              { text: "🔙 KEMBALI", callback_data: "menu_admin" }
            ]
          ]
        }
      });
      
      // TIDAK auto delete completion message - biarkan tetap terlihat
      
    } catch (e) {
      console.error('Error sending completion message:', e);
    }

    stateInfoAkrab.delete(chatId);
  });
};
