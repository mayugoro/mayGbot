// ini hanya tools untuk api1
// tidak ada fallback ke api lain
// khusus api1
// tipe kombo: API1+CEKSLOT1+KICK1
// (1) API1+CEKSLOT1
// (2) API1+KICK1

const axios = require('axios');
require('dotenv').config();
const { getSlotInfoAPI1Only } = require('./cekslot1.js');

// API1 Configuration (KHUSUS)
const API_PRIMARY_BASE = process.env.API1;
const API_PRIMARY_KICK_ENDPOINT = process.env.KICK1;
const API_PRIMARY_TOKEN = process.env.APIKEY1;

// Storage untuk kick states
const kickStates = new Map();

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

// COMBO Function: API1+CEKSLOT1+KICK1 (TANPA FALLBACK)
const kickMemberAPI1Only = async (nomorPengelola, nomorTarget) => {
  try {
    // STEP 1: API1+CEKSLOT1 - Ambil data slot & family_member_id
    console.log('🚀 STEP 1: API1+CEKSLOT1 - Mengambil data slot...');
    const slotResult = await getSlotInfoAPI1Only(nomorPengelola);
    
    if (!slotResult.success) {
      return {
        success: false,
        error: `Gagal mengambil data slot: ${slotResult.error}`,
        combo: 'API1+CEKSLOT1+KICK1',
        step: 1,
        source: '🟢 KHFY API1'
      };
    }

    // Cari member yang akan dikick berdasarkan nomor
    const formattedTarget = formatNomorToInternational(nomorTarget);
    const targetMember = slotResult.slots.find(slot => {
      const slotNomor = formatNomorToInternational(slot.nomor || '');
      return slotNomor === formattedTarget;
    });

    if (!targetMember) {
      return {
        success: false,
        error: `Nomor ${formattedTarget} tidak ditemukan dalam keluarga`,
        combo: 'API1+CEKSLOT1+KICK1',
        step: 1,
        source: '🟢 KHFY API1',
        slotInfo: slotResult.slots,
        availableMembers: slotResult.slots.map(s => s.nomor).filter(Boolean)
      };
    }

    if (!targetMember.family_member_id) {
      return {
        success: false,
        error: 'family_member_id tidak ditemukan untuk anggota target',
        combo: 'API1+CEKSLOT1+KICK1',
        step: 1,
        source: '🟢 KHFY API1',
        targetMember,
        slotInfo: slotResult.slots
      };
    }

    // STEP 2: API1+KICK1 - Kick member dengan family_member_id
    console.log('🚀 STEP 2: API1+KICK1 - Mengeluarkan anggota...');
    const formattedPengelola = formatNomorToInternational(nomorPengelola);
    
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('id_parent', formattedPengelola);
    formData.append('member_id', targetMember.family_member_id);

    console.log('📝 Form Data:', {
      token: API_PRIMARY_TOKEN ? API_PRIMARY_TOKEN.substring(0, 10) + '...' : 'KOSONG',
      id_parent: formattedPengelola,
      member_id: targetMember.family_member_id,
      target_member_info: {
        alias: targetMember.alias || targetMember.nama,
        msisdn: targetMember.msisdn || targetMember.nomor
      }
    });

    const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_KICK_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    console.log('🔍 KICK1 Response:', JSON.stringify(response.data, null, 2));

    if (response.data?.status === 'success' || response.data?.status === true) {
      return {
        success: true,
        message: response.data.message || 'Anggota berhasil dikeluarkan',
        combo: 'API1+CEKSLOT1+KICK1',
        step: 2,
        source: '🟢 KHFY API1',
        slotInfo: slotResult.slots,
        kickedMember: targetMember,
        apiResponse: response.data
      };
    } else {
      return {
        success: false,
        error: response.data?.message || response.data?.description || 'Gagal mengeluarkan anggota',
        combo: 'API1+CEKSLOT1+KICK1',
        step: 2,
        source: '🟢 KHFY API1',
        slotInfo: slotResult.slots,
        kickedMember: targetMember,
        apiResponse: response.data
      };
    }
  } catch (error) {
    console.log('❌ KICK1 Error:', error.message);
    return {
      success: false,
      error: error.message,
      combo: 'API1+CEKSLOT1+KICK1',
      step: error.message.includes('STEP 1') ? 1 : 2,
      source: '🟢 KHFY API1'
    };
  }
};

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, message, id, from } = query;
    const chatId = message?.chat?.id;
    const userId = from.id;
    
    if (!chatId) return;

    if (data === 'kick1') {
      kickStates.set(chatId, { step: 'input_pengelola' });
      
      const inputMsg = await bot.sendMessage(chatId,
        `👠 <b>KELUARKAN ANGGOTA - API1 KHUSUS</b>\n\n` +
        `📞 <b>MASUKKAN NOMOR PENGELOLA</b>\n\n` +
        `Ketik nomor HP pengelola yang akan mengeluarkan anggota:\n\n` +
        `💡 <b>Contoh:</b> <code>081234567890</code>\n\n` +
        `🚀 <b>Strategi COMBO API1:</b>\n` +
        `• Step 1: API1+CEKSLOT1 (ambil data + family_member_id)\n` +
        `• Step 2: API1+KICK1 (keluarkan anggota)\n` +
        `• Tanpa fallback - presisi tinggi\n\n` +
        `💡 Ketik "keluar" untuk membatalkan`,
        { parse_mode: 'HTML' }
      );
      
      kickStates.set(chatId, { step: 'input_pengelola', inputMessageId: inputMsg.message_id });
      await bot.answerCallbackQuery(id);
      return;
    }

    // Handle member selection untuk kick
    if (data.startsWith('kick_member_')) {
      const state = kickStates.get(chatId);
      if (!state || !state.slotData) {
        await bot.answerCallbackQuery(id, { text: '❌ Session expired, silakan mulai ulang!' });
        return;
      }

      const memberIndex = parseInt(data.replace('kick_member_', ''));
      const selectedMember = state.slotData.slots[memberIndex];

      if (!selectedMember) {
        await bot.answerCallbackQuery(id, { text: '❌ Member tidak ditemukan!' });
        return;
      }

      // Konfirmasi sebelum kick
      const confirmMsg = await bot.editMessageText(
        `⚠️ <b>KONFIRMASI KELUARKAN ANGGOTA</b>\n\n` +
        `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
        `❌ <b>Anggota yang akan dikeluarkan:</b>\n` +
        `├ 👤 Nama: ${selectedMember.alias}\n` +
        `├ 📞 Nomor: ${selectedMember.msisdn}\n` +
        `├ 📊 Kuota: ${selectedMember.quota_allocated_gb || '0.00'} GB\n` +
        `└ 🔑 ID: ${selectedMember.family_member_id}\n\n` +
        `⚠️ <b>PERINGATAN:</b> Tindakan ini tidak dapat dibatalkan!\n` +
        `Anggota akan kehilangan akses ke kuota keluarga.`,
        {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ YA, KELUARKAN', callback_data: `confirm_kick_${memberIndex}` },
                { text: '❌ BATAL', callback_data: 'cancel_kick' }
              ]
            ]
          }
        }
      );

      kickStates.set(chatId, {
        ...state,
        step: 'confirm_kick',
        selectedMember: selectedMember,
        memberIndex: memberIndex,
        confirmMessageId: confirmMsg.message_id
      });

      await bot.answerCallbackQuery(id);
      return;
    }

    // Handle konfirmasi kick
    if (data.startsWith('confirm_kick_')) {
      const state = kickStates.get(chatId);
      if (!state || state.step !== 'confirm_kick') {
        await bot.answerCallbackQuery(id, { text: '❌ Session expired!' });
        return;
      }

      const memberIndex = parseInt(data.replace('confirm_kick_', ''));
      const selectedMember = state.selectedMember;

      // Proses kick
      const processingMsg = await bot.editMessageText(
        `⚡ <b>MEMPROSES COMBO API1...</b>\n\n` +
        `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
        `❌ <b>Target Keluar:</b> ${selectedMember.alias} (${selectedMember.msisdn})\n\n` +
        `🔄 <b>Step 1:</b> ✅ Data member sudah didapat\n` +
        `⏳ <b>Step 2:</b> Mengeluarkan anggota dengan API1+KICK1...\n\n` +
        `🚀 <b>COMBO:</b> API1+CEKSLOT1+KICK1\n` +
        `⚠️ <b>PROSES IRREVERSIBLE</b>`,
        {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: 'HTML'
        }
      );

      try {
        // Direct kick dengan data yang sudah ada
        const formattedPengelola = formatNomorToInternational(state.pengelola);
        
        const formData = new URLSearchParams();
        formData.append('token', API_PRIMARY_TOKEN);
        formData.append('id_parent', formattedPengelola);
        formData.append('member_id', selectedMember.family_member_id);

        console.log('🚀 STEP 2: API1+KICK1 - Mengeluarkan anggota...');
        console.log('📝 Form Data:', {
          token: API_PRIMARY_TOKEN ? API_PRIMARY_TOKEN.substring(0, 10) + '...' : 'KOSONG',
          id_parent: formattedPengelola,
          member_id: selectedMember.family_member_id,
          target_member_info: {
            alias: selectedMember.alias,
            msisdn: selectedMember.msisdn
          }
        });

        const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_KICK_ENDPOINT, formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 30000
        });

        console.log('🔍 KICK1 Response:', JSON.stringify(response.data, null, 2));

        let responseText = `👠 <b>HASIL KELUARKAN ANGGOTA - API1+CEKSLOT1+KICK1</b>\n\n`;
        responseText += `📞 <b>Pengelola:</b> ${state.pengelola}\n`;
        responseText += `❌ <b>Target Keluar:</b> ${selectedMember.alias} (${selectedMember.msisdn})\n`;
        responseText += `📡 <b>Sumber API:</b> 🟢 KHFY API1\n\n`;
        
        if (response.data?.status === 'success' || response.data?.status === true) {
          responseText += `✅ <b>BERHASIL MENGELUARKAN ANGGOTA!</b>\n\n`;
          responseText += `🎉 <b>Pesan:</b> ${response.data.message || 'Anggota berhasil dikeluarkan'}\n\n`;
          
          responseText += `👤 <b>Detail Anggota yang Dikeluarkan:</b>\n`;
          responseText += `├ 📞 Nomor: ${selectedMember.msisdn}\n`;
          responseText += `├ 👤 Nama: ${selectedMember.alias}\n`;
          responseText += `├ 📊 Kuota Sebelumnya: ${selectedMember.quota_allocated_gb || '0.00'} GB\n`;
          responseText += `└ 🔑 Family Member ID: ${selectedMember.family_member_id}\n\n`;
          
          responseText += `📊 <b>Sisa Anggota Keluarga:</b> ${state.slotData.slots.length - 1} orang\n\n`;
        } else {
          responseText += `❌ <b>GAGAL MENGELUARKAN ANGGOTA</b>\n\n`;
          responseText += `🔍 <b>Error:</b> ${response.data?.message || response.data?.description || 'Gagal mengeluarkan anggota'}\n\n`;
          
          responseText += `💡 <b>Solusi:</b>\n`;
          responseText += `• Pastikan nomor pengelola benar\n`;
          responseText += `• Pastikan anggota masih dalam keluarga\n`;
          responseText += `• Coba lagi dalam beberapa saat\n\n`;
        }
        
        responseText += `⚡ <b>COMBO API1:</b> API1+CEKSLOT1+KICK1\n`;
        responseText += `🎯 <b>API Digunakan:</b> 🟢 KHFY API1\n`;
        responseText += `🔥 <b>Keunggulan:</b> Auto-find family_member_id, presisi tinggi`;
        
        await bot.editMessageText(responseText, {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: 'HTML'
        });

      } catch (error) {
        console.log('❌ KICK1 Error:', error.message);
        
        await bot.editMessageText(
          `❌ <b>ERROR SAAT MENGELUARKAN ANGGOTA</b>\n\n` +
          `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
          `❌ <b>Target:</b> ${selectedMember.alias} (${selectedMember.msisdn})\n\n` +
          `🔍 <b>Error:</b> ${error.message}\n\n` +
          `💡 <b>Solusi:</b> Silakan coba lagi atau hubungi admin`,
          {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML'
          }
        );
      }

      kickStates.delete(chatId);
      await bot.answerCallbackQuery(id);
      return;
    }

    // Handle cancel kick
    if (data === 'cancel_kick') {
      await bot.editMessageText(
        `❌ <b>PROSES KELUARKAN ANGGOTA DIBATALKAN</b>\n\n` +
        `Tidak ada anggota yang dikeluarkan.`,
        {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: 'HTML'
        }
      );
      
      kickStates.delete(chatId);
      await bot.answerCallbackQuery(id, { text: '❌ Dibatalkan' });
      return;
    }
  });

  // Handle text input
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    
    if (!text || text.startsWith('/')) return;
    
    const state = kickStates.get(chatId);
    if (!state) return;
    
    try {
      if (['keluar', 'KELUAR', 'exit', 'EXIT', 'Exit'].includes(text)) {
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        kickStates.delete(chatId);
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      if (state.step === 'input_pengelola') {
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

        // Hapus messages dan update state
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}

        // Process STEP 1: API1+CEKSLOT1 untuk mendapatkan daftar member
        const processingMsg = await bot.sendMessage(chatId,
          `⚡ <b>MEMPROSES STEP 1: API1+CEKSLOT1...</b>\n\n` +
          `📞 <b>Pengelola:</b> ${cleanNumber}\n\n` +
          `🔄 <b>Status:</b> Mengambil data anggota keluarga...\n` +
          `📡 <b>COMBO:</b> API1+CEKSLOT1+KICK1`,
          { parse_mode: 'HTML' }
        );

        try {
          // Hit cekslot1 untuk mendapatkan daftar member
          const slotResult = await getSlotInfoAPI1Only(cleanNumber);
          
          if (!slotResult.success) {
            await bot.editMessageText(
              `❌ <b>GAGAL MENGAMBIL DATA ANGGOTA</b>\n\n` +
              `📞 <b>Pengelola:</b> ${cleanNumber}\n\n` +
              `🔍 <b>Error:</b> ${slotResult.error}\n\n` +
              `💡 <b>Solusi:</b>\n` +
              `• Pastikan nomor pengelola benar\n` +
              `• Pastikan nomor sudah login di API1\n` +
              `• Coba lagi dalam beberapa saat`,
              {
                chat_id: chatId,
                message_id: processingMsg.message_id,
                parse_mode: 'HTML'
              }
            );
            kickStates.delete(chatId);
            return;
          }

          if (!slotResult.slots || slotResult.slots.length === 0) {
            await bot.editMessageText(
              `❌ <b>TIDAK ADA ANGGOTA DITEMUKAN</b>\n\n` +
              `📞 <b>Pengelola:</b> ${cleanNumber}\n\n` +
              `🔍 <b>Kemungkinan:</b>\n` +
              `• Belum ada anggota dalam keluarga\n` +
              `• Semua slot kosong\n` +
              `• Nomor belum login di sistem`,
              {
                chat_id: chatId,
                message_id: processingMsg.message_id,
                parse_mode: 'HTML'
              }
            );
            kickStates.delete(chatId);
            return;
          }

          // Filter hanya anggota (child), tidak termasuk pengelola
          const availableMembers = slotResult.slots.filter(slot => 
            slot.family_member_id && 
            slot.msisdn && 
            slot.msisdn !== cleanNumber &&
            formatNomorToInternational(slot.msisdn) !== formatNomorToInternational(cleanNumber)
          );

          if (availableMembers.length === 0) {
            await bot.editMessageText(
              `❌ <b>TIDAK ADA ANGGOTA YANG BISA DIKELUARKAN</b>\n\n` +
              `📞 <b>Pengelola:</b> ${cleanNumber}\n\n` +
              `📊 <b>Total Slot:</b> ${slotResult.slots.length}\n\n` +
              `🔍 <b>Kemungkinan:</b>\n` +
              `• Hanya ada pengelola dalam keluarga\n` +
              `• Semua slot anggota kosong\n` +
              `• Data family_member_id tidak lengkap`,
              {
                chat_id: chatId,
                message_id: processingMsg.message_id,
                parse_mode: 'HTML'
              }
            );
            kickStates.delete(chatId);
            return;
          }

          // Buat inline keyboard untuk pilih anggota yang akan di-kick
          const keyboard = [];
          availableMembers.forEach((slot, index) => {
            const quotaAllocated = slot.quota_allocated_gb || '0.00';
            const quotaUsed = slot.quota_used_gb || '0.00';
            
            // Create keyboard button dengan format: msisdn : quota_allocated_gb : alias  
            const buttonText = `${slot.msisdn} : ${quotaAllocated}GB : ${slot.alias}`;
            keyboard.push([{ text: buttonText, callback_data: `kick_member_${index}` }]);
          });

          // Tambah tombol batal
          keyboard.push([{ text: '❌ BATAL', callback_data: 'cancel_kick' }]);

          await bot.editMessageText(
            `👠 <b>PILIH ANGGOTA YANG AKAN DIKELUARKAN</b>\n\n` +
            `📞 <b>Pengelola:</b> ${cleanNumber}\n` +
            `📊 <b>Total Anggota:</b> ${availableMembers.length} orang\n\n` +
            `👤 <b>Pilih anggota yang akan dikeluarkan:</b>\n\n` +
            `💡 <b>Format:</b> Nomor : Kuota : Nama\n` +
            `⚠️ <b>PERINGATAN:</b> Tindakan ini tidak dapat dibatalkan!`,
            {
              chat_id: chatId,
              message_id: processingMsg.message_id,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: keyboard
              }
            }
          );

          // Update state dengan data slot
          kickStates.set(chatId, {
            step: 'select_member',
            pengelola: cleanNumber,
            slotData: { slots: availableMembers },
            messageId: processingMsg.message_id
          });

        } catch (error) {
          console.log('❌ CEKSLOT1 Error:', error.message);
          
          await bot.editMessageText(
            `❌ <b>ERROR SAAT MENGAMBIL DATA</b>\n\n` +
            `📞 <b>Pengelola:</b> ${cleanNumber}\n\n` +
            `🔍 <b>Error:</b> ${error.message}\n\n` +
            `💡 <b>Solusi:</b> Silakan coba lagi atau hubungi admin`,
            {
              chat_id: chatId,
              message_id: processingMsg.message_id,
              parse_mode: 'HTML'
            }
          );
          kickStates.delete(chatId);
        }
        return;
      }
      
    } catch (error) {
      await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      kickStates.delete(chatId);
    }
  });
};

// Export functions untuk penggunaan internal  
module.exports.kickMemberAPI1Only = kickMemberAPI1Only;