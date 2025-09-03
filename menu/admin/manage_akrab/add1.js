// ini hanya tools untuk api1
// tidak ada fallback ke api lain
// khusus api1
// tipe kombo: API1+CEKSLOT1+ADD1
// (1) API1+CEKSLOT1
// (2) API1+ADD1

const axios = require('axios');
require('dotenv').config();
const { getSlotInfoAPI1Only } = require('./cekslot1.js');

// API1 Configuration (KHUSUS)
const API_PRIMARY_BASE = process.env.API1;
const API_PRIMARY_ADD_ENDPOINT = process.env.ADD1;
const API_PRIMARY_TOKEN = process.env.APIKEY1;

// Storage untuk add states
const addStates = new Map();

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

// COMBO Function: API1+CEKSLOT1+ADD1 (TANPA FALLBACK)
const addMemberAPI1Only = async (nomorPengelola, nomorBaru, namaBaru) => {
  try {
    // STEP 1: API1+CEKSLOT1 - Ambil data slot
    console.log('🚀 STEP 1: API1+CEKSLOT1 - Mengambil data slot...');
    const slotResult = await getSlotInfoAPI1Only(nomorPengelola);
    
    if (!slotResult.success) {
      return {
        success: false,
        error: `Gagal mengambil data slot: ${slotResult.error}`,
        combo: 'API1+CEKSLOT1+ADD1',
        step: 1,
        source: '🟢 KHFY API1'
      };
    }

    // Check sisa add dari slot pertama
    const firstSlot = slotResult.slots[0];
    const sisaAdd = firstSlot ? (firstSlot['sisa-add'] || 0) : 0;
    
    if (sisaAdd <= 0) {
      return {
        success: false,
        error: 'Kuota tambah anggota sudah habis (sisa-add: 0)',
        combo: 'API1+CEKSLOT1+ADD1',
        step: 1,
        source: '🟢 KHFY API1',
        slotInfo: slotResult.slots
      };
    }

    // STEP 2: API1+ADD1 - Tambah anggota dengan data dari step 1
    console.log('🚀 STEP 2: API1+ADD1 - Menambah anggota...');
    const formattedPengelola = formatNomorToInternational(nomorPengelola);
    const formattedBaru = formatNomorToInternational(nomorBaru);
    
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('id_parent', formattedPengelola);
    formData.append('hp_member', formattedBaru);
    formData.append('name_member', namaBaru);

    const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_ADD_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    if (response.data?.status === 'success') {
      return {
        success: true,
        message: response.data.message || 'Anggota berhasil ditambahkan',
        combo: 'API1+CEKSLOT1+ADD1',
        step: 2,
        source: '🟢 KHFY API1',
        slotInfo: slotResult.slots,
        addedMember: {
          nomor: formattedBaru,
          nama: namaBaru
        }
      };
    } else {
      return {
        success: false,
        error: response.data?.message || 'Gagal menambah anggota',
        combo: 'API1+CEKSLOT1+ADD1',
        step: 2,
        source: '🟢 KHFY API1',
        slotInfo: slotResult.slots
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      combo: 'API1+CEKSLOT1+ADD1',
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

    if (data === 'add1') {
      addStates.set(chatId, { step: 'input_pengelola' });
      
      const inputMsg = await bot.sendMessage(chatId,
        `➕ <b>TAMBAH ANGGOTA - API1 KHUSUS</b>\n\n` +
        `📞 <b>MASUKKAN NOMOR PENGELOLA</b>\n\n` +
        `Ketik nomor HP pengelola yang akan menambah anggota:\n\n` +
        `💡 <b>Contoh:</b> <code>081234567890</code>\n\n` +
        `🚀 <b>Strategi COMBO API1:</b>\n` +
        `• Step 1: API1+CEKSLOT1 (ambil data slot)\n` +
        `• Step 2: API1+ADD1 (tambah anggota)\n` +
        `• Tanpa fallback - presisi tinggi\n\n` +
        `💡 Ketik "keluar" untuk membatalkan`,
        { parse_mode: 'HTML' }
      );
      
      addStates.set(chatId, { step: 'input_pengelola', inputMessageId: inputMsg.message_id });
      await bot.answerCallbackQuery(id);
      return;
    }
  });

  // Handle text input
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    
    if (!text || text.startsWith('/')) return;
    
    const state = addStates.get(chatId);
    if (!state) return;
    
    try {
      if (['keluar', 'KELUAR', 'exit', 'EXIT', 'Exit'].includes(text)) {
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        addStates.delete(chatId);
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
          `➕ <b>TAMBAH ANGGOTA - LANGKAH 2</b>\n\n` +
          `📞 <b>Pengelola:</b> ${cleanNumber}\n\n` +
          `👤 <b>MASUKKAN NOMOR ANGGOTA BARU</b>\n\n` +
          `Ketik nomor HP yang akan ditambahkan:\n\n` +
          `💡 <b>Contoh:</b> <code>089876543210</code>\n\n` +
          `💡 Ketik "keluar" untuk membatalkan`,
          { parse_mode: 'HTML' }
        );

        addStates.set(chatId, { 
          step: 'input_anggota', 
          pengelola: cleanNumber,
          inputMessageId: inputMsg2.message_id 
        });
        return;
      }

      if (state.step === 'input_anggota') {
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
          `➕ <b>TAMBAH ANGGOTA - LANGKAH 3</b>\n\n` +
          `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
          `👤 <b>Anggota Baru:</b> ${cleanNumber}\n\n` +
          `📝 <b>MASUKKAN NAMA ANGGOTA</b>\n\n` +
          `Ketik nama untuk anggota baru:\n\n` +
          `💡 <b>Contoh:</b> <code>Ahmad Budi</code>\n\n` +
          `💡 Ketik "keluar" untuk membatalkan`,
          { parse_mode: 'HTML' }
        );

        addStates.set(chatId, { 
          step: 'input_nama', 
          pengelola: state.pengelola,
          anggota: cleanNumber,
          inputMessageId: inputMsg3.message_id 
        });
        return;
      }

      if (state.step === 'input_nama') {
        const namaAnggota = text;
        
        if (namaAnggota.length < 2 || namaAnggota.length > 50) {
          await bot.sendMessage(chatId,
            `❌ <b>Nama tidak valid!</b>\n\n` +
            `Nama harus 2-50 karakter.\n` +
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
        
        // Process COMBO API1+CEKSLOT1+ADD1
        const processingMsg = await bot.sendMessage(chatId,
          `⚡ <b>MEMPROSES COMBO API1...</b>\n\n` +
          `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
          `👤 <b>Anggota Baru:</b> ${state.anggota}\n` +
          `📝 <b>Nama:</b> ${namaAnggota}\n\n` +
          `🔄 <b>Step 1:</b> Mengecek slot dengan API1+CEKSLOT1...\n` +
          `⏳ <b>Step 2:</b> Menunggu hasil step 1...\n\n` +
          `🚀 <b>COMBO:</b> API1+CEKSLOT1+ADD1`,
          { parse_mode: 'HTML' }
        );
        
        const result = await addMemberAPI1Only(state.pengelola, state.anggota, namaAnggota);
        
        let responseText = `➕ <b>HASIL TAMBAH ANGGOTA - ${result.combo}</b>\n\n`;
        responseText += `📞 <b>Pengelola:</b> ${state.pengelola}\n`;
        responseText += `👤 <b>Anggota Baru:</b> ${state.anggota}\n`;
        responseText += `📝 <b>Nama:</b> ${namaAnggota}\n`;
        responseText += `📡 <b>Sumber API:</b> ${result.source}\n\n`;
        
        if (result.success) {
          responseText += `✅ <b>BERHASIL MENAMBAH ANGGOTA!</b>\n\n`;
          responseText += `🎉 <b>Pesan:</b> ${result.message}\n\n`;
          
          if (result.slotInfo && result.slotInfo.length > 0) {
            const firstSlot = result.slotInfo[0];
            responseText += `📊 <b>Info Slot Sebelumnya:</b>\n`;
            responseText += `├ ➕ Sisa Tambah: ${firstSlot['sisa-add'] || 0}\n`;
            responseText += `└ 📊 Total Slot: ${result.slotInfo.length}\n\n`;
          }
        } else {
          responseText += `❌ <b>GAGAL MENAMBAH ANGGOTA</b>\n\n`;
          responseText += `🔍 <b>Error di Step ${result.step}:</b> ${result.error}\n\n`;
          
          if (result.slotInfo && result.slotInfo.length > 0) {
            const firstSlot = result.slotInfo[0];
            responseText += `📊 <b>Info Slot:</b>\n`;
            responseText += `├ ➕ Sisa Tambah: ${firstSlot['sisa-add'] || 0}\n`;
            responseText += `└ 📊 Total Slot: ${result.slotInfo.length}\n\n`;
          }
          
          responseText += `💡 <b>Solusi:</b>\n`;
          responseText += `• Pastikan nomor pengelola benar\n`;
          responseText += `• Pastikan masih ada kuota tambah\n`;
          responseText += `• Coba beberapa saat lagi\n`;
        }
        
        responseText += `⚡ <b>COMBO API1:</b> ${result.combo}\n`;
        responseText += `🎯 <b>API Digunakan:</b> ${result.source}\n`;
        responseText += `🔥 <b>Keunggulan:</b> 2-step validation, presisi tinggi`;
        
        try {
          await bot.editMessageText(responseText, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'HTML'
          });
        } catch (e) {
          await bot.sendMessage(chatId, responseText, { parse_mode: 'HTML' });
        }
        
        addStates.delete(chatId);
      }
      
    } catch (error) {
      await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      addStates.delete(chatId);
    }
  });
};

// Export functions untuk penggunaan internal
module.exports.addMemberAPI1Only = addMemberAPI1Only;