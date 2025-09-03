// ini hanya tools untuk api1
// tidak ada fallback ke api lain
// khusus api1
// tipe kombo: API1+CEKSLOT1+EDITKUBER1
// (1) API1+CEKSLOT1
// (2) API1+EDITKUBER1

const axios = require('axios');
require('dotenv').config();
const { getSlotInfoAPI1Only } = require('./cekslot1.js');

// API1 Configuration (KHUSUS)
const API_PRIMARY_BASE = process.env.API1;
const API_PRIMARY_EDITKUBER_ENDPOINT = process.env.EDITKUBER1;
const API_PRIMARY_TOKEN = process.env.APIKEY1;

// Storage untuk editkuber states
const editkuberStates = new Map();

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

// COMBO Function: API1+CEKSLOT1+EDITKUBER1 (TANPA FALLBACK)
const editKuberAPI1Only = async (nomorPengelola, nomorTarget, kuberBaru) => {
  try {
    // STEP 1: API1+CEKSLOT1 - Ambil data slot & member info
    console.log('🚀 STEP 1: API1+CEKSLOT1 - Mengambil data slot...');
    const slotResult = await getSlotInfoAPI1Only(nomorPengelola);
    
    if (!slotResult.success) {
      return {
        success: false,
        error: `Gagal mengambil data slot: ${slotResult.error}`,
        combo: 'API1+CEKSLOT1+EDITKUBER1',
        step: 1,
        source: '🟢 KHFY API1'
      };
    }

    // Cari member yang akan diedit berdasarkan nomor
    const formattedTarget = formatNomorToInternational(nomorTarget);
    const targetMember = slotResult.slots.find(slot => {
      const slotNomor = formatNomorToInternational(slot.nomor || '');
      return slotNomor === formattedTarget;
    });

    if (!targetMember) {
      return {
        success: false,
        error: `Nomor ${formattedTarget} tidak ditemukan dalam keluarga`,
        combo: 'API1+CEKSLOT1+EDITKUBER1',
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
        combo: 'API1+CEKSLOT1+EDITKUBER1',
        step: 1,
        source: '🟢 KHFY API1',
        targetMember,
        slotInfo: slotResult.slots
      };
    }

    // STEP 2: API1+EDITKUBER1 - Edit kuber dengan data dari step 1
    console.log('🚀 STEP 2: API1+EDITKUBER1 - Mengedit kuber...');
    const formattedPengelola = formatNomorToInternational(nomorPengelola);
    
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('id_parent', formattedPengelola);
    formData.append('id_member', targetMember.family_member_id);
    formData.append('kuber_gb', kuberBaru.toString());

    const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_EDITKUBER_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    if (response.data?.status === 'success') {
      return {
        success: true,
        message: response.data.message || 'Kuber berhasil diubah',
        combo: 'API1+CEKSLOT1+EDITKUBER1',
        step: 2,
        source: '🟢 KHFY API1',
        slotInfo: slotResult.slots,
        editedMember: targetMember,
        newKuber: kuberBaru,
        oldKuber: targetMember.kuber || 'tidak diketahui'
      };
    } else {
      return {
        success: false,
        error: response.data?.message || 'Gagal mengubah kuber',
        combo: 'API1+CEKSLOT1+EDITKUBER1',
        step: 2,
        source: '🟢 KHFY API1',
        slotInfo: slotResult.slots,
        editedMember: targetMember,
        newKuber: kuberBaru
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      combo: 'API1+CEKSLOT1+EDITKUBER1',
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

    if (data === 'editkuber1') {
      editkuberStates.set(chatId, { step: 'input_pengelola' });
      
      const inputMsg = await bot.sendMessage(chatId,
        `⚙️ <b>EDIT KUBER - API1 KHUSUS</b>\n\n` +
        `📞 <b>MASUKKAN NOMOR PENGELOLA</b>\n\n` +
        `Ketik nomor HP pengelola yang akan mengedit kuber:\n\n` +
        `💡 <b>Contoh:</b> <code>081234567890</code>\n\n` +
        `🚀 <b>Strategi COMBO API1:</b>\n` +
        `• Step 1: API1+CEKSLOT1 (ambil data + family_member_id)\n` +
        `• Step 2: API1+EDITKUBER1 (ubah kuber anggota)\n` +
        `• Tanpa fallback - presisi tinggi\n\n` +
        `💡 Ketik "keluar" untuk membatalkan`,
        { parse_mode: 'HTML' }
      );
      
      editkuberStates.set(chatId, { step: 'input_pengelola', inputMessageId: inputMsg.message_id });
      await bot.answerCallbackQuery(id);
      return;
    }
  });

  // Handle text input
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    
    if (!text || text.startsWith('/')) return;
    
    const state = editkuberStates.get(chatId);
    if (!state) return;
    
    try {
      if (['keluar', 'KELUAR', 'exit', 'EXIT', 'Exit'].includes(text)) {
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        editkuberStates.delete(chatId);
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
          `⚙️ <b>EDIT KUBER - LANGKAH 2</b>\n\n` +
          `📞 <b>Pengelola:</b> ${cleanNumber}\n\n` +
          `👤 <b>MASUKKAN NOMOR ANGGOTA YANG AKAN DIEDIT</b>\n\n` +
          `Ketik nomor HP anggota yang kubernya akan diubah:\n\n` +
          `💡 <b>Contoh:</b> <code>089876543210</code>\n\n` +
          `💡 Ketik "keluar" untuk membatalkan`,
          { parse_mode: 'HTML' }
        );

        editkuberStates.set(chatId, { 
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

        // Hapus messages dan update state
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}

        const inputMsg3 = await bot.sendMessage(chatId,
          `⚙️ <b>EDIT KUBER - LANGKAH 3</b>\n\n` +
          `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
          `👤 <b>Anggota Target:</b> ${cleanNumber}\n\n` +
          `📊 <b>MASUKKAN KUBER BARU (GB)</b>\n\n` +
          `Ketik jumlah kuber baru dalam GB:\n\n` +
          `💡 <b>Contoh:</b> <code>50</code> (untuk 50 GB)\n` +
          `💡 <b>Format:</b> Angka saja (1-999)\n\n` +
          `💡 Ketik "keluar" untuk membatalkan`,
          { parse_mode: 'HTML' }
        );

        editkuberStates.set(chatId, { 
          step: 'input_kuber', 
          pengelola: state.pengelola,
          target: cleanNumber,
          inputMessageId: inputMsg3.message_id 
        });
        return;
      }

      if (state.step === 'input_kuber') {
        const kuberInput = text.replace(/\D/g, '');
        const kuberNumber = parseInt(kuberInput);
        
        if (!kuberInput || kuberNumber < 1 || kuberNumber > 999) {
          await bot.sendMessage(chatId,
            `❌ <b>Kuber tidak valid!</b>\n\n` +
            `Kuber harus berupa angka 1-999 GB.\n` +
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
        
        // Process COMBO API1+CEKSLOT1+EDITKUBER1
        const processingMsg = await bot.sendMessage(chatId,
          `⚡ <b>MEMPROSES COMBO API1...</b>\n\n` +
          `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
          `👤 <b>Anggota Target:</b> ${state.target}\n` +
          `📊 <b>Kuber Baru:</b> ${kuberNumber} GB\n\n` +
          `🔄 <b>Step 1:</b> Mencari anggota dengan API1+CEKSLOT1...\n` +
          `⏳ <b>Step 2:</b> Menunggu hasil step 1...\n\n` +
          `🚀 <b>COMBO:</b> API1+CEKSLOT1+EDITKUBER1`,
          { parse_mode: 'HTML' }
        );
        
        const result = await editKuberAPI1Only(state.pengelola, state.target, kuberNumber);
        
        let responseText = `⚙️ <b>HASIL EDIT KUBER - ${result.combo}</b>\n\n`;
        responseText += `📞 <b>Pengelola:</b> ${state.pengelola}\n`;
        responseText += `👤 <b>Anggota Target:</b> ${state.target}\n`;
        responseText += `📊 <b>Kuber Baru:</b> ${kuberNumber} GB\n`;
        responseText += `📡 <b>Sumber API:</b> ${result.source}\n\n`;
        
        if (result.success) {
          responseText += `✅ <b>BERHASIL MENGUBAH KUBER!</b>\n\n`;
          responseText += `🎉 <b>Pesan:</b> ${result.message}\n\n`;
          
          if (result.editedMember) {
            responseText += `👤 <b>Detail Anggota:</b>\n`;
            responseText += `├ 📞 Nomor: ${result.editedMember.nomor}\n`;
            responseText += `├ 👤 Nama: ${result.editedMember.nama || '-'}\n`;
            responseText += `├ 🔑 Family Member ID: ${result.editedMember.family_member_id}\n`;
            responseText += `├ 📊 Kuber Lama: ${result.oldKuber} GB\n`;
            responseText += `└ 📊 Kuber Baru: ${result.newKuber} GB\n\n`;
          }
          
          if (result.slotInfo && result.slotInfo.length > 0) {
            responseText += `📊 <b>Total Anggota Keluarga:</b> ${result.slotInfo.length} orang\n\n`;
          }
        } else {
          responseText += `❌ <b>GAGAL MENGUBAH KUBER</b>\n\n`;
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
          responseText += `• Pastikan kuber dalam range yang valid\n`;
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
        
        editkuberStates.delete(chatId);
      }
      
    } catch (error) {
      await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      editkuberStates.delete(chatId);
    }
  });
};

// Export functions untuk penggunaan internal
module.exports.editKuberAPI1Only = editKuberAPI1Only;