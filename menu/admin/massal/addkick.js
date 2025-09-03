const axios = require('axios'); // MASIH PENYAKITAN (GAGAL KICK)
require('dotenv').config();
const { getSlotInfoAPI1Only } = require('../../admin/manage_akrab/cekslot1.js');

// API1 Configuration (KHUSUS - COMBO API1+CEKSLOT1+ADD1+KICK1)
const API_PRIMARY_BASE = process.env.API1;
const API_PRIMARY_ADD_ENDPOINT = process.env.ADD1;
const API_PRIMARY_KICK_ENDPOINT = process.env.KICK1;
const API_PRIMARY_INFO_ENDPOINT = process.env.CEKSLOT1;
const API_PRIMARY_TOKEN = process.env.APIKEY1;

const ADMIN_ID = process.env.ADMIN_ID;

// Storage untuk add-kick states
const addKickStates = new Map(); // key: chatId, value: { step, data }

// Helper function untuk format nomor ke internasional (untuk API1)
function formatNomorToInternational(nomor) {
  let cleanNomor = nomor.replace(/\D/g, '');
  
  if (cleanNomor.startsWith('08')) {
    cleanNomor = '628' + cleanNomor.substring(2);
  } else if (cleanNomor.startsWith('8') && !cleanNomor.startsWith('62')) {
    cleanNomor = '62' + cleanNomor;
  }
  
  return cleanNomor;
}

