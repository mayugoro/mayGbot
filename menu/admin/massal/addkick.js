const axios = require('axios');//MASIH PAKAI API2❌❌❌
require('dotenv').config();

// API Configuration dari .env
const API_PRIMARY_BASE = process.env.API1;
const API_PRIMARY_ADD_ENDPOINT = process.env.ADD1;
const API_PRIMARY_KICK_ENDPOINT = process.env.KICK1;
const API_PRIMARY_INFO_ENDPOINT = process.env.CEKSLOT1;
const API_PRIMARY_TOKEN = process.env.APIKEY1;

const API_SECONDARY_BASE = process.env.API2;
const API_SECONDARY_ENDPOINT = process.env.ADD2; // Same endpoint for add/kick/info
const API_SECONDARY_AUTH = process.env.APIKEY2;
const API_SECONDARY_PASSWORD = process.env.PASSWORD2;

const ADMIN_ID = process.env.ADMIN_ID;

// Storage untuk add-kick states
const addKickStates = new Map(); // key: chatId, value: { step, data }

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

// Function untuk get slot info menggunakan API Primary (KHFY-Store)
const getSlotInfoPrimary = async (nomor_hp) => {
  try {
    const formattedNomor = formatNomorToInternational(nomor_hp);
    
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('id_parent', formattedNomor);

    const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_INFO_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    if (response.data?.status === 'success' && response.data?.data) {
      const members = response.data.data.members || [];
      // Convert KHFY format to standard slot format
      const slots = members.map((member, index) => ({
        'slot-ke': index.toString(),
        nomor: member.phone || member.nomor || '',
        nama: member.name || member.nama || '',
        member_id: member.id || member.member_id,
        'sisa-add': member.sisa_add || member['sisa-add'] || 0,
        expired: member.expired || '',
        status: member.status || 'aktif'
      }));
      
      return {
        success: true,
        slots,
        source: 'primary'
      };
    }
    
    return { success: false, slots: [], source: 'primary' };
  } catch (error) {
    // Error handled silently
    return { success: false, slots: [], error: error.message, source: 'primary' };
  }
};

// Function untuk get slot info menggunakan API Secondary (HidePulsa)
const getSlotInfoSecondary = async (nomor_hp) => {
  try {
    const formattedNomor = formatNomorToLocal(nomor_hp);
    
    const response = await axios.post(API_SECONDARY_BASE + API_SECONDARY_ENDPOINT, {
      action: "info",
      id_telegram: ADMIN_ID,
      password: API_SECONDARY_PASSWORD,
      nomor_hp: formattedNomor
    }, {
      headers: {
        "Content-Type": "application/json",
        Authorization: API_SECONDARY_AUTH
      },
      timeout: 30000
    });

    const slots = response.data?.data?.data_slot || [];
    
    // Jika tidak ada data, hit sekali lagi (untuk Redis cache issue)
    if (slots.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const secondResponse = await axios.post(API_SECONDARY_BASE + API_SECONDARY_ENDPOINT, {
        action: "info",
        id_telegram: ADMIN_ID,
        password: API_SECONDARY_PASSWORD,
        nomor_hp: formattedNomor
      }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: API_SECONDARY_AUTH
        },
        timeout: 30000
      });
      
      const secondSlots = secondResponse.data?.data?.data_slot || [];
      return {
        success: secondSlots.length > 0,
        slots: secondSlots,
        source: 'secondary'
      };
    }
    
    return {
      success: slots.length > 0,
      slots,
      source: 'secondary'
    };
    
  } catch (error) {
    // Error handled silently
    return { success: false, slots: [], error: error.message, source: 'secondary' };
  }
};

// Function untuk get slot info dengan dual API strategy
const getSlotInfoDualAPI = async (nomor_hp) => {
  // Try primary API first
  const primaryResult = await getSlotInfoPrimary(nomor_hp);
  if (primaryResult.success && primaryResult.slots.length > 0) {
    return {
      slots: primaryResult.slots,
      source: '🟢 KHFY'
    };
  }
  
  // Fallback to secondary API
  const secondaryResult = await getSlotInfoSecondary(nomor_hp);
  if (secondaryResult.success && secondaryResult.slots.length > 0) {
    return {
      slots: secondaryResult.slots,
      source: '⚪ H-P'
    };
  }
  
  // Both APIs failed or returned empty
  return {
    slots: [],
    source: '❌ GAGAL',
    error: secondaryResult.error || primaryResult.error || 'Both APIs returned empty'
  };
};

