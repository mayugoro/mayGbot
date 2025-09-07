const axios = require('axios');
require('dotenv').config({ quiet: true });
const { getStok, addKickSchedule, getKickSchedules, getAllKickSchedules, deleteKickSchedule, completeKickSchedule } = require('../../../db');
const { getSlotInfoAPI1Only } = require('../../admin/manage_akrab/cekslot1.js');

// API1 Configuration (KHUSUS - SAMA DENGAN KICK1.JS)
const API_PRIMARY_BASE = process.env.API1;
const API_PRIMARY_KICK_ENDPOINT = process.env.KICK1;
const API_PRIMARY_TOKEN = process.env.APIKEY1;

const ADMIN_ID = process.env.ADMIN_ID;

// Storage untuk scheduled kicks
const scheduledKicks = new Map(); // key: chatId, value: { nomor_hp, waktu, timeoutId }
const kickStates = new Map(); // key: chatId, value: { step, nomor_hp }

// Helper function untuk format nomor internasional (sama dengan kick1.js)
function formatNomorToInternational(nomor) {
  let cleanNomor = nomor.replace(/\D/g, '');
  if (cleanNomor.startsWith('08')) {
    cleanNomor = '628' + cleanNomor.substring(2);
  } else if (cleanNomor.startsWith('8') && !cleanNomor.startsWith('62')) {
    cleanNomor = '62' + cleanNomor;
  }
  return cleanNomor;
}