// COMBO Function: API1+ADD1 untuk add anggota
const addAnggotaAPI1Only = async (nomor_hp, slot_id, nomor_anggota, nama_anggota = "TUMBAL", parent_name = "XL", family_member_id = "") => {
  try {
    const formattedNomor = formatNomorToInternational(nomor_hp);
    const formattedAnggota = formatNomorToInternational(nomor_anggota);
    
    console.log(`🚀 ADD1 - Menambah anggota: ${nama_anggota} (${formattedAnggota}) ke slot ${slot_id}`);
    
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('id_parent', formattedNomor);
    formData.append('msisdn', formattedAnggota);
    formData.append('member_id', family_member_id); // Gunakan member_id dari slot yang dipilih
    formData.append('slot_id', slot_id);
    formData.append('parent_name', parent_name);
    formData.append('child_name', nama_anggota);

    console.log('📝 Form Data ADD1:', {
      token: API_PRIMARY_TOKEN ? API_PRIMARY_TOKEN.substring(0, 10) + '...' : 'KOSONG',
      id_parent: formattedNomor,
      msisdn: formattedAnggota,
      member_id: family_member_id,
      slot_id: slot_id,
      parent_name: parent_name,
      child_name: nama_anggota
    });

    const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_ADD_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    console.log('🔍 ADD1 Response:', JSON.stringify(response.data, null, 2));

    if (response.data?.status === 'success' || response.data?.success === true) {
      return {
        success: true,
        message: response.data.message || 'Anggota berhasil ditambahkan',
        source: '🟢 KHFY API1',
        member_id: response.data?.data?.member_id || response.data?.member_id || null,
        added_number: formattedAnggota,
        slot_id: slot_id
      };
    } else {
      return {
        success: false,
        error: response.data?.message || 'Gagal menambahkan anggota',
        source: '🟢 KHFY API1'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      source: '🟢 KHFY API1'
    };
  }
};

// COMBO Function: API1+KICK1 untuk kick anggota (sama dengan kickmassal.js)
const kickAnggotaAPI1Only = async (nomor_hp, member_id) => {
  try {
    const formattedNomor = formatNomorToInternational(nomor_hp);
    
    console.log(`🚀 KICK1 - Mengeluarkan anggota dengan member_id: ${member_id}`);
    
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('member_id', member_id);
    formData.append('id_parent', formattedNomor);

    console.log('📝 Form Data KICK1:', {
      token: API_PRIMARY_TOKEN ? API_PRIMARY_TOKEN.substring(0, 10) + '...' : 'KOSONG',
      member_id: member_id,
      id_parent: formattedNomor
    });

    const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_KICK_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    console.log('🔍 KICK1 Response:', JSON.stringify(response.data, null, 2));

    if (response.data?.status === 'success' || response.data?.success === true) {
      return {
        success: true,
        message: response.data.message || 'Anggota berhasil dikeluarkan',
        source: '🟢 KHFY API1'
      };
    } else {
      return {
        success: false,
        error: response.data?.message || 'Gagal mengeluarkan anggota',
        source: '🟢 KHFY API1'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      source: '🟢 KHFY API1'
    };
  }
};

// COMBO Function: API1+CEKSLOT1+ADD1+KICK1 (FULL COMBO PATTERN)
const addKickComboAPI1Only = async (nomor_hp, availableSlot, nomor_tumbal) => {
  try {
    console.log(`🎯 COMBO START: API1+CEKSLOT1+ADD1+KICK1 untuk slot ${availableSlot.slot_id}`);
    
    // STEP 1: Get fresh slot info (API1+CEKSLOT1)
    console.log('🚀 STEP 1: API1+CEKSLOT1 - Fresh slot data...');
    const slotResult = await getSlotInfoAPI1Only(nomor_hp);
    
    if (!slotResult.success) {
      return {
        success: false,
        source: '🟢 KHFY API1 COMBO',
        error: 'STEP 1 Failed: ' + (slotResult.error || 'CEKSLOT1 gagal'),
        tumbal: nomor_tumbal,
        slot: availableSlot.slot_id,
        combo: 'API1+CEKSLOT1 FAILED'
      };
    }

    // STEP 2: Add anggota tumbal (API1+ADD1)
    console.log('🚀 STEP 2: API1+ADD1 - Adding tumbal...');
    const addResult = await addAnggotaAPI1Only(
      nomor_hp, 
      availableSlot.slot_id, 
      nomor_tumbal, 
      'TUMBAL', 
      'XL',
      availableSlot.family_member_id || '' // Gunakan family_member_id dari slot
    );

    if (!addResult.success) {
      return {
        success: false,
        source: '🟢 KHFY API1 COMBO',
        error: 'STEP 2 Failed: ' + (addResult.error || 'ADD1 gagal'),
        tumbal: nomor_tumbal,
        slot: availableSlot.slot_id,
        combo: 'API1+CEKSLOT1+ADD1 FAILED'
      };
    }

    // STEP 3: Tunggu 30 detik setelah ADD
    console.log('⏳ STEP 3: Menunggu 30 detik setelah ADD...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // STEP 4: Kick anggota tumbal (API1+KICK1)
    console.log('🚀 STEP 4: API1+KICK1 - Kicking tumbal...');
    
    // Gunakan member_id dari hasil ADD atau fallback ke fresh slot info
    let memberIdToKick = addResult.member_id;
    
    if (!memberIdToKick) {
      // Fallback: ambil fresh slot info lagi untuk dapat member_id
      console.log('🔄 Fallback: Get fresh member_id from CEKSLOT1...');
      const freshSlotResult = await getSlotInfoAPI1Only(nomor_hp);
      if (freshSlotResult.success && freshSlotResult.slots) {
        // Cari slot yang sesuai dengan slot_id dan msisdn tumbal
        const targetSlot = freshSlotResult.slots.find(slot => 
          slot.slot_id === availableSlot.slot_id && 
          slot.msisdn === formatNomorToInternational(nomor_tumbal)
        );
        memberIdToKick = targetSlot?.family_member_id;
        console.log(`🔍 Fallback result: targetSlot found=${!!targetSlot}, member_id=${memberIdToKick}`);
      }
    }

    console.log(`🎯 KICK1 akan menggunakan member_id: ${memberIdToKick}`);

    if (!memberIdToKick) {
      return {
        success: false,
        source: '🟢 KHFY API1 COMBO',
        error: 'STEP 4 Failed: member_id tidak ditemukan untuk kick',
        tumbal: nomor_tumbal,
        slot: availableSlot.slot_id,
        combo: 'API1+CEKSLOT1+ADD1+KICK1 (NO MEMBER_ID)',
        addResult: addResult
      };
    }

    const kickResult = await kickAnggotaAPI1Only(nomor_hp, memberIdToKick);

    // COMBO RESULT
    return {
      success: kickResult.success,
      source: '🟢 KHFY API1 COMBO',
      message: kickResult.success ? 'COMBO berhasil: ADD+KICK complete' : 'COMBO partial: ADD berhasil, KICK gagal',
      addResult: addResult,
      kickResult: kickResult,
      tumbal: nomor_tumbal,
      slot: availableSlot.slot_id,
      member_id_used: memberIdToKick,
      combo: kickResult.success ? 'API1+CEKSLOT1+ADD1+KICK1 SUCCESS' : 'API1+CEKSLOT1+ADD1+KICK1 PARTIAL'
    };

  } catch (error) {
    console.error('❌ COMBO Error:', error);
    return {
      success: false,
      source: '🟢 KHFY API1 COMBO',
      error: `COMBO Exception: ${error.message}`,
      tumbal: nomor_tumbal,
      slot: availableSlot?.slot_id || 'unknown',
      combo: 'API1 COMBO EXCEPTION'
    };
  }
};

// Function untuk add anggota ke slot (LEGACY - updated for API1 only)
const addAnggota = async (nomor_hp, slot_id, nomor_anggota) => {
  const result = await addAnggotaAPI1Only(nomor_hp, slot_id, nomor_anggota);
  return result.success ? { status: 'success', ...result } : null;
};

// Function untuk kick anggota dari slot (LEGACY - updated for API1 only)
const kickAnggota = async (nomor_hp, member_id) => {
  const result = await kickAnggotaAPI1Only(nomor_hp, member_id);
  return result.success ? { status: 'success', ...result } : null;
};

// Function untuk proses massal add-kick dengan auto slot selection
const processAddKickMassal = async (nomor_pengelola_list, nomor_tumbal, chatId, bot) => {
  try {
    console.log(`🚀 ADDKICK MASSAL START - ${nomor_pengelola_list?.length || 0} pengelola, tumbal: ${nomor_tumbal}`);
    
    // Validasi input
    if (!nomor_pengelola_list || !Array.isArray(nomor_pengelola_list) || nomor_pengelola_list.length === 0) {
      throw new Error('Daftar nomor pengelola tidak valid atau kosong');
    }
    
    if (!nomor_tumbal) {
      throw new Error('Nomor tumbal tidak valid');
    }
    
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
      let statusText = `🎯 <b>STATUS ADD-KICK MASSAL - API1 COMBO</b>\n`;
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
      statusText += `\n🚀 <b>API Strategy:</b> API1+CEKSLOT1+ADD1(30s)+KICK1`;
      statusText += `\n🎯 <b>Filter:</b> Slot kosong dengan add_chances = 2`;
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
      
      try {
        console.log(`🔄 Processing pengelola ${i+1}/${nomor_pengelola_list.length}: ${nomor_hp}`);
        
        // STEP 1: Get slot info dengan API1+CEKSLOT1
        console.log(`🔍 STEP 1: Getting slot info for ${nomor_hp}`);
        const slotResult = await getSlotInfoAPI1Only(nomor_hp);
        const totalSlots = (slotResult.slots || []).length;
        
        console.log(`🔍 STEP 1 RESULT: success=${slotResult.success}, totalSlots=${totalSlots}`);
        
        if (!slotResult.success || totalSlots === 0) {
          // Mark as failed - no slots
          console.log(`❌ STEP 1 FAILED: success=${slotResult.success}, totalSlots=${totalSlots}`);
          statusTracker[nomor_hp] = { 
            status: 'failed', 
            reason: 'no_slots_or_cekslot1_failed',
            source: '🟢 KHFY API1'
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
      // 1. slot_id ada dan bukan 0 (bukan pengelola)
      // 2. alias kosong (slot belum terisi)
      // 3. msisdn kosong (belum ada anggota)
      // 4. add_chances = 2 (HANYA slot dengan add_chances = 2)
      
      // Ambil slots dari hasil cekslot1
      const allSlots = slotResult.slots || [];
      
      console.log(`🔍 TOTAL SLOTS: ${allSlots.length} slots from cekslot1`);
      
      const availableSlots = allSlots.filter(slot => {
        const slotId = slot.slot_id;
        const alias = (slot.alias || '').trim();
        const msisdn = (slot.msisdn || '').trim();
        const addChances = parseInt(slot.add_chances) || 0;
        
        console.log(`🔍 FILTER CHECK - Slot ${slotId}: alias='${alias}', msisdn='${msisdn}', add_chances=${addChances}`);
        
        // Slot kosong dengan add_chances = 2: slot_id ada, bukan 0, alias + msisdn kosong ATAU '-', dan add_chances = 2
        const isEmptyAlias = alias === '' || alias === '-';
        const isEmptyMsisdn = msisdn === '' || msisdn === '-';
        const isValid = slotId && slotId !== '0' && slotId !== 0 && isEmptyAlias && isEmptyMsisdn && addChances === 2;
        
        if (isValid) {
          console.log(`✅ SLOT VALID - Slot ${slotId} memenuhi kriteria (add_chances=2, kosong)`);
        } else {
          console.log(`❌ SLOT SKIP - Slot ${slotId} tidak memenuhi kriteria (need: empty alias/msisdn + add_chances=2)`);
        }
        
        return isValid;
      });
      
      console.log(`📊 FILTER RESULT - ${availableSlots.length} slot tersedia dari ${allSlots.length} total slot`);

      // Hanya proses pengelola dengan slot tersedia
      if (!availableSlots.length) {
        // Mark as failed - no available slots with add_chances = 2
        statusTracker[nomor_hp] = { 
          status: 'failed', 
          reason: 'no_slots_add_chances_2',
          source: '🟢 KHFY API1'
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

      let apiStats = { khfy: 0, failed: 0 };

      // Process setiap slot yang tersedia dengan API1 COMBO
      for (let j = 0; j < availableSlots.length; j++) {
        const slot = availableSlots[j];
        
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
        
        // PROSES: API1+CEKSLOT1+ADD1+KICK1 COMBO
        console.log(`🎯 MULAI COMBO untuk slot ${slot.slot_id}: API1+CEKSLOT1+ADD1+KICK1`);
        const comboResult = await addKickComboAPI1Only(nomor_hp, slot, nomor_tumbal);
        
        console.log(`🔍 COMBO RESULT untuk slot ${slot.slot_id}:`, {
          success: comboResult.success,
          combo: comboResult.combo,
          message: comboResult.message || comboResult.error
        });
        
        if (comboResult.success) {
          totalSuccess++;
          statusTracker[nomor_hp].successSlots++;
          apiStats.khfy++;
          console.log(`✅ COMBO SUCCESS - Slot ${slot.slot_id} berhasil: ADD+30s+KICK complete`);
        } else {
          totalFailed++;
          apiStats.failed++;
          console.log(`❌ COMBO FAILED - Slot ${slot.slot_id} gagal: ${comboResult.error}`);
          
          // Tambahkan ke daftar nomor gagal jika belum ada
          if (!failedNumbers.includes(nomor_hp)) {
            failedNumbers.push(nomor_hp);
          }
        }
        
        totalSlotProcessed++;
        
        // TUNGGU: Istirahat 35 detik setelah combo selesai, sebelum proses slot selanjutnya
        if (j < availableSlots.length - 1) { // Jangan tunggu di slot terakhir untuk pengelola ini
          console.log(`⏳ TUNGGU 35 detik sebelum proses slot selanjutnya...`);
          await new Promise(resolve => setTimeout(resolve, 35000)); // 35 detik (30s combo + 5s buffer)
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
      
      } catch (pengelolaError) {
        console.error(`❌ Error processing pengelola ${nomor_hp}:`, pengelolaError);
        // Mark as failed
        statusTracker[nomor_hp] = { 
          status: 'failed', 
          reason: 'processing_error',
          source: '🟢 KHFY API1',
          error: pengelolaError.message
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
    let globalApiStats = { khfy: 0, failed: 0 };
    
    // Aggregate API stats from status tracker if available
    Object.keys(statusTracker).forEach(nomor => {
      if (statusTracker[nomor].apiStats) {
        globalApiStats.khfy += statusTracker[nomor].apiStats.khfy || 0;
        globalApiStats.failed += statusTracker[nomor].apiStats.failed || 0;
      }
    });

    let finalMessage = `📊 <b>RINGKASAN HASIL - API1 COMBO</b>\n\n`;
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
    
    finalMessage += `\n⏰ <b>Waktu total:</b> ~${totalSlotProcessed * 65} detik (~${Math.round(totalSlotProcessed * 65 / 60)} menit)`;
    finalMessage += `\n🚀 <b>Strategy:</b> API1 Only (KHFY-Store)`;
    finalMessage += `\n⚡ <b>Combo timing:</b> CEKSLOT1 + ADD1 + 30s wait + KICK1 + 35s interval`;
    finalMessage += `\n🎯 <b>Filter:</b> Hanya slot kosong dengan add_chances = 2`;
    
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
          `🔧 <b>ADD-KICK MASSAL - API1 COMBO</b>\n\n` +
          `📝 <b>Fitur Baru:</b>\n` +
          `• API1 Only Strategy (KHFY-Store)\n` +
          `• Full API1 Combo Pattern\n` +
          `• Slot detection: kosong + add_chances = 2\n` +
          `• Add tumbal → tunggu 30s → kick tumbal\n` +
          `• Progress tracking real-time\n` +
          `• member_id tracking untuk kick\n\n` +
          `🚀 <b>API1 Combo Pattern:</b>\n` +
          `• Step 1: API1+CEKSLOT1 (fresh data)\n` +
          `• Step 2: API1+ADD1 (add tumbal)\n` +
          `• Step 3: Wait 30 seconds\n` +
          `• Step 4: API1+KICK1 (kick tumbal)\n\n` +
          `🎯 <b>Filter Slot Ketat:</b>\n` +
          `• Hanya slot kosong (tanpa alias/msisdn)\n` +
          `• Hanya slot dengan add_chances = 2\n` +
          `• Skip slot add_chances 0, 1, atau 3\n\n` +
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
          `⚡ <b>ADD-KICK MASSAL - API1 COMBO</b>\n\n` +
          `📞 <b>MASUKAN NOMOR PENGELOLA</b>\n\n` +
          `Ketik nomor HP pengelola (bisa multiple):\n\n` +
          `💡 <b>Format:</b>\n` +
          `• Single: 081234567890\n` +
          `• Multiple: (satu per baris)\n` +
          `  081234567890\n` +
          `  081234567891\n` +
          `  081234567892\n\n` +
          `🚀 <b>API1 Combo Strategy:</b>\n` +
          `• Full API1+CEKSLOT1+ADD1+KICK1 pattern\n` +
          `• member_id tracking untuk kick\n` +
          `• 30 detik wait setelah ADD\n\n` +
          `🎯 <b>Filter Ketat:</b>\n` +
          `• Hanya proses slot kosong dengan add_chances = 2\n` +
          `• Skip slot add_chances 0, 1, atau 3\n\n` +
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
          `🔄 <b>KONFIRMASI ADD-KICK MASSAL - API1 COMBO</b>\n\n` +
          `📞 <b>Nomor Pengelola:</b> ${state.nomor_pengelola_list.length} nomor\n` +
          `📝 <b>Daftar:</b>\n${state.nomor_pengelola_list.map((num, i) => `${i+1}. ${num}`).join('\n')}\n\n` +
          `👤 <b>Nomor Tumbal:</b> ${cleanNumber}\n\n` +
          `🚀 <b>API1 Combo Strategy:</b>\n` +
          `• Full API1 pattern: CEKSLOT1+ADD1+KICK1\n` +
          `• member_id tracking untuk kick yang akurat\n` +
          `• Single API reliability (KHFY-Store only)\n\n` +
          `⚡ <b>Filter Ketat:</b>\n` +
          `1. Slot harus punya slot_id (bukan 0)\n` +
          `2. Alias kosong (slot belum terisi)\n` +
          `3. MSISDN kosong (belum ada anggota)\n` +
          `4. Add_chances = 2 (HANYA slot dengan add_chances = 2)\n` +
          `5. Skip slot add_chances 0, 1, atau 3\n` +
          `6. Fresh data dari CEKSLOT1 setiap combo\n\n` +
          `⏰ <b>Timing Detail:</b>\n` +
          `• CEKSLOT1: instant\n` +
          `• ADD1 timeout: hingga 30 detik\n` +
          `• Wait setelah ADD: 30 detik\n` +
          `• KICK1 timeout: hingga 30 detik\n` +
          `• Interval antar slot: 35 detik\n` +
          `• Estimasi: ~65 detik per slot\n\n` +
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

// Export functions untuk testing/external use (API1 only)
module.exports.addAnggota = addAnggota;
module.exports.kickAnggota = kickAnggota;
module.exports.processAddKickMassal = processAddKickMassal;