// Function untuk get info slot dari nomor HP (LEGACY - kept for compatibility)
const getSlotInfo = async (nomor_hp) => {
  const result = await getSlotInfoDualAPI(nomor_hp);
  return result.slots;
};

// Function untuk add anggota menggunakan API Primary (KHFY-Store)
const addAnggotaPrimary = async (nomor_hp, slot_id, nomor_anggota, nama_anggota = "TUMBAL", parent_name = "XL") => {
  try {
    const formattedNomor = formatNomorToInternational(nomor_hp);
    const formattedAnggota = formatNomorToInternational(nomor_anggota);
    
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('id_parent', formattedNomor);
    formData.append('msisdn', formattedAnggota);
    formData.append('member_id', ''); // Empty for new member
    formData.append('slot_id', slot_id);
    formData.append('parent_name', parent_name);
    formData.append('child_name', nama_anggota);

    const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_ADD_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    if (response.data?.status === 'success') {
      return {
        success: true,
        data: response.data,
        source: 'primary',
        member_id: response.data?.data?.member_id || null, // Important untuk kick nanti
        added_number: formattedAnggota
      };
    }
    
    return {
      success: false,
      error: response.data?.message || 'Primary ADD failed',
      source: 'primary'
    };
  } catch (error) {
    // Error handled silently
    return {
      success: false,
      error: error.message,
      source: 'primary'
    };
  }
};

// Function untuk add anggota menggunakan API Secondary (HidePulsa)
const addAnggotaSecondary = async (nomor_hp, nomor_slot, nomor_anggota, nama_anggota = "TUMBAL", nama_admin = "XL") => {
  try {
    const formattedNomor = formatNomorToLocal(nomor_hp);
    const formattedAnggota = formatNomorToLocal(nomor_anggota);
    
    const response = await axios.post(API_SECONDARY_BASE + API_SECONDARY_ENDPOINT, {
      action: "add",
      id_telegram: ADMIN_ID,
      password: API_SECONDARY_PASSWORD,
      nomor_hp: formattedNomor,
      nomor_slot: parseInt(nomor_slot),
      nomor_anggota: formattedAnggota,
      nama_anggota,
      nama_admin
    }, {
      headers: {
        "Content-Type": "application/json",
        Authorization: API_SECONDARY_AUTH
      },
      timeout: 30000
    });

    if (response.data?.status === 'success') {
      return {
        success: true,
        data: response.data,
        source: 'secondary',
        added_number: formattedAnggota,
        slot_number: nomor_slot
      };
    }
    
    return {
      success: false,
      error: response.data?.message || 'Secondary ADD failed',
      source: 'secondary'
    };
  } catch (error) {
    // Error handled silently
    return {
      success: false,
      error: error.message,
      source: 'secondary'
    };
  }
};

// Function untuk kick anggota menggunakan API Primary (KHFY-Store) - kick by member_id
const kickAnggotaPrimary = async (nomor_hp, member_id) => {
  try {
    const formattedNomor = formatNomorToInternational(nomor_hp);
    
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('id_parent', formattedNomor);
    formData.append('member_id', member_id);

    const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_KICK_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    return {
      success: response.data?.status === 'success' || response.data?.success === true,
      data: response.data,
      source: 'primary'
    };
  } catch (error) {
    // Error handled silently
    return {
      success: false,
      error: error.message,
      source: 'primary'
    };
  }
};

// Function untuk kick anggota menggunakan API Secondary (HidePulsa) - kick by slot number
const kickAnggotaSecondary = async (nomor_hp, nomor_slot) => {
  try {
    const formattedNomor = formatNomorToLocal(nomor_hp);
    
    const response = await axios.post(API_SECONDARY_BASE + API_SECONDARY_ENDPOINT, {
      action: "kick",
      id_telegram: ADMIN_ID,
      password: API_SECONDARY_PASSWORD,
      nomor_hp: formattedNomor,
      nomor_slot: parseInt(nomor_slot)
    }, {
      headers: {
        "Content-Type": "application/json",
        Authorization: API_SECONDARY_AUTH
      },
      timeout: 30000
    });

    return {
      success: response.data?.status === 'success',
      data: response.data,
      source: 'secondary'
    };
  } catch (error) {
    // Error handled silently
    return {
      success: false,
      error: error.message,
      source: 'secondary'
    };
  }
};