// COMBO Function: API1+KICK1 untuk single member (form sederhana)
const kickSingleMemberAPI1Only = async (nomorPengelola, memberData) => {
  try {
    const formattedPengelola = formatNomorToInternational(nomorPengelola);
    
    // API kick1 hanya butuh 3 field: token, member_id, id_parent
    // console.log(`🚀 KICK1 - Mengeluarkan anggota: ${memberData.alias} (${memberData.msisdn})`);
    
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('member_id', memberData.family_member_id); // Menggunakan family_member_id spesifik anggota ini
    formData.append('id_parent', formattedPengelola);

    // console.log('📝 Form Data KICK1 (simple):', {
    //   token: API_PRIMARY_TOKEN ? API_PRIMARY_TOKEN.substring(0, 10) + '...' : 'KOSONG',
    //   member_id: memberData.family_member_id,
    //   id_parent: formattedPengelola,
    //   target_info: {
    //     alias: memberData.alias,
    //     msisdn: memberData.msisdn,
    //     slot_id: memberData.slot_id
    //   }
    // });

    const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_KICK_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    // console.log('🔍 KICK1 Response:', JSON.stringify(response.data, null, 2));

    if (response.data?.status === 'success' || response.data?.success === true) {
      return {
        success: true,
        message: response.data.message || 'Anggota berhasil dikeluarkan',
        source: '🟢 KHFY API1',
        memberData
      };
    } else {
      return {
        success: false,
        error: response.data?.message || 'Gagal mengeluarkan anggota',
        source: '🟢 KHFY API1',
        memberData
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      source: '🟢 KHFY API1',
      memberData
    };
  }
};

// Function untuk kick semua anggota dari satu nomor HP (COMBO API1+CEKSLOT1+KICK1)
const kickSemuaAnggotaSingle = async (nomor_hp, chatId, bot) => {
  // Send initial message
  const statusMsg = await bot.sendMessage(chatId, 
    `🔄 <b>STARTING API1 COMBO KICKMASSAL - ${nomor_hp}</b>\n\n⚡ Step 1: API1+CEKSLOT1 - Mengambil semua data slot...`, 
    { parse_mode: 'HTML' }
  );

  // COMBO STEP 1: Hit API1+CEKSLOT1 sekali saja - sama seperti kick1.js
  // console.log('🚀 STEP 1: API1+CEKSLOT1 - Mengambil data semua slot...');
  const slotResult = await getSlotInfoAPI1Only(nomor_hp);
  
  if (!slotResult.success) {
    await bot.editMessageText(
      `❌ <b>COMBO Step 1 Failed!</b>\n\n` +
      `Tidak dapat mengambil data slot dari ${nomor_hp}\n` +
      `Error: ${slotResult.error || 'Gagal hit API1+CEKSLOT1'}`,
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

  const allSlots = slotResult.slots;

  // Filter untuk kick: simpan data penting untuk form API kick1
  const membersToKick = allSlots.filter(slot => {
    // Hanya kick anggota yang bukan pengelola
    const isNotManager = slot.slot_id && slot.slot_id !== '0' && slot.slot_id !== 0;
    // Harus ada msisdn dan family_member_id untuk form kick1
    const hasValidData = slot.msisdn && slot.family_member_id;
    
    return isNotManager && hasValidData;
  }).map(member => ({
    // Data penting untuk form API kick1 (hanya butuh: token, member_id, id_parent)
    family_member_id: member.family_member_id, // ini yang jadi member_id di form
    msisdn: member.msisdn,                      // nomor anggota untuk logging
    slot_id: member.slot_id,                    // slot untuk logging
    alias: member.alias || member.nama || '-',  // nama untuk logging
    // Info tambahan untuk debugging
    quota_allocated: member.quota_allocated,
    quota_used: member.quota_used
  }));
  
  if (!membersToKick.length) {
    await bot.editMessageText(
      `✅ <b>Tidak ada anggota untuk di-kick di nomor ${nomor_hp}</b>\n\n` +
      `📊 Total slot: ${allSlots.length}\n` +
      `� Anggota valid: 0\n` +
      `�📡 Sumber: 🟢 KHFY API1 COMBO`, 
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
      source: '🟢 KHFY API1 COMBO'
    };
  }

  // Update status - Start Step 2
  await bot.editMessageText(
    `✅ <b>Step 1 Complete: Found ${membersToKick.length} members</b>\n` +
    `⚡ Step 2: Starting API1+KICK1 for each member...\n` +
    `📡 Combo: API1+CEKSLOT1 (1x) → API1+KICK1 (${membersToKick.length}x)`,
    {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'HTML'
    }
  );

  // COMBO STEP 2: Kick semua anggota menggunakan data dari Step 1 (20 detik delay per kick)
  let berhasil = 0;
  let gagal = 0;
  const kickResults = [];

  // Kick semua member sequential dengan 20 detik delay (sama seperti kick1.js tapi loop)
  for (let i = 0; i < membersToKick.length; i++) {
    const member = membersToKick[i];
    const progress = Math.round(((i + 1) / membersToKick.length) * 100);
    
    // Update progress setiap member
    await bot.editMessageText(
      `⚡ <b>Step 2: API1+KICK1... ${progress}%</b>\n` +
      `📊 Processing ${i + 1}/${membersToKick.length}\n` +
      `👤 Current: ${member.alias} (${member.msisdn})\n` +
      `⏱️ Delay: ${i > 0 ? '20s' : 'none'}`,
      {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'HTML'
      }
    ).catch(() => {}); // Ignore edit errors
    
    // Kick menggunakan data yang sudah dikumpulkan dari Step 1
    const kickResult = await kickSingleMemberAPI1Only(nomor_hp, {
      family_member_id: member.family_member_id, // member_id spesifik anggota ini
      msisdn: member.msisdn,                      // nomor anggota
      slot_id: member.slot_id,                    // slot anggota
      alias: member.alias                         // nama anggota
    });
    
    if (kickResult.success) {
      berhasil++;
      kickResults.push({ status: 'success', member: member, result: kickResult });
    } else {
      gagal++;
      kickResults.push({ status: 'failed', member: member, error: kickResult.error });
    }

    // Delay 20 detik antar kick (kecuali kick terakhir)
    if (i < membersToKick.length - 1) {
      // console.log(`⏱️ Delay 20 detik sebelum kick berikutnya...`);
      await new Promise(resolve => setTimeout(resolve, 20000));
    }
  }

  // Send final result
  await bot.editMessageText(
    `🏁 <b>API1 COMBO KICK SELESAI - ${nomor_hp}</b>\n\n` +
    `📊 <b>Hasil:</b>\n` +
    `✅ Berhasil: ${berhasil} member\n` +
    `❌ Gagal: ${gagal} member\n` +
    `📋 Total: ${membersToKick.length} member\n\n` +
    `📡 <b>API Strategy:</b>\n` +
    `🟢 API1+CEKSLOT1: 1x hit (data collection)\n` +
    `🟢 API1+KICK1: ${membersToKick.length}x hit (20s interval)\n` +
    `⚡ Total API calls: ${membersToKick.length + 1}\n\n` +
    `💡 <b>Efisiensi:</b> ${membersToKick.length > 0 ? ((berhasil / membersToKick.length) * 100).toFixed(1) : 0}%`,
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
    total: membersToKick.length,
    source: '🟢 KHFY API1 COMBO',
    kickResults,
    apiCalls: membersToKick.length + 1 // 1 CEKSLOT1 + N KICK1
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
      `🎊 <b>KICK MASSAL API1 COMBO SELESAI!</b>\n\n` +
      `📊 <b>RINGKASAN KESELURUHAN:</b>\n` +
      `📱 Total nomor HP: ${nomorList.length}\n` +
      `✅ Berhasil diproses: ${successfulNumbers}\n` +
      `❌ Gagal diproses: ${failedNumbers}\n\n` +
      `🎯 <b>HASIL KICK:</b>\n` +
      `✅ Member berhasil: ${totalBerhasil}\n` +
      `❌ Member gagal: ${totalGagal}\n` +
      `📋 Total member: ${totalSlots}\n\n` +
      `📡 <b>API1 COMBO STATS:</b>\n` +
      `🟢 API1+CEKSLOT1: ${nomorList.length}x hit\n` +
      `🟢 API1+KICK1: ${totalBerhasil + totalGagal}x hit\n` +
      `📊 Total API calls: ${nomorList.length + totalBerhasil + totalGagal}\n\n` +
      `💡 <b>Efisiensi:</b> ${totalSlots > 0 ? ((totalBerhasil / totalSlots) * 100).toFixed(1) : 0}%\n` +
      `⚡ <b>Strategy:</b> 100% API1 - No fallback`,
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
  // console.log('✅ [KICKMASSAL] Module loaded and registering handlers...');
  
  // Function untuk auto-load jadwal saat bot startup
  const autoLoadSchedulesOnStartup = async (bot) => {
    try {
      // console.log('🔄 [KICKMASSAL] Auto-loading scheduled kicks from database...');
      
      // Get all active schedules from database (untuk semua chat)
      const allSchedules = await getAllKickSchedules();
      
      if (!allSchedules || allSchedules.length === 0) {
        // console.log('📋 [KICKMASSAL] No scheduled kicks found in database');
        return { loaded: 0, expired: 0, errors: 0 };
      }
      
      let loadedCount = 0;
      let expiredCount = 0;
      let errorCount = 0;
      const now = new Date();
      
      // console.log(`📋 [KICKMASSAL] Found ${allSchedules.length} scheduled kicks in database`);
      
      // Group schedules by chat_id untuk efficient processing
      const schedulesByChat = {};
      for (const schedule of allSchedules) {
        if (!schedulesByChat[schedule.chat_id]) {
          schedulesByChat[schedule.chat_id] = [];
        }
        schedulesByChat[schedule.chat_id].push(schedule);
      }
      
      // Process each chat's schedules
      for (const [chatId, schedules] of Object.entries(schedulesByChat)) {
        for (const schedule of schedules) {
          try {
            // Reconstruct target time
            const targetTime = new Date();
            targetTime.setHours(schedule.jam, schedule.menit, 0, 0);
            
            // Jika waktu sudah lewat hari ini, set untuk besok
            if (targetTime <= now) {
              targetTime.setDate(targetTime.getDate() + 1);
            }
            
            const delay = targetTime.getTime() - now.getTime();
            
            // Skip if time has passed (less than 5 minutes remaining)
            if (delay < 300000) { // 5 minutes = 300000ms
              expiredCount++;
              // console.log(`⏰ [KICKMASSAL] Expired schedule: ${schedule.nomor_hp} at ${schedule.jam}:${schedule.menit}`);
              
              // Mark as completed in database
              try {
                await completeKickSchedule(schedule.chat_id, schedule.nomor_hp);
              } catch (e) {
                // Silently handle database error
              }
              continue;
            }
            
            // Create schedule key
            const scheduleKey = `${chatId}_${schedule.nomor_hp}`;
            
            // Skip if already exists in memory (shouldn't happen on startup, but safety check)
            if (scheduledKicks.has(scheduleKey)) {
              continue;
            }
            
            // Create timeout for this schedule
            const timeoutId = setTimeout(() => {
              // console.log(`🚀 [KICKMASSAL] Executing scheduled kick: ${schedule.nomor_hp} at ${schedule.jam}:${schedule.menit}`);
              
              // Execute kick for this number
              kickSemuaAnggotaScheduled(schedule.nomor_hp, parseInt(chatId), bot).finally(() => {
                // Clean up after completion
                scheduledKicks.delete(scheduleKey);
                
                // Mark as completed in database
                try {
                  completeKickSchedule(schedule.chat_id, schedule.nomor_hp).catch(() => {});
                } catch (e) {
                  // Silently handle database error
                }
              });
            }, delay);
            
            // Store in memory
            scheduledKicks.set(scheduleKey, {
              nomor_hp: schedule.nomor_hp,
              jam: schedule.jam,
              menit: schedule.menit,
              targetTime: targetTime.toISOString(),
              timeoutId,
              type: 'individual',
              chat_id: schedule.chat_id
            });
            
            loadedCount++;
            
            const jamFormatted = String(schedule.jam).padStart(2, '0');
            const menitFormatted = String(schedule.menit).padStart(2, '0');
            const timeRemaining = getTimeRemaining(targetTime);
            
            // console.log(`✅ [KICKMASSAL] Loaded schedule: ${schedule.nomor_hp} → ${jamFormatted}:${menitFormatted} (${timeRemaining})`);
            
          } catch (error) {
            errorCount++;
            // console.log(`❌ [KICKMASSAL] Error loading schedule ${schedule.nomor_hp}:`, error.message);
          }
        }
      }
      
      // console.log(`🎯 [KICKMASSAL] Auto-load complete: ${loadedCount} loaded, ${expiredCount} expired, ${errorCount} errors`);
      
      return {
        loaded: loadedCount,
        expired: expiredCount,
        errors: errorCount,
        total: allSchedules.length
      };
      
    } catch (error) {
      // console.log('❌ [KICKMASSAL] Error in auto-load:', error.message);
      return { loaded: 0, expired: 0, errors: 1 };
    }
  };
  
  // Load schedules on startup first
  autoLoadSchedulesOnStartup(bot);
  
  // Handle callback queries
  bot.on('callback_query', async (query) => {
    const { data, message, id, from } = query;
    const chatId = message?.chat?.id;
    const userId = from.id;
    
    // Log semua callback yang diterima (bukan hanya kickmassal)
    if (data && (data.includes('kick') || data.includes('massal'))) {
      // console.log(`🔍 [KICKMASSAL] Related callback received: ${data} from user ${userId} in chat ${chatId}`);
    }
    
    if (!chatId) return;
    
    try {
      if (data === 'kick_massal') {
        // console.log(`🎯 [KICKMASSAL] Handling kick_massal callback from user ${userId}`);
        // Show kick massal manager menu
        const keyboard = [
          [{ text: '🚀 KICK MASSAL', callback_data: 'kickmassal_start' }],
          [{ text: '📋 LIHAT JADWAL', callback_data: 'kickmassal_list' }],
          [{ text: '🔄 RE-AKTIF JADWAL', callback_data: 'kickmassal_reactivate' }],
          [{ text: '❌ BATAL JADWAL', callback_data: 'kickmassal_cancel' }],
          [{ text: '🔙 KEMBALI', callback_data: 'menu_massal' }]
        ];
        
        const content = 
          `🎯 <b>KICK MASSAL MANAGER</b>\n\n` +
          `📝 <b>API1 COMBO Strategy (NEW):</b>\n` +
          `• API1+CEKSLOT1: Hit 1x untuk collect semua data\n` +
          `• API1+KICK1: Hit Nx untuk kick setiap member\n` +
          `• family_member_id validation dari Step 1\n` +
          `• No fallback - 100% API1 precision\n` +
          `• 20 detik delay antar kick slot\n\n` +
          `🚀 <b>Processing Mode:</b>\n` +
          `• Multiple nomor: Parallel execution\n` +
          `• Members per nomor: Sequential (20s delay)\n` +
          `• Data collection: 1x per nomor HP\n\n` +
          `🔧 <b>Flow Pattern (sama dengan kick1.js):</b>\n` +
          `• Hit API1+CEKSLOT1 → collect family_member_id\n` +
          `• Loop API1+KICK1 → kick each member (20s)\n` +
          `• Real-time progress tracking\n\n` +
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
          `🦵 <b>KICK MASSAL - API1 COMBO ONLY</b>\n\n` +
          `📞 <b>MASUKAN NOMOR HP</b>\n\n` +
          `Ketik nomor HP yang ingin di-kick semua membernya:\n\n` +
          `💡 <b>Input tunggal:</b>\n` +
          `• 081234567890\n\n` +
          `💡 <b>Input massal (pisahkan dengan enter):</b>\n` +
          `• 081234567890\n` +
          `• 087835671902\n` +
          `• 6281234567890\n\n` +
          `🚀 <b>API1 COMBO Strategy:</b>\n` +
          `• Step 1: API1+CEKSLOT1 (1x per nomor)\n` +
          `• Step 2: API1+KICK1 (Nx per member, 20s delay)\n` +
          `• 100% API1 - No fallback, maximum precision\n` +
          `• family_member_id validation dari Step 1\n\n` +
          `🎯 <b>Processing:</b>\n` +
          `• Multiple nomor: Parallel (bersamaan)\n` +
          `• Members per nomor: Sequential (berurutan)\n\n` +
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
        
      } else if (data === 'kickmassal_reactivate') {
        // console.log(`🔄 [KICKMASSAL] Processing kickmassal_reactivate from user ${userId}`);
        // Re-activate all scheduled kicks from database (after bot restart)
        // console.log(`🔄 [KICKMASSAL] Reactivate button clicked by user ${userId} in chat ${chatId}`);
        
        try {
          const schedules = await getKickSchedules(chatId.toString());
          // console.log(`📋 [KICKMASSAL] Found ${schedules.length} schedules in database for chat ${chatId}`);
          
          if (schedules.length === 0) {
            // console.log(`⚠️ [KICKMASSAL] No schedules found, showing alert to user`);
            await bot.answerCallbackQuery(id, { text: '📋 Tidak ada jadwal kick untuk diaktifkan', show_alert: true });
            return;
          }
          
          let reactivatedCount = 0;
          let expiredCount = 0;
          let errorCount = 0;
          const now = new Date();
          
          // Process each schedule from database
          for (const schedule of schedules) {
            try {
              // Reconstruct target time
              const targetTime = new Date();
              targetTime.setHours(schedule.jam, schedule.menit, 0, 0);
              
              // Jika waktu sudah lewat hari ini, set untuk besok
              if (targetTime <= now) {
                targetTime.setDate(targetTime.getDate() + 1);
              }
              
              const delay = targetTime.getTime() - now.getTime();
              
              // Skip if time has passed (less than 1 minute remaining)
              if (delay < 60000) {
                expiredCount++;
                // Mark as completed in database
                await completeKickSchedule(chatId.toString(), schedule.nomor_hp);
                continue;
              }
              
              // Create schedule key
              const scheduleKey = `${chatId}_${schedule.nomor_hp}`;
              
              // Skip if already active in memory
              if (scheduledKicks.has(scheduleKey)) {
                continue;
              }
              
              // Create timeout for this schedule
              const timeoutId = setTimeout(() => {
                // Execute kick for this number
                kickSemuaAnggotaScheduled(schedule.nomor_hp, chatId, bot).finally(() => {
                  // Clean up after completion
                  scheduledKicks.delete(scheduleKey);
                  completeKickSchedule(chatId.toString(), schedule.nomor_hp).catch(() => {});
                });
              }, delay);
              
              // Store in memory
              scheduledKicks.set(scheduleKey, {
                nomor_hp: schedule.nomor_hp,
                jam: schedule.jam,
                menit: schedule.menit,
                targetTime: targetTime.toISOString(),
                timeoutId,
                type: 'individual'
              });
              
              reactivatedCount++;
              
            } catch (error) {
              errorCount++;
            }
          }
          
          // Show result
          let resultText = `🔄 <b>RE-AKTIF JADWAL SELESAI</b>\n\n`;
          resultText += `📊 <b>Statistik:</b>\n`;
          resultText += `✅ Berhasil diaktifkan: ${reactivatedCount}\n`;
          resultText += `⏰ Sudah expired: ${expiredCount}\n`;
          if (errorCount > 0) {
            resultText += `❌ Error: ${errorCount}\n`;
          }
          resultText += `📋 Total jadwal: ${schedules.length}\n\n`;
          
          if (reactivatedCount > 0) {
            resultText += `🎯 <b>Jadwal aktif kembali:</b>\n`;
            
            // Show active schedules
            for (const [key, data] of scheduledKicks) {
              if (key.startsWith(chatId.toString()) && data.type === 'individual') {
                const jamFormatted = String(data.jam).padStart(2, '0');
                const menitFormatted = String(data.menit).padStart(2, '0');
                const waktuFormatted = `${jamFormatted}:${menitFormatted}`;
                
                const targetTime = new Date(data.targetTime);
                const timeRemaining = getTimeRemaining(targetTime);
                
                resultText += `• ${data.nomor_hp} → ${waktuFormatted} (${timeRemaining})\n`;
              }
            }
          }
          
          resultText += `\n💡 <b>Semua jadwal sudah dikembalikan ke memori!</b>`;
          
          const resultMsg = await bot.sendMessage(chatId, resultText, { parse_mode: 'HTML' });
          
          // Auto delete result after 8 seconds
          setTimeout(async () => {
            try {
              await bot.deleteMessage(chatId, resultMsg.message_id);
            } catch (e) {
              // Ignore delete error
            }
          }, 8000);
          
          await bot.answerCallbackQuery(id, { 
            text: `✅ ${reactivatedCount} jadwal berhasil diaktifkan kembali`, 
            show_alert: false 
          });
          
        } catch (error) {
          console.error(`❌ [KICKMASSAL] Error in reactivate for chat ${chatId}:`, error.message);
          console.error(`🔍 [KICKMASSAL] Reactivate error stack:`, error.stack);
          await bot.answerCallbackQuery(id, { text: '❌ Error mengaktifkan jadwal', show_alert: true });
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
      console.error('❌ [KICKMASSAL] Callback error:', error.message);
      console.error('🔍 [KICKMASSAL] Error stack:', error.stack);
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
          `✅ <b>Format yang didukung:</b>\n` +
          `• <code>23:00</code> (HH:MM) - Standard\n` +
          `• <code>23.00</code> (HH.MM) - Titik\n` +
          `• <code>2300</code> (HHMM) - Tanpa separator\n` +
          `• <code>23;00</code> (HH;MM) - Semicolon\n` +
          `• <code>23</code> (HH) - Otomatis :00\n` +
          `• <code>9</code> (H) - Otomatis 09:00\n\n` +
          `� <b>Contoh input yang valid:</b>\n` +
          `• Jam 6 pagi: <code>6</code>, <code>06</code>, <code>6:00</code>, <code>6.00</code>, <code>600</code>, <code>6;00</code>\n` +
          `• Jam 6:30 pagi: <code>6:30</code>, <code>6.30</code>, <code>630</code>, <code>6;30</code>\n` +
          `• Jam 11 malam: <code>23</code>, <code>23:00</code>, <code>23.00</code>, <code>2300</code>, <code>23;00</code>\n` +
          `• Tengah malam: <code>0</code>, <code>00</code>, <code>0:00</code>, <code>0.00</code>, <code>0000</code>, <code>0;00</code>\n\n` +
          `🚀 <b>API1 COMBO Execution:</b>\n` +
          `• ${validNumbers.length} nomor akan diproses PARALLEL\n` +
          `• Per nomor: API1+CEKSLOT1 (1x) → API1+KICK1 (Nx)\n` +
          `• Member kick: Sequential dengan 20s delay\n` +
          `• 100% API1 precision - No fallback\n\n` +
          `⚠️ <b>Jika waktu sudah lewat, akan di-set untuk besok.</b>\n\n` +
          `💡 Ketik "exit" untuk membatalkan`,
          { parse_mode: 'HTML' }
        );
        
        // Simpan message ID input baru
        const currentState = kickStates.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        kickStates.set(chatId, currentState);
        
      } else if (state.step === 'input_waktu') {
        // Function untuk parsing waktu dengan format fleksibel
        const parseFlexibleTime = (timeInput) => {
          // Bersihkan input dari spasi
          const cleanInput = timeInput.trim();
          
          // Format yang didukung:
          // 1. HH:MM (default) - 00:00, 23:59
          // 2. HH.MM - 00.00, 23.59  
          // 3. HHMM - 0000, 2359
          // 4. HH;MM - 00;00, 23;59
          
          let jam, menit;
          
          // Pattern 1: HH:MM
          const colonPattern = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
          const colonMatch = cleanInput.match(colonPattern);
          if (colonMatch) {
            jam = parseInt(colonMatch[1]);
            menit = parseInt(colonMatch[2]);
            return { jam, menit, valid: true, format: 'HH:MM' };
          }
          
          // Pattern 2: HH.MM
          const dotPattern = /^([01]?[0-9]|2[0-3])\.([0-5][0-9])$/;
          const dotMatch = cleanInput.match(dotPattern);
          if (dotMatch) {
            jam = parseInt(dotMatch[1]);
            menit = parseInt(dotMatch[2]);
            return { jam, menit, valid: true, format: 'HH.MM' };
          }
          
          // Pattern 3: HH;MM
          const semicolonPattern = /^([01]?[0-9]|2[0-3]);([0-5][0-9])$/;
          const semicolonMatch = cleanInput.match(semicolonPattern);
          if (semicolonMatch) {
            jam = parseInt(semicolonMatch[1]);
            menit = parseInt(semicolonMatch[2]);
            return { jam, menit, valid: true, format: 'HH;MM' };
          }
          
          // Pattern 4: HHMM (tanpa separator)
          const noSepPattern = /^([01]?[0-9]|2[0-3])([0-5][0-9])$/;
          const noSepMatch = cleanInput.match(noSepPattern);
          if (noSepMatch) {
            // Khusus untuk format HHMM, perlu handle 1-4 digit
            if (cleanInput.length === 3) {
              // Format HMM -> H:MM (contoh: 930 -> 9:30)
              jam = parseInt(cleanInput.substring(0, 1));
              menit = parseInt(cleanInput.substring(1, 3));
            } else if (cleanInput.length === 4) {
              // Format HHMM -> HH:MM (contoh: 0930 -> 09:30)
              jam = parseInt(cleanInput.substring(0, 2));
              menit = parseInt(cleanInput.substring(2, 4));
            } else if (cleanInput.length === 2) {
              // Format HH -> HH:00 (contoh: 09 -> 09:00)
              jam = parseInt(cleanInput);
              menit = 0;
            } else if (cleanInput.length === 1) {
              // Format H -> H:00 (contoh: 9 -> 09:00)
              jam = parseInt(cleanInput);
              menit = 0;
            } else {
              return { valid: false };
            }
            
            // Validasi range
            if (jam >= 0 && jam <= 23 && menit >= 0 && menit <= 59) {
              return { jam, menit, valid: true, format: 'HHMM' };
            }
          }
          
          return { valid: false };
        };
        
        // Parse waktu dengan format fleksibel
        const timeResult = parseFlexibleTime(text);
        
        if (!timeResult.valid) {
          await bot.sendMessage(chatId,
            `❌ <b>Format waktu tidak valid!</b>\n\n` +
            `✅ <b>Format yang didukung:</b>\n` +
            `• <code>23:00</code> (HH:MM)\n` +
            `• <code>23.00</code> (HH.MM)\n` +
            `• <code>2300</code> (HHMM)\n` +
            `• <code>23;00</code> (HH;MM)\n` +
            `• <code>23</code> (HH - otomatis :00)\n` +
            `• <code>9</code> (H - otomatis 09:00)\n\n` +
            `📝 <b>Contoh input yang valid:</b>\n` +
            `• 06:30, 6:30, 630, 6.30, 6;30\n` +
            `• 23:00, 23.00, 2300, 23;00, 23\n` +
            `• 00:00, 0.00, 0000, 0;00, 0\n\n` +
            `⏰ <b>Range:</b> 00:00 - 23:59 (24 jam)\n\n` +
            `Coba lagi atau ketik "exit" untuk batal.`,
            { parse_mode: 'HTML' }
          );
          await bot.deleteMessage(chatId, msg.message_id);
          return;
        }
        
        const { jam, menit, format } = timeResult;
        
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
        
        // Format waktu yang sudah di-parse ke format HH:MM untuk scheduleKick
        const jamFormatted = String(jam).padStart(2, '0');
        const menitFormatted = String(menit).padStart(2, '0');
        const formattedTime = `${jamFormatted}:${menitFormatted}`;
        
        try {
          const targetTime = await scheduleKick(nomorList, formattedTime, chatId, bot);
          
          const waktuFormatted = `${jamFormatted}:${menitFormatted}`;
          
          const today = new Date();
          const isToday = targetTime.toDateString() === today.toDateString();
          const tanggalInfo = isToday ? 'hari ini' : 'besok';
          
          const confirmMsg = await bot.sendMessage(chatId,
            `✅ <b>KICK MASSAL BERHASIL DIJADWALKAN!</b>\n\n` +
            `📱 <b>Total nomor HP:</b> ${nomorList.length}\n` +
            `⏰ <b>Waktu kick:</b> ${waktuFormatted} (${tanggalInfo})\n` +
            `🎯 <b>Mode:</b> API1 COMBO Processing\n` +
            `📝 <b>Input format:</b> ${format} → ${text} → ${waktuFormatted}\n\n` +
            nomorList.map(num => `• ${num}`).join('\n') + '\n\n' +
            `💡 <b>Execution Strategy:</b>\n` +
            `• Semua nomor akan diproses parallel\n` +
            `• Per nomor: API1+CEKSLOT1 (1x) → API1+KICK1 (Nx)\n` +
            `• Member kick: Sequential dengan 20s delay\n` +
            `• 100% API1 precision - No fallback\n\n` +
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