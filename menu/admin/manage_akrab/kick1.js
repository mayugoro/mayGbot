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
    formData.append('id_member', targetMember.family_member_id);

    const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_KICK_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    if (response.data?.status === 'success') {
      return {
        success: true,
        message: response.data.message || 'Anggota berhasil dikeluarkan',
        combo: 'API1+CEKSLOT1+KICK1',
        step: 2,
        source: '🟢 KHFY API1',
        slotInfo: slotResult.slots,
        kickedMember: targetMember
      };
    } else {
      return {
        success: false,
        error: response.data?.message || 'Gagal mengeluarkan anggota',
        combo: 'API1+CEKSLOT1+KICK1',
        step: 2,
        source: '🟢 KHFY API1',
        slotInfo: slotResult.slots,
        kickedMember: targetMember
      };
    }
  } catch (error) {
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

        const inputMsg2 = await bot.sendMessage(chatId,
          `👠 <b>KELUARKAN ANGGOTA - LANGKAH 2</b>\n\n` +
          `📞 <b>Pengelola:</b> ${cleanNumber}\n\n` +
          `❌ <b>MASUKKAN NOMOR ANGGOTA YANG AKAN DIKELUARKAN</b>\n\n` +
          `Ketik nomor HP anggota yang akan dikeluarkan:\n\n` +
          `💡 <b>Contoh:</b> <code>089876543210</code>\n\n` +
          `⚠️ <b>PERINGATAN:</b> Anggota akan dikeluarkan dari keluarga!\n\n` +
          `💡 Ketik "keluar" untuk membatalkan`,
          { parse_mode: 'HTML' }
        );

        kickStates.set(chatId, { 
          step: 'input_target', 
          pengelola: cleanNumber,
          inputMessageId: inputMsg2.message_id 
        });
        return;
      }

      if (state.step === 'input_target') {
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
        
        // Process COMBO API1+CEKSLOT1+KICK1
        const processingMsg = await bot.sendMessage(chatId,
          `⚡ <b>MEMPROSES COMBO API1...</b>\n\n` +
          `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
          `❌ <b>Target Keluar:</b> ${cleanNumber}\n\n` +
          `🔄 <b>Step 1:</b> Mencari anggota dengan API1+CEKSLOT1...\n` +
          `⏳ <b>Step 2:</b> Menunggu hasil step 1...\n\n` +
          `🚀 <b>COMBO:</b> API1+CEKSLOT1+KICK1\n` +
          `⚠️ <b>PROSES IRREVERSIBLE</b>`,
          { parse_mode: 'HTML' }
        );
        
        const result = await kickMemberAPI1Only(state.pengelola, cleanNumber);
        
        let responseText = `👠 <b>HASIL KELUARKAN ANGGOTA - ${result.combo}</b>\n\n`;
        responseText += `📞 <b>Pengelola:</b> ${state.pengelola}\n`;
        responseText += `❌ <b>Target Keluar:</b> ${cleanNumber}\n`;
        responseText += `📡 <b>Sumber API:</b> ${result.source}\n\n`;
        
        if (result.success) {
          responseText += `✅ <b>BERHASIL MENGELUARKAN ANGGOTA!</b>\n\n`;
          responseText += `🎉 <b>Pesan:</b> ${result.message}\n\n`;
          
          if (result.kickedMember) {
            responseText += `👤 <b>Detail Anggota yang Dikeluarkan:</b>\n`;
            responseText += `├ 📞 Nomor: ${result.kickedMember.nomor}\n`;
            responseText += `├ 👤 Nama: ${result.kickedMember.nama || '-'}\n`;
            responseText += `├ 🔑 Family Member ID: ${result.kickedMember.family_member_id}\n`;
            responseText += `└ 📊 Status Sebelumnya: ${result.kickedMember.status || '-'}\n\n`;
          }
          
          if (result.slotInfo && result.slotInfo.length > 0) {
            responseText += `📊 <b>Sisa Anggota Keluarga:</b> ${result.slotInfo.length - 1} orang\n\n`;
          }
        } else {
          responseText += `❌ <b>GAGAL MENGELUARKAN ANGGOTA</b>\n\n`;
          responseText += `🔍 <b>Error di Step ${result.step}:</b> ${result.error}\n\n`;
          
          if (result.availableMembers && result.availableMembers.length > 0) {
            responseText += `👥 <b>Anggota yang Tersedia:</b>\n`;
            result.availableMembers.forEach((nomor, index) => {
              responseText += `├ ${index + 1}. ${nomor}\n`;
            });
            responseText += `\n`;
          }
          
          if (result.slotInfo && result.slotInfo.length > 0) {
            responseText += `📊 <b>Total Anggota Keluarga:</b> ${result.slotInfo.length} orang\n\n`;
          }
          
          responseText += `💡 <b>Solusi:</b>\n`;
          responseText += `• Pastikan nomor pengelola benar\n`;
          responseText += `• Pastikan nomor target ada dalam keluarga\n`;
          responseText += `• Coba cek slot terlebih dahulu\n`;
        }
        
        responseText += `⚡ <b>COMBO API1:</b> ${result.combo}\n`;
        responseText += `🎯 <b>API Digunakan:</b> ${result.source}\n`;
        responseText += `🔥 <b>Keunggulan:</b> Auto-find family_member_id, presisi tinggi`;
        
        try {
          await bot.editMessageText(responseText, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'HTML'
          });
        } catch (e) {
          await bot.sendMessage(chatId, responseText, { parse_mode: 'HTML' });
        }
        
        kickStates.delete(chatId);
      }
      
    } catch (error) {
      await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      kickStates.delete(chatId);
    }
  });
};

// Export functions untuk penggunaan internal
module.exports.kickMemberAPI1Only = kickMemberAPI1Only;