// Function untuk add-kick combo dengan dual API strategy - COMBO BENAR
const addKickCombo = async (nomor_hp, slotData, nomor_tumbal) => {
  const { 'slot-ke': nomor_slot, member_id, 'sisa-add': sisaAdd } = slotData;
  
  // STEP 1: Get fresh slot info dulu (API1+CEKSLOT1) - COMBO PATTERN
  const slotInfoResult = await getSlotInfoPrimary(nomor_hp);
  
  if (slotInfoResult.success && slotInfoResult.slots.length > 0) {
    // STEP 2: Try primary API ADD (API1+ADD1) dengan data dari STEP 1
    const primaryAddResult = await addAnggotaPrimary(nomor_hp, slotData.slot_id || nomor_slot, nomor_tumbal);
    
    if (primaryAddResult.success) {
      // STEP 3: Success with primary ADD, wait then kick (API1+KICK1)
      await new Promise(resolve => setTimeout(resolve, 20000)); // 20 detik tunggu
      
      // Use member_id from ADD result, bukan dari slot info lama
      const primaryKickResult = await kickAnggotaPrimary(nomor_hp, primaryAddResult.member_id);
      
      return {
        success: primaryKickResult.success,
        source: primaryKickResult.success ? '🟢 KHFY' : '🟢 KHFY (ADD) / ❌ KICK FAILED',
        addResult: primaryAddResult,
        kickResult: primaryKickResult,
        tumbal: nomor_tumbal,
        slot: nomor_slot,
        combo: 'API1+CEKSLOT1+ADD1+KICK1'
      };
    }
  }
  
  // Primary COMBO failed, try secondary API (HidePulsa)
  const secondaryAddResult = await addAnggotaSecondary(nomor_hp, nomor_slot, nomor_tumbal);
  
  if (secondaryAddResult.success) {
    // Success with secondary ADD, now kick with secondary API
    await new Promise(resolve => setTimeout(resolve, 20000)); // 20 detik tunggu
    
    const secondaryKickResult = await kickAnggotaSecondary(nomor_hp, nomor_slot);
    
    return {
      success: secondaryKickResult.success,
      source: secondaryKickResult.success ? '⚪ H-P' : '⚪ H-P (ADD) / ❌ KICK FAILED',
      addResult: secondaryAddResult,
      kickResult: secondaryKickResult,
      tumbal: nomor_tumbal,
      slot: nomor_slot,
      combo: 'API2+ADD2+KICK2'
    };
  }
  
  // Both COMBO operations failed
  return {
    success: false,
    source: '❌ GAGAL',
    error: `Both COMBO failed - Primary: CEKSLOT1 issue or ADD1 failed, Secondary: ${secondaryAddResult.error}`,
    tumbal: nomor_tumbal,
    slot: nomor_slot,
    combo: 'FAILED'
  };
};

// Function untuk add anggota ke slot dengan timeout 30 detik (LEGACY - kept for compatibility)
const addAnggota = async (nomor_hp, nomor_slot, nomor_anggota) => {
  const slotData = { 'slot-ke': nomor_slot, member_id: null, 'sisa-add': 2 };
  const result = await addKickCombo(nomor_hp, slotData, nomor_anggota);
  return result.success && result.addResult ? { status: 'success', ...result.addResult.data } : null;
};

// Function untuk kick anggota dari slot (LEGACY - kept for compatibility)
const kickAnggota = async (nomor_hp, nomor_slot) => {
  // This is just kick operation, not add-kick combo
  const secondaryKickResult = await kickAnggotaSecondary(nomor_hp, nomor_slot);
  return secondaryKickResult.success ? { status: 'success', ...secondaryKickResult.data } : null;
};

