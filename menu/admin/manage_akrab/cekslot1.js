// ini hanya tools untuk api1
// tidak ada fallback ke api lain
// khusus api1
// tipe kombo: API1+CEKSLOT1
// (1) API1+CEKSLOT1

const axios = require('axios');
require('dotenv').config();

// API1 Configuration (KHUSUS)
const API_PRIMARY_BASE = process.env.API1;
const API_PRIMARY_INFO_ENDPOINT = process.env.CEKSLOT1;
const API_PRIMARY_TOKEN = process.env.APIKEY1;

// Storage untuk cekslot states
const cekslotStates = new Map();

// Helper function untuk format nomor internasional
function formatNomorToInternational(nomor) {
  let cleanNomor = nomor.replace(/\D/g, '');
  if (cleanNomor.startsWith('08')) {
    cleanNomor = '628' + cleanNomor.substring(2);
  } else if (cleanNomor.startsWith('8') && !cleanNomor.startsWith('62')) {
    cleanNomor = '62' + cleanNomor;
  }
  return cleanNomor;
}

// COMBO Function: API1+CEKSLOT1 (TANPA FALLBACK)
const getSlotInfoAPI1Only = async (nomor_hp) => {
  try {
    const formattedNomor = formatNomorToInternational(nomor_hp);
    
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('id_parent', formattedNomor);

    console.log('🚀 API Request:');
    console.log('📡 URL:', API_PRIMARY_BASE + API_PRIMARY_INFO_ENDPOINT);
    console.log('📝 Payload:', {
      token: API_PRIMARY_TOKEN ? API_PRIMARY_TOKEN.substring(0, 10) + '...' : 'KOSONG',
      id_parent: formattedNomor
    });

    const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_INFO_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    // Uncomment for debugging: console.log('🔍 API Response:', JSON.stringify(response.data, null, 2));
    console.log('🔍 API Response:', JSON.stringify(response.data, null, 2));
    console.log('🔍 Response Status:', response.data?.status);
    console.log('🔍 Response Data:', response.data?.data);

    if ((response.data?.status === 'success' || response.data?.status === true) && response.data?.data?.member_info) {
      const memberInfo = response.data.data.member_info;
      const members = memberInfo.members || [];
      const additionalMembers = memberInfo.additional_members || [];
      
      // Gabungkan members utama dan additional members
      const allMembers = [...members, ...additionalMembers];
      
      // Pisahkan pengelola dan anggota
      const parentMember = allMembers.find(member => member.member_type === 'PARENT');
      const childMembers = allMembers.filter(member => member.member_type === 'CHILD');
      
      // Debug: log raw member data untuk melihat field yang tersedia
      console.log('🔍 Raw Child Members Data:');
      childMembers.forEach((member, index) => {
        console.log(`Member ${index + 1}:`, JSON.stringify(member, null, 2));
      });
      
      const slots = childMembers.map((member, index) => ({
        parent_id: memberInfo.parent_msisdn || formattedNomor,
        family_member_id: member.family_member_id || member.id || member.member_id,
        alias: member.alias || member.name || member.nama || '-',
        msisdn: member.msisdn || member.phone || member.nomor || '-',
        slot_id: member.slot_id !== undefined ? member.slot_id : index,
        add_chances: member.add_chances || member.sisa_add || member['sisa-add'] || 0,
        member_type: member.member_type || 'UNKNOWN',
        // Quota fields - convert dari bytes ke GB
        quota_allocated: member.usage?.quota_allocated || member.quota_allocated || 0,
        quota_used: member.usage?.quota_used || member.quota_used || 0,
        quota_allocated_gb: (member.usage?.quota_allocated || member.quota_allocated) ? 
          (parseFloat(member.usage?.quota_allocated || member.quota_allocated) / 1073741824).toFixed(2) : '0.00',
        quota_used_gb: (member.usage?.quota_used || member.quota_used) ? 
          (parseFloat(member.usage?.quota_used || member.quota_used) / 1073741824).toFixed(2) : '0.00',
        quota_remaining_gb: (member.usage?.quota_allocated || member.quota_allocated) && (member.usage?.quota_used || member.quota_used) ? 
          ((parseFloat(member.usage?.quota_allocated || member.quota_allocated) - parseFloat(member.usage?.quota_used || member.quota_used)) / 1073741824).toFixed(2) : '0.00',
        // Additional fields for compatibility
        nama: member.alias || member.name || member.nama || '-',
        nomor: member.msisdn || member.phone || member.nomor || '-',
        'sisa-add': member.add_chances || member.sisa_add || member['sisa-add'] || 0
      }));
      
      return {
        success: true,
        slots,
        parent_info: {
          parent_id: memberInfo.parent_msisdn || formattedNomor,
          parent_alias: parentMember?.alias || memberInfo.parent_alias || memberInfo.parent_name || 'Pengelola',
          parent_msisdn: memberInfo.parent_msisdn || formattedNomor,
          parent_member_id: parentMember?.family_member_id || '',
          parent_add_chances: parentMember?.add_chances || 0,
          group_name: memberInfo.group_name || '',
          total_regular_slot: memberInfo.total_regular_slot || 0,
          total_paid_slot: memberInfo.total_paid_slot || 0
        },
        source: '🟢 KHFY API1',
        combo: 'API1+CEKSLOT1'
      };
    }
    
    // Uncomment for debugging: console.log('❌ API Response tidak sesuai format yang diharapkan');
    // Uncomment for debugging: console.log('📄 Full Response:', JSON.stringify(response.data, null, 2));
    console.log('❌ API Response tidak sesuai format yang diharapkan');
    console.log('📄 Full Response:', JSON.stringify(response.data, null, 2));
    
    return { 
      success: false, 
      slots: [], 
      source: '🟢 KHFY API1',
      combo: 'API1+CEKSLOT1',
      error: 'Tidak ada data slot ditemukan'
    };
  } catch (error) {
    // Uncomment for debugging: console.log('💥 API Error:', error.message);
    // Uncomment for debugging: console.log('🔍 Error Details:', error.response?.data || error);
    console.log('💥 API Error:', error.message);
    console.log('🔍 Error Details:', error.response?.data || error);
    
    return { 
      success: false, 
      slots: [], 
      error: error.message, 
      source: '🟢 KHFY API1',
      combo: 'API1+CEKSLOT1'
    };
  }
};

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, message, id, from } = query;
    const chatId = message?.chat?.id;
    const userId = from.id;
    
    if (!chatId) return;

    if (data === 'cekslot1') {
      cekslotStates.set(chatId, { step: 'input_nomor' });
      
      const inputMsg = await bot.sendMessage(chatId,
        `🔍 <b>CEK SLOT - API1 KHUSUS</b>\n\n` +
        `📞 <b>MASUKKAN NOMOR PENGELOLA</b>\n\n` +
        `Ketik nomor HP yang akan dicek:\n\n` +
        `💡 <b>Contoh:</b> <code>081234567890</code>\n\n` +
        `🚀 <b>Strategi API1:</b>\n` +
        `• Khusus: API1+CEKSLOT1 (KHFY)\n` +
        `• Tanpa fallback - presisi tinggi\n` +
        `• Data family_member_id akurat\n\n` +
        `💡 Ketik "keluar" untuk membatalkan`,
        { parse_mode: 'HTML' }
      );
      
      cekslotStates.set(chatId, { step: 'input_nomor', inputMessageId: inputMsg.message_id });
      await bot.answerCallbackQuery(id);
      return;
    }
  });

  // Handle text input
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    
    if (!text || text.startsWith('/')) return;
    
    const state = cekslotStates.get(chatId);
    if (!state) return;
    
    try {
      if (['keluar', 'KELUAR', 'exit', 'EXIT', 'Exit'].includes(text)) {
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        cekslotStates.delete(chatId);
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      if (state.step === 'input_nomor') {
        const cleanNumber = text.replace(/\D/g, '');
        
        if (cleanNumber.length < 10 || cleanNumber.length > 15) {
          await bot.sendMessage(chatId,
            `❌ <b>Format nomor tidak valid!</b>\n\n` +
            `Nomor harus 10-15 digit angka.\n` +
            `Coba lagi atau ketik "keluar" untuk batal.`,
            { parse_mode: 'HTML' }
          );
          await bot.deleteMessage(chatId, msg.message_id);
          return;
        }
        
        // Hapus input messages
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}
        
        // Process dengan API1 SAJA
        const processingMsg = await bot.sendMessage(chatId,
          `⚡ <b>MEMPROSES API1...</b>\n\n` +
          `📞 <b>Nomor:</b> ${cleanNumber}\n` +
          `🔄 <b>Status:</b> Mengecek slot dengan API1 khusus...\n\n` +
          `🚀 <b>Strategi:</b> API1+CEKSLOT1 (presisi tinggi)`,
          { parse_mode: 'HTML' }
        );
        
        const result = await getSlotInfoAPI1Only(cleanNumber);
        
        let responseText = `🔍 <b>HASIL CEK SLOT - ${result.combo}</b>\n\n`;
        responseText += `📞 <b>Nomor:</b> ${cleanNumber}\n`;
        responseText += `📡 <b>Sumber API:</b> ${result.source}\n\n`;
        
        if (result.success && result.slots.length > 0) {
          // Display Parent Info First
          if (result.parent_info) {
            responseText += `👑 <b>PENGELOLA KELUARGA:</b>\n`;
            responseText += `📞 Pengelola: ${result.parent_info.parent_id}\n`;
            responseText += `✨ Nama: ${result.parent_info.parent_alias}\n`;
            responseText += `📧 Nomor: ${result.parent_info.parent_msisdn}\n\n`;
          }
          
          responseText += `👥 <b>DAFTAR ANGGOTA KELUARGA (${result.slots.length} anggota):</b>\n\n`;
          
          result.slots.forEach((slot, index) => {
            // Format data sesuai permintaan user
            const memberID = slot.family_member_id || '-';
            const alias = slot.alias || '-';
            const msisdn = slot.msisdn || '-';
            const slotID = slot.slot_id !== undefined ? slot.slot_id : index;
            const addChances = slot.add_chances || 0;
            
            responseText += `🔸 <b>ANGGOTA ${index + 1}:</b>\n`;
            responseText += `💌 Member ID: <code>${memberID}</code>\n`;
            responseText += `✨ Anggota: ${alias}\n`;
            responseText += `📧 Nomor: ${msisdn}\n`;
            responseText += `⚡ Slot ID: ${slotID}\n`;
            responseText += `♻️ Limit: ${addChances}\n`;
            
            // Tambahkan informasi kuota
            const quotaAllocated = slot.quota_allocated_gb || '0.00';
            const quotaUsed = slot.quota_used_gb || '0.00';
            const quotaRemaining = slot.quota_remaining_gb || '0.00';
            
            responseText += `📊 Kuota Awal: ${quotaAllocated} GB\n`;
            responseText += `📈 Kuota Terpakai: ${quotaUsed} GB\n`;
            responseText += `📉 Kuota Sisa: ${quotaRemaining} GB\n\n`;
          });
        } else {
          responseText += `❌ <b>TIDAK ADA SLOT DITEMUKAN</b>\n\n`;
          responseText += `🔍 <b>Kemungkinan:</b>\n`;
          responseText += `• Nomor belum login di API1\n`;
          responseText += `• API1 sedang maintenance\n`;
          responseText += `• Nomor tidak terdaftar di sistem KHFY\n`;
          if (result.error) {
            responseText += `• Error: ${result.error}\n`;
          }
          responseText += `\n`;
        }
        
        try {
          await bot.editMessageText(responseText, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'HTML'
          });
        } catch (e) {
          await bot.sendMessage(chatId, responseText, { parse_mode: 'HTML' });
        }
        
        cekslotStates.delete(chatId);
      }
      
    } catch (error) {
      await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      cekslotStates.delete(chatId);
    }
  });
};

// Export functions untuk penggunaan internal
module.exports.getSlotInfoAPI1Only = getSlotInfoAPI1Only;
