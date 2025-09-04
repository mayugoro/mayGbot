// ini hanya tools untuk api1
// tidak ada fallback ke api lain
// khusus api1
// tipe kombo: API1+CEKSLOT1+ADD1
// (1) API1+CEKSLOT1
// (2) API1+ADD1

const axios = require('axios');
require('dotenv').config({ quiet: true });
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
        error: `Tidak bisa menambah anggota. Sisa kesempatan: ${sisaAdd}`,
        combo: 'API1+CEKSLOT1+ADD1',
        step: 1,
        source: '🟢 KHFY API1',
        slotInfo: slotResult.slots
      };
    }

    // STEP 2: API1+ADD1 - Tambah anggota
    console.log('🚀 STEP 2: API1+ADD1 - Menambahkan anggota...');
    const formattedPengelola = formatNomorToInternational(nomorPengelola);
    const formattedAnggota = formatNomorToInternational(nomorBaru);
    
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('id_parent', formattedPengelola);
    formData.append('msisdn', formattedAnggota);
    formData.append('member_id', '');
    formData.append('slot_id', '');
    formData.append('parent_name', 'XL');
    formData.append('child_name', namaBaru);

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
        slotInfo: slotResult.slots
      };
    } else {
      return {
        success: false,
        error: response.data?.message || 'Gagal menambahkan anggota',
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
        `• Step 1: API1+CEKSLOT1 (cek slot kosong)\n` +
        `• Step 2: API1+ADD1 (tambah anggota)\n` +
        `• Tanpa fallback - presisi tinggi\n\n` +
        `💡 Ketik "keluar" untuk membatalkan`,
        { parse_mode: 'HTML' }
      );
      
      addStates.set(chatId, { step: 'input_pengelola', inputMessageId: inputMsg.message_id });
      await bot.answerCallbackQuery(id);
      return;
    }

    // Handle slot selection untuk add member
    if (data.startsWith('add_slot_')) {
      const state = addStates.get(chatId);
      if (!state || !state.allSlots) {
        await bot.answerCallbackQuery(id, { text: '❌ Session expired, silakan mulai ulang!' });
        return;
      }

      const slotIndex = parseInt(data.replace('add_slot_', ''));
      const selectedSlot = state.allSlots[slotIndex];

      if (!selectedSlot) {
        await bot.answerCallbackQuery(id, { text: '❌ Slot tidak ditemukan!' });
        return;
      }

      if (selectedSlot.status !== 'empty') {
        await bot.answerCallbackQuery(id, { text: '❌ Slot sudah terisi!' });
        return;
      }

      // Show form input for new member phone
      const inputMsg = await bot.editMessageText(
        `➕ <b>TAMBAH ANGGOTA - LANGKAH 2</b>\n\n` +
        `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
        `🎯 <b>Slot Dipilih:</b> Slot ${selectedSlot.slot_id || slotIndex + 1}\n\n` +
        `📱 <b>MASUKKAN NOMOR ANGGOTA BARU</b>\n\n` +
        `Ketik nomor HP anggota yang akan ditambahkan:\n\n` +
        `💡 <b>Contoh:</b> <code>089876543210</code>\n\n` +
        `💡 Ketik "keluar" untuk membatalkan`,
        {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: 'HTML'
        }
      );

      addStates.set(chatId, {
        ...state,
        step: 'input_member_phone',
        selectedSlot: selectedSlot,
        slotIndex: slotIndex,
        inputMessageId: inputMsg.message_id
      });

      await bot.answerCallbackQuery(id);
      return;
    }

    // Handle filled slot (bisa diklik tapi menampilkan alert)
    if (data.startsWith('slot_filled_')) {
      const state = addStates.get(chatId);
      if (state && state.allSlots) {
        const slotIndex = parseInt(data.replace('slot_filled_', ''));
        const filledSlot = state.allSlots[slotIndex];
        
        if (filledSlot) {
          await bot.answerCallbackQuery(id, { 
            text: `❌ Sudah ada anggota, tidak dapat menambah anggota ke slot ini.\n\nSlot ${filledSlot.slot_id}: ${filledSlot.msisdn} (${filledSlot.alias})`,
            show_alert: true
          });
        } else {
          await bot.answerCallbackQuery(id, { 
            text: '❌ Sudah ada anggota, tidak dapat menambah anggota ke slot ini.',
            show_alert: true
          });
        }
      } else {
        await bot.answerCallbackQuery(id, { 
          text: '❌ Sudah ada anggota, tidak dapat menambah anggota ke slot ini.',
          show_alert: true
        });
      }
      return;
    }

    // Handle filled slot (fallback untuk callback_data lama)
    if (data === 'slot_filled') {
      await bot.answerCallbackQuery(id, { 
        text: '❌ Sudah ada anggota, tidak dapat menambah anggota ke slot ini.',
        show_alert: true
      });
      return;
    }

    /*
    // Handle add to new slot - TIDAK DIGUNAKAN LAGI
    if (data === 'add_new_slot') {
      const state = addStates.get(chatId);
      if (!state || !state.allSlots) {
        await bot.answerCallbackQuery(id, { text: '❌ Session expired, silakan mulai ulang!' });
        return;
      }

      // Show form input for new member phone
      const nextSlotId = state.allSlots.length + 1;
      const inputMsg = await bot.editMessageText(
        `➕ <b>TAMBAH ANGGOTA - LANGKAH 2</b>\n\n` +
        `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
        `🎯 <b>Slot Baru:</b> Slot ${nextSlotId}\n\n` +
        `📱 <b>MASUKKAN NOMOR ANGGOTA BARU</b>\n\n` +
        `Ketik nomor HP anggota yang akan ditambahkan:\n\n` +
        `💡 <b>Contoh:</b> <code>089876543210</code>\n\n` +
        `💡 Ketik "keluar" untuk membatalkan`,
        {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: 'HTML'
        }
      );

      addStates.set(chatId, {
        ...state,
        step: 'input_member_phone',
        selectedSlot: { slot_id: nextSlotId },
        slotIndex: nextSlotId - 1,
        inputMessageId: inputMsg.message_id
      });

      await bot.answerCallbackQuery(id);
      return;
    }
    */

    // Handle cancel add
    if (data === 'cancel_add') {
      await bot.editMessageText(
        `❌ <b>PROSES TAMBAH ANGGOTA DIBATALKAN</b>\n\n` +
        `Tidak ada anggota yang ditambahkan.`,
        {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: 'HTML'
        }
      );
      
      addStates.delete(chatId);
      await bot.answerCallbackQuery(id, { text: '❌ Dibatalkan' });
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

        // Process STEP 1: API1+CEKSLOT1 untuk mendapatkan data slot
        const processingMsg = await bot.sendMessage(chatId,
          `⚡ <b>MEMPROSES STEP 1: API1+CEKSLOT1...</b>\n\n` +
          `📞 <b>Pengelola:</b> ${cleanNumber}\n\n` +
          `🔄 <b>Status:</b> Mengambil data slot keluarga...\n` +
          `📡 <b>COMBO:</b> API1+CEKSLOT1+ADD1`,
          { parse_mode: 'HTML' }
        );

        try {
          // Hit cekslot1 untuk mendapatkan data slot
          const slotResult = await getSlotInfoAPI1Only(cleanNumber);
          
          if (!slotResult.success) {
            await bot.editMessageText(
              `❌ <b>GAGAL MENGAMBIL DATA SLOT</b>\n\n` +
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
            addStates.delete(chatId);
            return;
          }

          // Create slot list - semua slot dari API response dengan status berdasarkan alias
          const allSlots = [];
          
          // Add semua slot yang ada di response API
          if (slotResult.slots && slotResult.slots.length > 0) {
            slotResult.slots.forEach((slot, index) => {
              // Hanya tambahkan jika ada slot_id yang valid dari API
              if (slot.slot_id && slot.slot_id !== null && slot.slot_id !== undefined) {
                // Tentukan status berdasarkan alias
                const alias = slot.alias || slot.nama || '-';
                const isEmptySlot = alias === '-' || alias === '' || alias === null || alias === undefined;
                
                allSlots.push({
                  slot_id: slot.slot_id,
                  status: isEmptySlot ? 'empty' : 'filled',
                  msisdn: slot.msisdn || slot.nomor || '-',
                  alias: alias,
                  quota_allocated_gb: slot.quota_allocated_gb || '0.00',
                  family_member_id: slot.family_member_id
                });
              }
            });
          }

          // TIDAK MENAMBAHKAN slot kosong buatan - hanya tampilkan yang ada dari API

          // Check add chances
          const firstSlot = slotResult.slots && slotResult.slots[0];
          const sisaAdd = firstSlot ? (firstSlot['sisa-add'] || firstSlot.add_chances || 0) : 0;

          if (sisaAdd <= 0) {
            await bot.editMessageText(
              `❌ <b>TIDAK BISA MENAMBAH ANGGOTA</b>\n\n` +
              `📞 <b>Pengelola:</b> ${cleanNumber}\n\n` +
              `🔍 <b>Alasan:</b> Sisa kesempatan tambah anggota: ${sisaAdd}\n\n` +
              `💡 <b>Solusi:</b>\n` +
              `• Beli kesempatan tambah anggota\n` +
              `• Hubungi operator untuk upgrade paket`,
              {
                chat_id: chatId,
                message_id: processingMsg.message_id,
                parse_mode: 'HTML'
              }
            );
            addStates.delete(chatId);
            return;
          }

          // Check jika tidak ada slot yang tersedia
          if (allSlots.length === 0) {
            await bot.editMessageText(
              `❌ <b>TIDAK ADA SLOT TERSEDIA</b>\n\n` +
              `📞 <b>Pengelola:</b> ${cleanNumber}\n\n` +
              `🔍 <b>Alasan:</b> Tidak ada slot yang dikembalikan dari API\n\n` +
              `💡 <b>Kemungkinan:</b>\n` +
              `• Semua slot sudah terisi penuh\n` +
              `• Nomor belum memiliki paket keluarga\n` +
              `• API tidak mengembalikan data slot`,
              {
                chat_id: chatId,
                message_id: processingMsg.message_id,
                parse_mode: 'HTML'
              }
            );
            addStates.delete(chatId);
            return;
          }

          // Create inline keyboard berdasarkan slot_id dan status dari alias
          const keyboard = [];
          
          // Tampilkan semua slot dari API dengan status berdasarkan alias
          allSlots.forEach((slot, index) => {
            let buttonText;
            let callbackData;
            
            if (slot.status === 'empty') {
              // Slot kosong - bisa dipilih
              buttonText = `✅ Slot ${slot.slot_id} : KOSONG : Tersedia`;
              callbackData = `add_slot_${index}`;
            } else {
              // Slot terisi - bisa diklik tapi akan menampilkan alert
              buttonText = `❗ Slot ${slot.slot_id} : ${slot.msisdn} : ${slot.alias}`;
              callbackData = `slot_filled_${index}`;
            }
            
            keyboard.push([{ 
              text: buttonText, 
              callback_data: callbackData
            }]);
          });

          // Tambah tombol batal
          keyboard.push([{ text: '❌ BATAL', callback_data: 'cancel_add' }]);

          // Hitung slot kosong dan terisi
          const emptySlots = allSlots.filter(s => s.status === 'empty');
          const filledSlots = allSlots.filter(s => s.status === 'filled');

          let statusMessage;
          if (emptySlots.length > 0 && sisaAdd > 0) {
            statusMessage = `➕ <b>PILIH SLOT KOSONG UNTUK ANGGOTA BARU</b>\n\n` +
              `📞 <b>Pengelola:</b> ${cleanNumber}\n` +
              `📊 <b>Sisa Add:</b> ${sisaAdd} kesempatan\n` +
              `📈 <b>Slot Status:</b> ${filledSlots.length} terisi, ${emptySlots.length} kosong\n\n` +
              `🎯 <b>Pilih slot kosong untuk menambah anggota:</b>\n\n` +
              `✅ = Slot kosong (bisa dipilih)\n` +
              `❗ = Slot terisi (klik untuk info detail)\n\n` +
              `💡 <b>Status ditentukan dari field alias</b>`;
          } else {
            statusMessage = `❌ <b>TIDAK BISA MENAMBAH ANGGOTA</b>\n\n` +
              `📞 <b>Pengelola:</b> ${cleanNumber}\n` +
              `📊 <b>Sisa Add:</b> ${sisaAdd} kesempatan\n` +
              `📈 <b>Slot Status:</b> ${filledSlots.length} terisi, ${emptySlots.length} kosong\n\n` +
              `🔍 <b>SEMUA SLOT:</b>\n\n` +
              `❗ = Slot terisi (klik untuk info detail)\n\n` +
              `💡 <b>Tidak ada slot kosong atau habis kesempatan add</b>`;
          }

          await bot.editMessageText(statusMessage, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: keyboard
            }
          });

          // Update state dengan data slot
          addStates.set(chatId, {
            step: 'select_slot',
            pengelola: cleanNumber,
            allSlots: allSlots,
            slotData: slotResult,
            sisaAdd: sisaAdd,
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
          addStates.delete(chatId);
        }
        return;
      }

      if (state.step === 'input_member_phone') {
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
          `🎯 <b>Slot Dipilih:</b> Slot ${state.selectedSlot.slot_id}\n` +
          `👤 <b>Anggota Baru:</b> ${cleanNumber}\n\n` +
          `📝 <b>MASUKKAN NAMA PARENT</b>\n\n` +
          `Ketik nama parent (operator pengelola):\n\n` +
          `💡 <b>Contoh:</b> <code>XL</code>, <code>Telkomsel</code>, <code>Indosat</code>\n\n` +
          `💡 Ketik "keluar" untuk membatalkan`,
          { parse_mode: 'HTML' }
        );

        addStates.set(chatId, { 
          ...state,
          step: 'input_parent_name', 
          anggota: cleanNumber,
          inputMessageId: inputMsg3.message_id 
        });
        return;
      }

      if (state.step === 'input_parent_name') {
        const parentName = text;
        
        if (parentName.length < 2 || parentName.length > 20) {
          await bot.sendMessage(chatId,
            `❌ <b>Nama parent tidak valid!</b>\n\n` +
            `Nama parent harus 2-20 karakter.\n` +
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

        const inputMsg4 = await bot.sendMessage(chatId,
          `➕ <b>TAMBAH ANGGOTA - LANGKAH 4</b>\n\n` +
          `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
          `🎯 <b>Slot Dipilih:</b> Slot ${state.selectedSlot.slot_id}\n` +
          `👤 <b>Anggota Baru:</b> ${state.anggota}\n` +
          `📡 <b>Parent Name:</b> ${parentName}\n\n` +
          `📝 <b>MASUKKAN NAMA CHILD</b>\n\n` +
          `Ketik nama untuk anggota baru (child name):\n\n` +
          `💡 <b>Contoh:</b> <code>Ahmad Budi</code>, <code>Siti Aisyah</code>\n\n` +
          `💡 Ketik "keluar" untuk membatalkan`,
          { parse_mode: 'HTML' }
        );

        addStates.set(chatId, { 
          ...state,
          step: 'input_child_name', 
          parentName: parentName,
          inputMessageId: inputMsg4.message_id 
        });
        return;
      }

      if (state.step === 'input_child_name') {
        const childName = text;
        
        if (childName.length < 2 || childName.length > 50) {
          await bot.sendMessage(chatId,
            `❌ <b>Nama child tidak valid!</b>\n\n` +
            `Nama child harus 2-50 karakter.\n` +
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
        
        // Process STEP 2: API1+ADD1 dengan data yang sudah lengkap
        const processingMsg = await bot.sendMessage(chatId,
          `⚡ <b>MEMPROSES STEP 2: API1+ADD1...</b>\n\n` +
          `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
          `🎯 <b>Slot:</b> Slot ${state.selectedSlot.slot_id}\n` +
          `👤 <b>Anggota Baru:</b> ${state.anggota}\n` +
          `📡 <b>Parent Name:</b> ${state.parentName}\n` +
          `📝 <b>Child Name:</b> ${childName}\n\n` +
          `🔄 <b>Status:</b> Menambahkan anggota ke keluarga...\n` +
          `📡 <b>COMBO:</b> API1+CEKSLOT1+ADD1`,
          { parse_mode: 'HTML' }
        );

        try {
          // STEP 2: API1+ADD1 dengan form data lengkap
          const formattedPengelola = formatNomorToInternational(state.pengelola);
          const formattedAnggota = formatNomorToInternational(state.anggota);
          
          // Untuk slot kosong, family_member_id mungkin kosong/null - ini normal
          const memberIdToSend = state.selectedSlot.family_member_id || '';
          
          const formData = new URLSearchParams();
          formData.append('token', API_PRIMARY_TOKEN);
          formData.append('id_parent', formattedPengelola);
          formData.append('msisdn', formattedAnggota);
          formData.append('member_id', memberIdToSend);
          formData.append('slot_id', state.selectedSlot.slot_id.toString());
          formData.append('parent_name', state.parentName);
          formData.append('child_name', childName);

          console.log('🚀 STEP 2: API1+ADD1 - Menambahkan anggota...');
          console.log('📝 Selected Slot Info:', {
            slot_id: state.selectedSlot.slot_id,
            family_member_id: state.selectedSlot.family_member_id,
            status: state.selectedSlot.status,
            alias: state.selectedSlot.alias
          });
          console.log('📝 Form Data:', {
            token: API_PRIMARY_TOKEN ? API_PRIMARY_TOKEN.substring(0, 10) + '...' : 'KOSONG',
            id_parent: formattedPengelola,
            msisdn: formattedAnggota,
            member_id: memberIdToSend,
            slot_id: state.selectedSlot.slot_id.toString(),
            parent_name: state.parentName,
            child_name: childName
          });

          const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_ADD_ENDPOINT, formData, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 30000
          });

          console.log('🔍 ADD1 Response:', JSON.stringify(response.data, null, 2));

          let responseText = `➕ <b>HASIL TAMBAH ANGGOTA - API1+CEKSLOT1+ADD1</b>\n\n`;
          responseText += `📞 <b>Pengelola:</b> ${state.pengelola}\n`;
          responseText += `🎯 <b>Slot:</b> Slot ${state.selectedSlot.slot_id}\n`;
          responseText += `👤 <b>Anggota Baru:</b> ${state.anggota}\n`;
          responseText += `📡 <b>Parent Name:</b> ${state.parentName}\n`;
          responseText += `📝 <b>Child Name:</b> ${childName}\n`;
          responseText += `📡 <b>Sumber API:</b> 🟢 KHFY API1\n\n`;
          
          if (response.data?.status === 'success' || response.data?.status === true) {
            responseText += `✅ <b>BERHASIL MENAMBAHKAN ANGGOTA!</b>\n\n`;
            responseText += `🎉 <b>Pesan:</b> ${response.data.message || 'Anggota berhasil ditambahkan'}\n\n`;
            
            responseText += `👤 <b>Detail Anggota Baru:</b>\n`;
            responseText += `├ 📞 Nomor: ${formattedAnggota}\n`;
            responseText += `├ 📝 Nama: ${childName}\n`;
            responseText += `├ 🎯 Slot: ${state.selectedSlot.slot_id}\n`;
            responseText += `├ 📡 Parent: ${state.parentName}\n`;
            responseText += `└ 📊 Kuota Awal: 0.00 GB\n\n`;
            
            responseText += `📊 <b>Sisa Add:</b> ${state.sisaAdd - 1} kesempatan\n\n`;
          } else {
            responseText += `❌ <b>GAGAL MENAMBAHKAN ANGGOTA</b>\n\n`;
            responseText += `🔍 <b>Error:</b> ${response.data?.message || response.data?.description || 'Gagal menambahkan anggota'}\n\n`;
            
            responseText += `💡 <b>Solusi:</b>\n`;
            responseText += `• Pastikan nomor belum terdaftar di operator lain\n`;
            responseText += `• Pastikan slot masih kosong\n`;
            responseText += `• Coba lagi dalam beberapa saat\n\n`;
          }
          
          responseText += `⚡ <b>COMBO API1:</b> API1+CEKSLOT1+ADD1\n`;
          responseText += `🎯 <b>API Digunakan:</b> 🟢 KHFY API1\n`;
          responseText += `🔥 <b>Keunggulan:</b> Auto-slot selection, presisi tinggi`;
          
          await bot.editMessageText(responseText, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'HTML'
          });

        } catch (error) {
          console.log('❌ ADD1 Error:', error.message);
          
          await bot.editMessageText(
            `❌ <b>ERROR SAAT MENAMBAHKAN ANGGOTA</b>\n\n` +
            `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
            `👤 <b>Target:</b> ${childName} (${state.anggota})\n\n` +
            `🔍 <b>Error:</b> ${error.message}\n\n` +
            `💡 <b>Solusi:</b> Silakan coba lagi atau hubungi admin`,
            {
              chat_id: chatId,
              message_id: processingMsg.message_id,
              parse_mode: 'HTML'
            }
          );
        }

        addStates.delete(chatId);
        return;
      }
      
    } catch (error) {
      await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      addStates.delete(chatId);
    }
  });
};

// Export functions untuk penggunaan internal  
module.exports.addMemberAPI1Only = addMemberAPI1Only;