// Function untuk proses massal add-kick dengan auto slot selection
const processAddKickMassal = async (nomor_pengelola_list, nomor_tumbal, chatId, bot) => {
  try {
    // Buat status tracker untuk setiap nomor
    const statusTracker = {};
    nomor_pengelola_list.forEach(nomor => {
      statusTracker[nomor] = {
        status: 'pending', // pending, processing, completed, failed
        slots: 0,
        totalSlots: 0,
        successSlots: 0
      };
    });

    // Function untuk membuat tampilan status list
    const createStatusList = (currentIndex = -1) => {
      let statusText = `🎯 <b>STATUS ADD-KICK MASSAL</b>\n`;
      statusText += `⏰ <i>${new Date().toLocaleString('id-ID')}</i>\n\n`;
      
      nomor_pengelola_list.forEach((nomor, index) => {
        let icon = '⏳'; // Default: pending
        let detail = '';
        
        if (statusTracker[nomor].status === 'processing') {
          icon = '♻️';
          detail = ` (${statusTracker[nomor].slots}/${statusTracker[nomor].totalSlots} slot)`;
        } else if (statusTracker[nomor].status === 'completed') {
          icon = '✅';
          detail = ` (${statusTracker[nomor].successSlots}/${statusTracker[nomor].totalSlots} slot)`;
        } else if (statusTracker[nomor].status === 'failed') {
          icon = '❌';
          detail = ' (no slots)';
        }
        
        statusText += `${nomor}${icon}${detail}\n`;
      });
      
      statusText += `\n🎯 <b>Progress:</b> ${currentIndex + 1}/${nomor_pengelola_list.length} pengelola`;
      return statusText;
    };

    // Send live status tracking message
    const statusMsg = await bot.sendMessage(chatId, 
      createStatusList(), 
      { parse_mode: 'HTML' }
    );

    let totalSlotProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let failedNumbers = []; // Array untuk menyimpan nomor yang gagal

    // Process setiap nomor pengelola
    for (let i = 0; i < nomor_pengelola_list.length; i++) {
      const nomor_hp = nomor_pengelola_list[i];
      
      // Get slot info dengan dual API
      const slotResult = await getSlotInfoDualAPI(nomor_hp);
      if (!slotResult.slots.length) {
        // Mark as failed - no slots
        statusTracker[nomor_hp] = { 
          status: 'failed', 
          reason: 'no_slots',
          source: slotResult.source
        };
        
        // Update live status
        try {
          await bot.editMessageText(
            createStatusList(i),
            {
              chat_id: chatId,
              message_id: statusMsg.message_id,
              parse_mode: 'HTML'
            }
          );
        } catch (e) {
          // Silent error handling
        }
        continue;
      }

      // Filter slot dengan kriteria ketat:
      // 1. sisa-add harus tepat 2 (bukan 1 atau 0)
      // 2. slot >= 1 (bukan slot 0 pengelola)
      // 3. slot harus kosong (tidak ada anggota)
      const availableSlots = slotResult.slots.filter(slot => {
        const sisaAdd = parseInt(slot['sisa-add']) || parseInt(slot.sisa_add) || 0;
        const slotKe = parseInt(slot['slot-ke']) || parseInt(slot.slot_ke) || 0;
        const nomorAnggota = slot.nomor || slot.phone || '';
        const namaAnggota = slot.nama || slot.name || '';
        
        // Cek apakah slot kosong (tidak ada nomor atau nama anggota)
        const slotKosong = !nomorAnggota.trim() && !namaAnggota.trim();
        
        return sisaAdd === 2 && slotKe >= 1 && slotKosong;
      });

      // Hanya proses pengelola dengan slot tersedia
      if (!availableSlots.length) {
        // Mark as failed - no available slots
        statusTracker[nomor_hp] = { 
          status: 'failed', 
          reason: 'no_available_slots'
        };
        
        // Update live status
        try {
          await bot.editMessageText(
            createStatusList(i),
            {
              chat_id: chatId,
              message_id: statusMsg.message_id,
              parse_mode: 'HTML'
            }
          );
        } catch (e) {
          // Silent error handling
        }
        continue;
      }

      // Mark as processing and update status
      statusTracker[nomor_hp] = {
        status: 'processing',
        slots: 0,
        totalSlots: availableSlots.length,
        successSlots: 0
      };
      
      // Update live status
      try {
        await bot.editMessageText(
          createStatusList(i),
          {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'HTML'
          }
        );
      } catch (e) {
        // Silent error handling
      }

      let apiStats = { khfy: 0, hidepulsa: 0, failed: 0 };

      // Process setiap slot yang tersedia dengan dual API combo
      for (let j = 0; j < availableSlots.length; j++) {
        const slot = availableSlots[j];
        const slotKe = slot['slot-ke'] || slot.slot_ke;
        
        // Update progress per slot
        statusTracker[nomor_hp].slots = j + 1;
        
        // Update live status after each slot
        try {
          await bot.editMessageText(
            createStatusList(i),
            {
              chat_id: chatId,
              message_id: statusMsg.message_id,
              parse_mode: 'HTML'
            }
          );
        } catch (e) {
          // Silent error handling
        }
        
        // PROSES: Add-Kick Combo dengan Dual API Strategy
        const comboResult = await addKickCombo(nomor_hp, slot, nomor_tumbal);
        
        if (comboResult.success) {
          totalSuccess++;
          statusTracker[nomor_hp].successSlots++;
          
          // Track API usage
          if (comboResult.source.includes('🟢 KHFY')) {
            apiStats.khfy++;
          } else if (comboResult.source.includes('⚪ H-P')) {
            apiStats.hidepulsa++;
          }
        } else {
          totalFailed++;
          apiStats.failed++;
          
          // Tambahkan ke daftar nomor gagal jika belum ada
          if (!failedNumbers.includes(nomor_hp)) {
            failedNumbers.push(nomor_hp);
          }
        }
        
        totalSlotProcessed++;
        
        // TUNGGU: Istirahat 25 detik setelah combo selesai, sebelum proses selanjutnya
        if (j < availableSlots.length - 1) { // Jangan tunggu di slot terakhir untuk pengelola ini
          await new Promise(resolve => setTimeout(resolve, 25000)); // 25 detik
        }
      }
      
      // Mark pengelola as completed
      statusTracker[nomor_hp].status = 'completed';
      
      // Final update for this pengelola
      try {
        await bot.editMessageText(
          createStatusList(i),
          {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'HTML'
          }
        );
      } catch (e) {
        // Silent error handling
      }
    }

    // Final status update - mark all as completed
    try {
      await bot.editMessageText(
        createStatusList(nomor_pengelola_list.length - 1) + '\n\n✅ <b>PROSES SELESAI!</b>',
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'HTML'
        }
      );
    } catch (e) {
      // Silent error handling
    }

    // Send final summary
    let completedCount = 0;
    let failedPengelolaCount = 0;
    let finalTracker = null;
    
    Object.keys(statusTracker).forEach(nomor => {
      if (statusTracker[nomor].status === 'completed') {
        completedCount++;
      } else if (statusTracker[nomor].status === 'failed') {
        failedPengelolaCount++;
      }
    });

    // Calculate global API statistics
    let globalApiStats = { khfy: 0, hidepulsa: 0, failed: 0 };
    
    // Aggregate API stats from status tracker if available
    Object.keys(statusTracker).forEach(nomor => {
      if (statusTracker[nomor].apiStats) {
        globalApiStats.khfy += statusTracker[nomor].apiStats.khfy || 0;
        globalApiStats.hidepulsa += statusTracker[nomor].apiStats.hidepulsa || 0;
        globalApiStats.failed += statusTracker[nomor].apiStats.failed || 0;
      }
    });

    let finalMessage = `📊 <b>RINGKASAN HASIL - DUAL API</b>\n\n`;
    finalMessage += `📞 <b>Total Pengelola:</b> ${nomor_pengelola_list.length} nomor\n`;
    finalMessage += `✅ <b>Berhasil diproses:</b> ${completedCount}/${nomor_pengelola_list.length} pengelola\n`;
    finalMessage += `❌ <b>Gagal/No slots:</b> ${failedPengelolaCount}/${nomor_pengelola_list.length} pengelola\n\n`;
    finalMessage += `🎯 <b>HASIL ADD-KICK COMBO:</b>\n`;
    finalMessage += `✅ <b>Combo berhasil:</b> ${totalSuccess}\n`;
    finalMessage += `❌ <b>Combo gagal:</b> ${totalFailed}\n`;
    finalMessage += `📋 <b>Total slot:</b> ${totalSlotProcessed}\n\n`;
    finalMessage += `📡 <b>API STATISTICS:</b>\n`;
    finalMessage += `🟢 <b>API KHFY:</b> ${globalApiStats.khfy}\n`;
    finalMessage += `⚪ <b>API H-P:</b> ${globalApiStats.hidepulsa}\n`;
    finalMessage += `❌ <b>API GAGAL:</b> ${globalApiStats.failed}\n\n`;
    finalMessage += `👤 <b>Nomor Tumbal:</b> ${nomor_tumbal}\n`;
    finalMessage += `� <b>Efisiensi:</b> ${totalSlotProcessed > 0 ? ((totalSuccess / totalSlotProcessed) * 100).toFixed(1) : 0}%\n`;
    
    // Detail per pengelola yang gagal
    if (Object.keys(statusTracker).length > 0) {
      const failedDetails = [];
      Object.keys(statusTracker).forEach(nomor => {
        if (statusTracker[nomor].status === 'failed') {
          const source = statusTracker[nomor].source || 'unknown';
          failedDetails.push(`❌ ${nomor} (${statusTracker[nomor].reason || 'error'}) - ${source}`);
        }
      });
      
      if (failedDetails.length > 0) {
        finalMessage += `\n🔍 <b>Detail Pengelola Gagal:</b>\n${failedDetails.join('\n')}`;
      }
    }
    
    finalMessage += `\n⏰ <b>Waktu total:</b> ~${totalSlotProcessed * 45} detik (~${Math.round(totalSlotProcessed * 45 / 60)} menit)`;
    finalMessage += `\n🚀 <b>Strategy:</b> Dual API (KHFY → HidePulsa)`;
    
    await bot.sendMessage(chatId, finalMessage, { parse_mode: 'HTML' });

    } catch (error) {
    // Error handled silently
    await bot.sendMessage(chatId, 
      `❌ <b>Terjadi error dalam proses massal!</b>\n\n` +
      `🔍 <b>Error:</b> ${error.message}`,
      { parse_mode: 'HTML' }
    );
  }
};

