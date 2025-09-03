const axios = require('axios');
require('dotenv').config();
const { getStok, addKickSchedule, getKickSchedules, deleteKickSchedule, completeKickSchedule } = require('../../../db');

// API Configuration dari .env
const API_PRIMARY_BASE = process.env.API1;
const API_PRIMARY_ENDPOINT = process.env.KICK1;
const API_PRIMARY_TOKEN = process.env.APIKEY1;
const API_PRIMARY_FULL_URL = API_PRIMARY_BASE + API_PRIMARY_ENDPOINT;

const API_SECONDARY_BASE = process.env.API2;
const API_SECONDARY_ENDPOINT = process.env.KICK2;
const API_SECONDARY_AUTH = process.env.APIKEY2;
const API_SECONDARY_PASSWORD = process.env.PASSWORD2;
const API_SECONDARY_FULL_URL = API_SECONDARY_BASE + API_SECONDARY_ENDPOINT;

const ADMIN_ID = process.env.ADMIN_ID;

// Storage untuk scheduled kicks
const scheduledKicks = new Map(); // key: chatId, value: { nomor_hp, waktu, timeoutId }
const kickStates = new Map(); // key: chatId, value: { step, nomor_hp }

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

// Function untuk kick anggota menggunakan API Primary (KHFY-Store) - COMBO Step 2
const kickAnggotaPrimary = async (nomor_hp, member_id) => {
  try {
    const formattedNomor = formatNomorToInternational(nomor_hp);
    
    // COMBO Step 2: Hit API1 + KICK1 dengan family_member_id dari Step 1
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('id_parent', formattedNomor);
    formData.append('member_id', member_id); // This is actually family_member_id dari response API

    const response = await axios.post(API_PRIMARY_FULL_URL, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    // Parse response untuk cek apakah kick berhasil
    const isSuccess = response.data?.status === 'success' || 
                     response.data?.success === true ||
                     response.status === 200;

    return {
      success: isSuccess,
      data: response.data,
      source: 'primary'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      source: 'primary'
    };
  }
};

// Function untuk kick anggota menggunakan API Secondary (HidePulsa)
const kickAnggotaSecondary = async (nomor_hp, nomor_slot) => {
  try {
    const formattedNomor = formatNomorToLocal(nomor_hp);
    
    const response = await axios.post(API_SECONDARY_FULL_URL, {
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

// Function untuk kick anggota dengan dual API strategy - COMBO VERSION
const kickAnggotaDualAPI = async (nomor_hp, slotData) => {
  const { nomor_slot, member_id, nomor, nama } = slotData;
  let primaryResult = null; // Initialize primaryResult
  
  // Strategy 1: Try primary API dengan member_id yang sudah dikumpulkan dari Step 1
  if (member_id && member_id !== null && member_id !== '' && member_id !== 'undefined') {
    primaryResult = await kickAnggotaPrimary(nomor_hp, member_id);
    if (primaryResult.success) {
      return {
        success: true,
        source: '🟢 KHFY',
        data: primaryResult.data,
        member: { slot: nomor_slot, nomor, nama, member_id: member_id }
      };
    }
  }
  
  // Fallback to secondary API (menggunakan nomor_slot)
  const secondaryResult = await kickAnggotaSecondary(nomor_hp, nomor_slot);
  if (secondaryResult.success) {
    return {
      success: true,
      source: '⚪ H-P',
      data: secondaryResult.data,
      member: { slot: nomor_slot, nomor, nama }
    };
  }
  
  // Both APIs failed
  return {
    success: false,
    source: '❌ GAGAL',
    error: secondaryResult.error || (primaryResult ? primaryResult.error : 'Primary API skipped, Secondary failed'),
    member: { slot: nomor_slot, nomor, nama }
  };
};

// Function untuk kick anggota dari slot tertentu (DEPRECATED - kept for compatibility)
const kickAnggota = async (nomor_hp, nomor_slot) => {
  const slotData = { nomor_slot, member_id: null, nomor: '', nama: '' };
  const result = await kickAnggotaDualAPI(nomor_hp, slotData);
  return result.success ? { status: 'success', ...result.data } : null;
};

// Function untuk get slot info menggunakan API Primary (KHFY-Store) - COMBO STYLE
const getSlotInfoPrimary = async (nomor_hp) => {
  try {
    const formattedNomor = formatNomorToInternational(nomor_hp);
    
    // COMBO Step 1: Hit API1 + CEKSLOT1 (sama seperti scan_bekasan.js)
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('nomor_hp', formattedNomor);
    formData.append('id_parent', formattedNomor);

    const response = await axios.post(API_PRIMARY_BASE + process.env.CEKSLOT1, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    // Parse response seperti di scan_bekasan.js
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
        return { success: false, slots: [], source: 'primary', error: message };
      }
      
      // Extract member info dari response data (sesuai struktur API1 yang sebenarnya)
      let memberInfo = responseData?.data?.member_info;
      
      // Fallback: coba struktur alternatif jika member_info tidak ada
      if (!memberInfo && responseData?.data?.members) {
        memberInfo = { 
          members: responseData.data.members,
          additional_members: responseData.data.additional_members || []
        };
      }
      
      // Fallback: coba struktur data_slot langsung
      if (!memberInfo && responseData?.data?.data_slot) {
        const dataSlot = responseData.data.data_slot;
        
        const slots = dataSlot.map((slot, index) => ({
          'slot-ke': slot['slot-ke'] || (index + 1).toString(),
          nomor: slot.nomor || '',
          nama: slot.nama || '',
          member_id: slot.family_member_id || slot.member_id || slot.id || null, // ❗ CRITICAL: family_member_id first!
          'sisa-add': slot['sisa-add'] || 0,
          status: slot.status || 'aktif'
        }));
        
        return { success: true, slots, source: 'primary' };
      }
      
      if (!memberInfo) {
        return { success: false, slots: [], source: 'primary', error: 'No member_info in response' };
      }
      
      // Gabungkan semua members (members + additional_members)
      const allMembers = [...(memberInfo.members || []), ...(memberInfo.additional_members || [])];
      
      // Convert KHFY format to standard slot format WITH member_id (CRITICAL!)
      const slots = allMembers.map((member, index) => {
        const slot = {
          'slot-ke': member.slot_id === 0 ? '0' : (member.slot_id || 1).toString(), // 0 untuk parent
          nomor: member.msisdn || '',
          nama: member.alias || '',
          member_id: member.family_member_id || member.member_id || member.id || null, // ❗ CRITICAL: family_member_id is the correct field!
          'sisa-add': member.add_chances || 0,
          status: member.status || 'aktif'
        };
        
        return slot;
      });
      
      return {
        success: true,
        slots,
        source: 'primary'
      };
    }
    
    return { success: false, slots: [], source: 'primary', error: 'No valid response data' };
  } catch (error) {
    return { success: false, slots: [], error: error.message, source: 'primary' };
  }
};

// Function untuk get slot info menggunakan API Secondary (HidePulsa)
const getSlotInfoSecondary = async (nomor_hp) => {
  try {
    const formattedNomor = formatNomorToLocal(nomor_hp);
    
    const response = await axios.post(API_SECONDARY_FULL_URL, {
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
      
      const secondResponse = await axios.post(API_SECONDARY_FULL_URL, {
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

// Function untuk get info slot dari nomor HP (DEPRECATED - kept for compatibility)
const getSlotInfo = async (nomor_hp) => {
  const result = await getSlotInfoDualAPI(nomor_hp);
  return result.slots;
};

// Function untuk kick semua anggota dari satu nomor HP (dengan COMBO strategy)
const kickSemuaAnggotaSingle = async (nomor_hp, chatId, bot) => {
  // Send initial message
  const statusMsg = await bot.sendMessage(chatId, 
    `🔄 <b>STARTING COMBO KICKMASSAL - ${nomor_hp}</b>\n\n⚡ Step 1: Collecting member data...`, 
    { parse_mode: 'HTML' }
  );

  // COMBO STEP 1: Ambil semua data slot menggunakan API1+CEKSLOT1
  const slotInfoResult = await getSlotInfoPrimary(nomor_hp);
  if (!slotInfoResult.success || !slotInfoResult.slots || slotInfoResult.slots.length === 0) {
    // Update status message
    await bot.editMessageText(
      `❌ <b>COMBO Step 1 Failed!</b>\n\n` +
      `Tidak dapat mengambil data slot dari ${nomor_hp}\n` +
      `Error: ${slotInfoResult.error || 'No slot data found'}`,
      {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'HTML'
      }
    );
    return {
      nomor_hp,
      berhasil: 0,
      gagal: 0,
      total: 0,
      source: '❌ COMBO FAILED'
    };
  }

  const allSlots = slotInfoResult.slots;

  // Filter slot yang ada anggotanya (nomor tidak kosong) dan dimulai dari slot 1
  // Slot 0 adalah slot pengelola yang tidak boleh di-kick
  const slotBerisi = allSlots.filter(slot => 
    slot.nomor && 
    slot.nomor !== "" && 
    parseInt(slot['slot-ke']) >= 1
  );
  
  if (!slotBerisi.length) {
    await bot.editMessageText(
      `✅ <b>Semua slot di nomor ${nomor_hp} sudah kosong</b>\n📡 Sumber: 🟢 KHFY COMBO`, 
      {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'HTML'
      }
    );
    return {
      nomor_hp,
      berhasil: 0,
      gagal: 0,
      total: 0,
      source: '🟢 KHFY COMBO'
    };
  }

  // Update status - Start Step 2
  await bot.editMessageText(
    `✅ <b>Step 1 Complete: Found ${slotBerisi.length} members</b>\n⚡ Step 2: Starting COMBO mass kick...`,
    {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'HTML'
    }
  );

  // COMBO STEP 2: Kick semua anggota menggunakan data dari Step 1
  let berhasil = 0;
  let gagal = 0;
  let apiStats = { khfy: 0, hidepulsa: 0, failed: 0 };

  // Kick semua slot sequential dengan 20 detik delay
  for (let i = 0; i < slotBerisi.length; i++) {
    const slot = slotBerisi[i];
    const progress = Math.round(((i + 1) / slotBerisi.length) * 100);
    
    // Update progress every 3 slots or for last slot
    if ((i + 1) % 3 === 0 || i === slotBerisi.length - 1) {
      await bot.editMessageText(
        `⚡ <b>Step 2: COMBO Kicking... ${progress}%</b>\n📊 ${i + 1}/${slotBerisi.length} processed`,
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'HTML'
        }
      ).catch(() => {}); // Ignore edit errors
    }
    
    const result = await kickAnggotaDualAPI(nomor_hp, {
      nomor_slot: slot['slot-ke'],
      member_id: slot.member_id,
      nomor: slot.nomor,
      nama: slot.nama
    });
    
    if (result.success) {
      berhasil++;
      if (result.source === '🟢 KHFY') apiStats.khfy++;
      else if (result.source === '⚪ H-P') apiStats.hidepulsa++;
    } else {
      gagal++;
      apiStats.failed++;
    }

    // Delay 20 detik antar kick slot untuk mencegah rate limit
    if (i < slotBerisi.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 20000));
    }
  }

  // Send final result
  await bot.editMessageText(
    `🏁 <b>COMBO KICK SELESAI - ${nomor_hp}</b>\n\n` +
    `📊 <b>Hasil:</b>\n` +
    `✅ Berhasil: ${berhasil} slot\n` +
    `❌ Gagal: ${gagal} slot\n` +
    `📋 Total: ${slotBerisi.length} slot\n\n` +
    `📡 <b>API Statistics:</b>\n` +
    `🟢 KHFY COMBO: ${apiStats.khfy}\n` +
    `⚪ H-P Fallback: ${apiStats.hidepulsa}\n` +
    `❌ GAGAL: ${apiStats.failed}`,
    {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'HTML'
    }
  );

  return {
    nomor_hp,
    berhasil,
    gagal,
    total: slotBerisi.length,
    source: '🟢 KHFY COMBO',
    apiStats
  };
};

// Function untuk kick massal parallel processing (multiple nomor HP serentak)
const kickSemuaAnggotaParallel = async (nomorList, chatId, bot) => {
  await bot.sendMessage(chatId, 
    `🚀 <b>MEMULAI KICK MASSAL PARALLEL!</b>\n\n` +
    `📱 <b>Total nomor HP:</b> ${nomorList.length}\n` +
    `⚡ <b>Processing:</b> Serentak untuk semua nomor\n` +
    `⏱️ <b>Delay per slot:</b> 20 detik (dalam satu nomor)\n\n` +
    `🎯 Hasil akan dikirim real-time...`, 
    { parse_mode: 'HTML' }
  );

  // Process all numbers in parallel
  const promises = nomorList.map(nomor_hp => 
    kickSemuaAnggotaSingle(nomor_hp, chatId, bot)
  );

  try {
    const results = await Promise.allSettled(promises);
    
    // Calculate final statistics
    let totalBerhasil = 0;
    let totalGagal = 0;
    let totalSlots = 0;
    let globalApiStats = { khfy: 0, hidepulsa: 0, failed: 0 };
    let successfulNumbers = 0;
    let failedNumbers = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const data = result.value;
        totalBerhasil += data.berhasil;
        totalGagal += data.gagal;
        totalSlots += data.total;
        
        if (data.apiStats) {
          globalApiStats.khfy += data.apiStats.khfy;
          globalApiStats.hidepulsa += data.apiStats.hidepulsa;
          globalApiStats.failed += data.apiStats.failed;
        }
        
        if (data.total > 0) successfulNumbers++;
      } else {
        failedNumbers++;
      }
    });

    // Send final summary
    await bot.sendMessage(chatId,
      `🎊 <b>KICK MASSAL PARALLEL SELESAI!</b>\n\n` +
      `📊 <b>RINGKASAN KESELURUHAN:</b>\n` +
      `📱 Total nomor HP: ${nomorList.length}\n` +
      `✅ Berhasil diproses: ${successfulNumbers}\n` +
      `❌ Gagal diproses: ${failedNumbers}\n\n` +
      `🎯 <b>HASIL KICK:</b>\n` +
      `✅ Slot berhasil: ${totalBerhasil}\n` +
      `❌ Slot gagal: ${totalGagal}\n` +
      `📋 Total slot: ${totalSlots}\n\n` +
      `📡 <b>API STATISTICS:</b>\n` +
      `🟢 API KHFY: ${globalApiStats.khfy}\n` +
      `⚪ API H-P: ${globalApiStats.hidepulsa}\n` +
      `❌ API GAGAL: ${globalApiStats.failed}\n\n` +
      `💡 <b>Efisiensi:</b> ${totalSlots > 0 ? ((totalBerhasil / totalSlots) * 100).toFixed(1) : 0}%`,
      { parse_mode: 'HTML' }
    );

    return results;
  } catch (error) {
    await bot.sendMessage(chatId, '❌ <b>Error dalam parallel processing!</b>', { parse_mode: 'HTML' });
    return [];
  }
};

// Function untuk kick semua anggota dari nomor HP tertentu (BACKWARD COMPATIBILITY)
const kickSemuaAnggotaScheduled = async (nomor_hp, chatId, bot) => {
  // Check if nomor_hp is array (multiple numbers) or single number
  if (Array.isArray(nomor_hp)) {
    return await kickSemuaAnggotaParallel(nomor_hp, chatId, bot);
  } else {
    return await kickSemuaAnggotaSingle(nomor_hp, chatId, bot);
  }
};

// Function untuk schedule kick (mendukung single nomor atau array nomor)
const scheduleKick = async (nomor_hp, waktu, chatId, bot) => {
  const now = new Date();
  const [jam, menit] = waktu.split(':').map(Number);
  
  // Set target time
  const targetTime = new Date();
  targetTime.setHours(jam, menit || 0, 0, 0);
  
  // Jika waktu sudah lewat hari ini, set untuk besok
  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  const delay = targetTime.getTime() - now.getTime();
  
  // Handle array of numbers or single number
  const nomorList = Array.isArray(nomor_hp) ? nomor_hp : [nomor_hp];
  
  // Process each number for database storage and timeout management
  for (const nomor of nomorList) {
    // Create unique key for this schedule (chatId + nomor_hp)
    const scheduleKey = `${chatId}_${nomor}`;
    
    // Cancel previous scheduled kick if exists for this specific number
    if (scheduledKicks.has(scheduleKey)) {
      clearTimeout(scheduledKicks.get(scheduleKey).timeoutId);
      scheduledKicks.delete(scheduleKey);
    }
    
    // Save to database first
    try {
      await addKickSchedule(chatId.toString(), nomor, jam, menit, targetTime.toISOString());
    } catch (error) {
      // Silently handle database error
    }
  }
  
  // Create single timeout for all numbers (parallel execution)
  const scheduleKey = `${chatId}_BATCH_${Date.now()}`;
  const timeoutId = setTimeout(() => {
    // Execute kick for all numbers in parallel
    kickSemuaAnggotaScheduled(nomorList, chatId, bot).finally(() => {
      // Clean up all schedules after completion
      nomorList.forEach(nomor => {
        const individualKey = `${chatId}_${nomor}`;
        scheduledKicks.delete(individualKey);
        
        // Mark as completed in database
        completeKickSchedule(chatId.toString(), nomor).catch(error => {
          // Silently handle database error
        });
      });
      
      // Clean up batch schedule
      scheduledKicks.delete(scheduleKey);
    });
  }, delay);
  
  // Store batch timeout info in memory
  scheduledKicks.set(scheduleKey, {
    nomor_hp_list: nomorList,
    jam,
    menit,
    targetTime: targetTime.toISOString(),
    timeoutId,
    type: 'batch'
  });
  
  // Also store individual entries for status tracking
  nomorList.forEach(nomor => {
    const individualKey = `${chatId}_${nomor}`;
    scheduledKicks.set(individualKey, {
      nomor_hp: nomor,
      jam,
      menit,
      targetTime: targetTime.toISOString(),
      timeoutId, // Same timeout for all numbers in batch
      batchKey: scheduleKey,
      type: 'individual'
    });
  });
  
  return targetTime;
};

// Function untuk format time remaining
const getTimeRemaining = (targetTime) => {
  const now = new Date();
  const diff = targetTime.getTime() - now.getTime();
  
  if (diff <= 0) return "Sedang diproses...";
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return `${hours}j ${minutes}m ${seconds}d`;
};

module.exports = (bot) => {
  // Handle callback queries
  bot.on('callback_query', async (query) => {
    const { data, message, id, from } = query;
    const chatId = message?.chat?.id;
    const userId = from.id;
    
    if (!chatId) return;
    
    try {
      if (data === 'kick_massal') {
        // Show kick massal manager menu
        const keyboard = [
          [{ text: '🚀 KICK MASSAL', callback_data: 'kickmassal_start' }],
          [{ text: '📋 LIHAT JADWAL', callback_data: 'kickmassal_list' }],
          [{ text: '❌ BATAL JADWAL', callback_data: 'kickmassal_cancel' }],
          [{ text: '🔙 KEMBALI', callback_data: 'menu_massal' }]
        ];
        
        const content = 
          `🎯 <b>KICK MASSAL MANAGER</b>\n\n` +
          `📝 <b>Fitur Terbaru:</b>\n` +
          `• Smart API1 Combo (CEKSLOT1→KICK1)\n` +
          `• Dual API Strategy (KHFY + HidePulsa)\n` +
          `• Parallel processing multiple nomor\n` +
          `• Real-time progress tracking\n` +
          `• Smart failover & retry mechanism\n` +
          `• Delay 20 detik antar slot (per nomor)\n\n` +
          `🚀 <b>Processing Mode:</b>\n` +
          `• Multiple nomor: Serentak (parallel)\n` +
          `• Slot per nomor: Sequential (20s delay)\n\n` +
          `🔧 <b>API Strategy:</b>\n` +
          `• API1: CEKSLOT1 → validate member_id → KICK1\n` +
          `• API2: Direct kick with nomor_slot\n\n` +
          `⚡ <b>Pilih aksi:</b>`;

        // Cek apakah message memiliki caption (dari photo message)
        if (message.caption) {
          // Cek apakah caption dan keyboard sudah sama
          if (message.caption === content && 
              message.reply_markup?.inline_keyboard && 
              JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu Kick Massal aktif.',
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
                text: '✅ Menu Kick Massal aktif.',
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
              text: '✅ Menu Kick Massal aktif.',
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
                text: '✅ Menu Kick Massal aktif.',
                show_alert: false
              });
            }
            // Error handled silently
          }
        }

        await bot.answerCallbackQuery(id);
        return;
        
      } else if (data === 'kickmassal_start') {
        // Start kick massal process
        kickStates.set(chatId, { step: 'input_nomor', menuMessageId: message.message_id });
        
        // JANGAN hapus menu, kirim input form di bawah menu (sama seperti scan_bekasan)
        const inputMsg = await bot.sendMessage(chatId,
          `🦵 <b>KICK MASSAL - DUAL API</b>\n\n` +
          `📞 <b>MASUKAN NOMOR HP</b>\n\n` +
          `Ketik nomor HP yang ingin di-kick semua slotnya:\n\n` +
          `💡 <b>Input tunggal:</b>\n` +
          `• 081234567890\n\n` +
          `💡 <b>Input massal (pisahkan dengan enter):</b>\n` +
          `• 081234567890\n` +
          `• 087835671902\n` +
          `• 6281234567890\n\n` +
          `🚀 <b>Processing Mode:</b>\n` +
          `• Multiple nomor: Parallel (serentak)\n` +
          `• Slot per nomor: Sequential (20s delay)\n` +
          `• API1 Combo: CEKSLOT1 → KICK1 (validate member_id)\n` +
          `• API2 Fallback: Direct kick with nomor_slot\n\n` +
          `⚠️ <b>Pastikan semua nomor HP sudah benar!</b>\n\n` +
          `💡 Ketik "exit" untuk membatalkan`,
          { parse_mode: 'HTML' }
        );
        
        // Simpan message ID input untuk bisa diedit nanti
        const currentState = kickStates.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        kickStates.set(chatId, currentState);
        
        await bot.answerCallbackQuery(id);
        return;
      } else if (data === 'kickmassal_list') {
        // Show scheduled kicks from database with real-time refresh
        try {
          // Clear any existing schedule view state first
          const currentState = kickStates.get(chatId);
          if (currentState && currentState.scheduleMessageId) {
            try {
              await bot.deleteMessage(chatId, currentState.scheduleMessageId);
            } catch (e) {
              // Ignore delete error
            }
          }
          
          const schedules = await getKickSchedules(chatId.toString());
          
          if (schedules.length === 0) {
            await bot.answerCallbackQuery(id, { text: '📋 Tidak ada jadwal kick yang aktif', show_alert: true });
            return;
          }
          
          let listText = `📋 <b>JADWAL KICK AKTIF</b>\n\n`;
          listText += `<code>Nomor        : Jam Kick : Status</code>\n`;
          listText += `<code>----------------------------------</code>\n`;
          
          for (const schedule of schedules) {
            const jamFormatted = String(schedule.jam).padStart(2, '0');
            const menitFormatted = String(schedule.menit).padStart(2, '0');
            const jamKick = `${jamFormatted}:${menitFormatted}`;
            
            // Check if schedule is still active in memory
            const scheduleKey = `${chatId}_${schedule.nomor_hp}`;
            const isActiveInMemory = scheduledKicks.has(scheduleKey);
            const status = isActiveInMemory ? '✅' : '⏸️';
            
            listText += `<code>${schedule.nomor_hp} : ${jamKick} : ${status}</code>\n`;
          }
          
          listText += `\n💡 <b>Status:</b> ✅ = Aktif, ⏸️ = Tertunda\n`;
          listText += `💡 Ketik "exit" untuk keluar dari tampilan ini.`;
          
          // Set state untuk handle exit
          kickStates.set(chatId, { step: 'viewing_schedule' });
          
          const scheduleMsg = await bot.sendMessage(chatId, listText, { parse_mode: 'HTML' });
          
          // Simpan message ID untuk bisa dihapus saat exit
          const newState = kickStates.get(chatId);
          newState.scheduleMessageId = scheduleMsg.message_id;
          kickStates.set(chatId, newState);
          
          await bot.answerCallbackQuery(id);
        } catch (error) {
          // Silently handle callback error
        }
        
      } else if (data === 'kickmassal_cancel') {
        // Cancel scheduled kick from database
        try {
          const schedules = await getKickSchedules(chatId.toString());
          
          if (schedules.length === 0) {
            await bot.answerCallbackQuery(id, { text: '❌ Tidak ada jadwal kick yang aktif', show_alert: true });
            return;
          }
          
          const cancelCount = schedules.length;
          
          // Delete all schedules for this chat from database
          for (const schedule of schedules) {
            await deleteKickSchedule(chatId.toString(), schedule.nomor_hp);
          }
          
          // Also clear from memory if exists (check all possible keys)
          for (const [scheduleKey, scheduleData] of scheduledKicks) {
            if (scheduleKey.startsWith(chatId.toString())) {
              clearTimeout(scheduleData.timeoutId);
              scheduledKicks.delete(scheduleKey);
            }
          }
          
          // Clear any viewing schedule state
          const currentState = kickStates.get(chatId);
          if (currentState && currentState.scheduleMessageId) {
            try {
              await bot.deleteMessage(chatId, currentState.scheduleMessageId);
            } catch (e) {
              // Ignore delete error
            }
            kickStates.delete(chatId);
          }
          
          // Verify schedules are actually deleted from database
          const verifySchedules = await getKickSchedules(chatId.toString());
          
          if (verifySchedules.length === 0) {
            const emptyMsg = await bot.sendMessage(chatId,
              `✅ <b>SEMUA JADWAL BERHASIL DIBATALKAN!</b>\n\n` +
              `📊 <b>Dibatalkan:</b> ${cancelCount} jadwal\n` +
              `📋 <b>Jadwal aktif:</b> 0\n\n` +
              `🎯 Gunakan menu untuk membuat jadwal baru.`,
              { parse_mode: 'HTML' }
            );
            
            // Auto delete confirmation message after 3 seconds
            setTimeout(async () => {
              try {
                await bot.deleteMessage(chatId, emptyMsg.message_id);
              } catch (e) {
                // Ignore delete error
              }
            }, 3000);
          } else {
            // If still has schedules, show warning
            await bot.sendMessage(chatId,
              `⚠️ <b>Ada ${verifySchedules.length} jadwal yang gagal dibatalkan!</b>\n\n` +
              `Silakan coba lagi atau hubungi admin.`,
              { parse_mode: 'HTML' }
            );
          }
          
          await bot.answerCallbackQuery(id);
        } catch (error) {
          // Error handled silently
          await bot.answerCallbackQuery(id, { text: '❌ Error membatalkan jadwal', show_alert: true });
        }
        
      } else if (data === 'kickmassal_cancel_input') {
        // Cancel input process
        kickStates.delete(chatId);
        
        await bot.editMessageText(
          `❌ <b>Input dibatalkan</b>\n\nGunakan /kickmassal untuk memulai lagi.`,
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

  // Handle text input for kick massal
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text?.trim();
    
    if (!text || text.startsWith('/')) return;
    
    const state = kickStates.get(chatId);
    if (!state) return;
    
    try {
      // === CEK CANCEL/EXIT ===
      if (['exit', 'EXIT', 'Exit'].includes(text)) {
        // Hapus input form jika ada
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {
            // Ignore delete error
          }
        }
        
        // Hapus pesan jadwal jika sedang viewing schedule
        if (state.scheduleMessageId) {
          try {
            await bot.deleteMessage(chatId, state.scheduleMessageId);
          } catch (e) {
            // Ignore delete error
          }
        }
        
        kickStates.delete(chatId);
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      if (state.step === 'viewing_schedule') {
        // User sedang melihat jadwal, abaikan input apapun kecuali exit
        // Exit sudah di-handle di atas
        return;
      } else if (state.step === 'input_nomor') {
        // Parse multiple numbers (split by line breaks)
        const rawNumbers = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const validNumbers = [];
        const invalidNumbers = [];
        
        for (const rawNumber of rawNumbers) {
          const cleanNumber = rawNumber.replace(/\D/g, '');
          
          if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
            validNumbers.push(cleanNumber);
          } else {
            invalidNumbers.push(rawNumber);
          }
        }
        
        // Check if there are invalid numbers
        if (invalidNumbers.length > 0) {
          await bot.sendMessage(chatId, 
            `❌ <b>Nomor tidak valid ditemukan:</b>\n\n` +
            invalidNumbers.map(num => `• ${num}`).join('\n') + '\n\n' +
            `Nomor harus 10-15 digit angka.\n` +
            `Coba lagi atau ketik "exit" untuk batal.`,
            { parse_mode: 'HTML' }
          );
          await bot.deleteMessage(chatId, msg.message_id);
          return;
        }
        
        // Check if no valid numbers found
        if (validNumbers.length === 0) {
          await bot.sendMessage(chatId, 
            `❌ <b>Tidak ada nomor valid ditemukan!</b>\n\n` +
            `Pastikan format nomor benar (10-15 digit).\n` +
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
        
        // Update state with multiple numbers
        state.step = 'input_waktu';
        state.nomor_hp_list = validNumbers; // Store as array
        kickStates.set(chatId, state);
        
        const inputMsg = await bot.sendMessage(chatId,
          `✅ <b>Nomor HP diterima (${validNumbers.length} nomor):</b>\n\n` +
          validNumbers.map(num => `• ${num}`).join('\n') + '\n\n' +
          `⏰ <b>MASUKAN WAKTU KICK</b>\n\n` +
          `Ketik waktu dalam format jam:menit (24 jam)\n\n` +
          `💡 <b>Contoh:</b>\n` +
          `• 23:00 (jam 11 malam)\n` +
          `• 06:30 (jam 6 pagi 30 menit)\n` +
          `• 14:15 (jam 2 siang 15 menit)\n\n` +
          `🚀 <b>Execution Strategy:</b>\n` +
          `• ${validNumbers.length} nomor akan diproses SERENTAK\n` +
          `• Slot dalam satu nomor: Sequential (20s delay)\n` +
          `• API1 Combo: CEKSLOT1 → validate member_id → KICK1\n` +
          `• API2 Fallback: Direct kick dengan nomor_slot\n` +
          `• Real-time progress tracking\n\n` +
          `⚠️ <b>Jika waktu sudah lewat, akan di-set untuk besok.</b>\n\n` +
          `💡 Ketik "exit" untuk membatalkan`,
          { parse_mode: 'HTML' }
        );
        
        // Simpan message ID input baru
        const currentState = kickStates.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        kickStates.set(chatId, currentState);
        
      } else if (state.step === 'input_waktu') {
        // Validate waktu format
        const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
        
        if (!timeRegex.test(text)) {
          await bot.sendMessage(chatId,
            `❌ <b>Format waktu tidak valid!</b>\n\n` +
            `Gunakan format jam:menit (24 jam)\n` +
            `Contoh: 23:00 atau 06:30\n\n` +
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
        
        // Schedule kick for all numbers as a batch
        const nomorList = state.nomor_hp_list || [state.nomor_hp]; // Support both old and new format
        
        try {
          const targetTime = await scheduleKick(nomorList, text, chatId, bot);
          
          const jamFormatted = String(targetTime.getHours()).padStart(2, '0');
          const menitFormatted = String(targetTime.getMinutes()).padStart(2, '0');
          const waktuFormatted = `${jamFormatted}:${menitFormatted}`;
          
          const today = new Date();
          const isToday = targetTime.toDateString() === today.toDateString();
          const tanggalInfo = isToday ? 'hari ini' : 'besok';
          
          const confirmMsg = await bot.sendMessage(chatId,
            `✅ <b>KICK MASSAL BERHASIL DIJADWALKAN!</b>\n\n` +
            `📱 <b>Total nomor HP:</b> ${nomorList.length}\n` +
            `⏰ <b>Waktu kick:</b> ${waktuFormatted} (${tanggalInfo})\n` +
            `🎯 <b>Mode:</b> Parallel Processing\n\n` +
            nomorList.map(num => `• ${num}`).join('\n') + '\n\n' +
            `💡 <b>Catatan:</b>\n` +
            `• Semua nomor akan diproses serentak\n` +
            `• Delay 20 detik per slot dalam satu nomor\n` +
            `• Dual API strategy untuk reliability\n\n` +
            `📋 Gunakan menu untuk melihat jadwal aktif.`,
            { parse_mode: 'HTML' }
          );
          
          // Auto delete confirmation after 5 seconds
          setTimeout(async () => {
            try {
              await bot.deleteMessage(chatId, confirmMsg.message_id);
            } catch (e) {
              // Ignore delete error
            }
          }, 5000);
          
        } catch (error) {
          // Error handled silently
          await bot.sendMessage(chatId,
            `❌ <b>Error menjadwalkan kick massal!</b>\n\n` +
            `Silakan coba lagi atau hubungi admin.\n` +
            `Detail error: ${error.message}`,
            { parse_mode: 'HTML' }
          );
        }
        
        // Clean up state
        kickStates.delete(chatId);
      }
      
    } catch (error) {
      // Error handled silently
      await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      kickStates.delete(chatId);
    }
  });
};

// Export functions untuk backward compatibility
module.exports.kickAnggota = kickAnggota;
module.exports.getSlotInfo = getSlotInfo;