module.exports = (bot) => {
  // Handle callback queries
  bot.on('callback_query', async (query) => {
    const { data, message, id, from } = query;
    const chatId = message?.chat?.id;
    const userId = from.id;
    
    if (!chatId) return;
    
    try {
      if (data === 'addkick_start') {
        // Show add-kick manager menu
        const keyboard = [
          [{ text: '🎯 MULAI ADD-KICK', callback_data: 'addkick_begin' }],
          [{ text: '🔙 KEMBALI', callback_data: 'menu_massal' }]
        ];
        
        const content = 
          `🔧 <b>ADD-KICK MASSAL - DUAL API</b>\n\n` +
          `📝 <b>Fitur Terbaru:</b>\n` +
          `• Dual API Strategy (KHFY + HidePulsa)\n` +
          `• Smart Add-Kick Combo\n` +
          `• Filter slot: sisa-add = 2 (tepat)\n` +
          `• Hanya slot kosong (tanpa anggota)\n` +
          `• Add tumbal → tunggu 20s → kick tumbal\n` +
          `• Progress tracking real-time\n` +
          `• API fallback mechanism\n\n` +
          `🚀 <b>API Strategy:</b>\n` +
          `• Primary: KHFY (member_id tracking)\n` +
          `• Fallback: HidePulsa (slot_number)\n` +
          `• Smart timeout & retry\n\n` +
          `⚡ <b>Mulai proses?</b>`;

        // Cek apakah message memiliki caption (dari photo message)
        if (message.caption) {
          // Cek apakah caption dan keyboard sudah sama
          if (message.caption === content && 
              message.reply_markup?.inline_keyboard && 
              JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu Add-Kick aktif.',
              show_alert: false
            });
          }

          try {
            await bot.editMessageCaption(content, {
              chat_id: chatId,
              message_id: message.message_id,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: keyboard }
            });
          } catch (error) {
            if (error.message.includes('message is not modified')) {
              return bot.answerCallbackQuery(id, {
                text: '✅ Menu Add-Kick aktif.',
                show_alert: false
              });
            }
            // Error handled silently
          }
        } else {
          // Cek apakah text dan keyboard sudah sama
          if (message.text === content && 
              message.reply_markup?.inline_keyboard && 
              JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu Add-Kick aktif.',
              show_alert: false
            });
          }

          try {
            await bot.editMessageText(content, {
              chat_id: chatId,
              message_id: message.message_id,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: keyboard }
            });
          } catch (error) {
            if (error.message.includes('message is not modified')) {
              return bot.answerCallbackQuery(id, {
                text: '✅ Menu Add-Kick aktif.',
                show_alert: false
              });
            }
            // Error handled silently
          }
        }

        await bot.answerCallbackQuery(id);
        return;
        
      } else if (data === 'addkick_begin') {
        // Start add-kick process
        addKickStates.set(chatId, { step: 'input_nomor_pengelola', menuMessageId: message.message_id });
        
        // JANGAN hapus menu, kirim input form di bawah menu (sama seperti scan_bekasan)
        const inputMsg = await bot.sendMessage(chatId,
          `⚡ <b>ADD-KICK MASSAL - DUAL API</b>\n\n` +
          `📞 <b>MASUKAN NOMOR PENGELOLA</b>\n\n` +
          `Ketik nomor HP pengelola (bisa multiple):\n\n` +
          `💡 <b>Format:</b>\n` +
          `• Single: 081234567890\n` +
          `• Multiple: (satu per baris)\n` +
          `  081234567890\n` +
          `  081234567891\n` +
          `  081234567892\n\n` +
          `🚀 <b>Dual API Strategy:</b>\n` +
          `• Primary: KHFY (member_id based)\n` +
          `• Fallback: HidePulsa (slot based)\n` +
          `• Smart Add-Kick combo\n\n` +
          `⚠️ <b>Pastikan semua nomor sudah login!</b>\n\n` +
          `💡 Ketik "exit" untuk membatalkan`,
          { parse_mode: 'HTML' }
        );
        
        // Simpan message ID input untuk bisa diedit nanti
        const currentState = addKickStates.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        addKickStates.set(chatId, currentState);
        
        await bot.answerCallbackQuery(id);
        return;
        
      } else if (data === 'addkick_cancel') {
        // Cancel process
        addKickStates.delete(chatId);
        
        await bot.editMessageText(
          `❌ <b>Proses dibatalkan</b>\n\nGunakan /addkick untuk memulai lagi.`,
          {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML'
          }
        );
      }
      
    } catch (error) {
      // Error handled silently
      await bot.answerCallbackQuery(id, { text: '❌ Terjadi error, coba lagi!', show_alert: true });
    }
  });

  // Handle text input for add-kick
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text?.trim();
    
    if (!text || text.startsWith('/')) return;
    
    const state = addKickStates.get(chatId);
    if (!state) return;
    
    try {
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
        
        addKickStates.delete(chatId);
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      if (state.step === 'input_nomor_pengelola') {
        // Parse nomor pengelola (multiple lines)
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const validNumbers = [];
        
        for (const line of lines) {
          const cleanNumber = line.replace(/\D/g, '');
          if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
            validNumbers.push(cleanNumber);
          }
        }
        
        // Hilangkan duplikasi nomor (ambil yang unik saja)
        const uniqueNumbers = [...new Set(validNumbers)];
        const duplicateCount = validNumbers.length - uniqueNumbers.length;
        
        if (uniqueNumbers.length === 0) {
          await bot.sendMessage(chatId, 
            `❌ <b>Tidak ada nomor yang valid!</b>\n\n` +
            `Format: 10-15 digit angka per baris.\n` +
            `Coba lagi atau ketik "exit" untuk batal.`,
            { parse_mode: 'HTML' }
          );
          await bot.deleteMessage(chatId, msg.message_id);
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
        
        state.step = 'input_nomor_tumbal';
        state.nomor_pengelola_list = uniqueNumbers;
        addKickStates.set(chatId, state);
        
        const inputMsg = await bot.sendMessage(chatId,
          `👤 <b>MASUKAN NOMOR TUMBAL</b>\n\n` +
          `Ketik nomor HP yang akan dijadikan tumbal:\n\n` +
          `💡 <b>Contoh:</b> <code>083821447274</code>\n` +
          `⚠️ <b>Nomor ini akan di-add lalu di-kick berulang</b>\n\n` +
          `💡 Ketik "exit" untuk membatalkan`,
          { parse_mode: 'HTML' }
        );
        
        // Simpan message ID input baru
        const currentState = addKickStates.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        addKickStates.set(chatId, currentState);
        
      } else if (state.step === 'input_nomor_tumbal') {
        // Validate nomor tumbal
        const cleanNumber = text.replace(/\D/g, '');
        
        if (cleanNumber.length < 10 || cleanNumber.length > 15) {
          await bot.sendMessage(chatId,
            `❌ <b>Format nomor tumbal tidak valid!</b>\n\n` +
            `Nomor harus 10-15 digit angka.\n` +
            `Coba lagi atau ketik "exit" untuk batal.`,
            { parse_mode: 'HTML' }
          );
          await bot.deleteMessage(chatId, msg.message_id);
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
        
        // Show confirmation
        const confirmText = 
          `🔄 <b>KONFIRMASI ADD-KICK MASSAL - DUAL API</b>\n\n` +
          `📞 <b>Nomor Pengelola:</b> ${state.nomor_pengelola_list.length} nomor\n` +
          `📝 <b>Daftar:</b>\n${state.nomor_pengelola_list.map((num, i) => `${i+1}. ${num}`).join('\n')}\n\n` +
          `👤 <b>Nomor Tumbal:</b> ${cleanNumber}\n\n` +
          `🚀 <b>Dual API Strategy:</b>\n` +
          `• Primary: KHFY (add → kick by member_id)\n` +
          `• Fallback: HidePulsa (add → kick by slot)\n` +
          `• Smart failover mechanism\n\n` +
          `⚡ <b>Filter Ketat:</b>\n` +
          `1. Slot sisa-add = 2 (tepat, bukan 1/0)\n` +
          `2. Slot >= 1 (bukan pengelola)\n` +
          `3. Slot kosong (tanpa anggota)\n` +
          `4. Add-Kick combo dengan dual API\n\n` +
          `⏰ <b>Timing Detail:</b>\n` +
          `• ADD timeout: hingga 30 detik\n` +
          `• Tunggu setelah ADD: 20 detik\n` +
          `• Tunggu setelah KICK: 25 detik\n` +
          `• Estimasi: ~45 detik per slot\n\n` +
          `❓ <b>Lanjutkan proses?</b>`;
        
        const keyboard = [
          [
            { text: '❌ BATAL', callback_data: 'addkick_cancel' },
            { text: '✅ YA, LANJUTKAN', callback_data: 'addkick_confirm' }
          ]
        ];
        
        state.nomor_tumbal = cleanNumber;
        addKickStates.set(chatId, state);
        
        await bot.sendMessage(chatId, confirmText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
      
    } catch (error) {
      // Error handled silently
      await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      addKickStates.delete(chatId);
    }
  });

  // Handle confirmation
  bot.on('callback_query', async (query) => {
    const { data, message, id, from } = query;
    const chatId = message?.chat?.id;
    const userId = from.id;
    
    if (data === 'addkick_confirm' && chatId) {
      const state = addKickStates.get(chatId);
      
      if (!state) {
        return;
      }
      
      try {
        // Hapus message konfirmasi dan langsung mulai proses
        try {
          await bot.deleteMessage(chatId, message.message_id);
        } catch (e) {
          // Ignore delete error, just continue
        }
        
        // Start add-kick massal process
        await processAddKickMassal(
          state.nomor_pengelola_list,
          state.nomor_tumbal,
          chatId,
          bot
        );
        
        // Clean up state
        addKickStates.delete(chatId);
        
      } catch (error) {
        // Error handled silently
        await bot.sendMessage(chatId, '❌ <b>Terjadi error saat eksekusi!</b>', { parse_mode: 'HTML' });
        addKickStates.delete(chatId);
      }
    }
  });
};

// Export functions untuk testing/external use
module.exports.addAnggota = addAnggota;
module.exports.kickAnggota = kickAnggota;
module.exports.getSlotInfo = getSlotInfo;
module.exports.processAddKickMassal = processAddKickMassal;
