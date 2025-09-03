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

// Export functions untuk penggunaan internal (jika diperlukan)
// editKuberAPI1Only sudah tidak digunakan karena menggunakan inline keyboard

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

    // Handle member selection
    if (data.startsWith('edit_member_')) {
      const memberIndex = parseInt(data.split('_')[2]);
      const state = editkuberStates.get(chatId);
      
      if (!state || !state.slotData || !state.slotData.slots[memberIndex]) {
        await bot.answerCallbackQuery(id, { text: '❌ Data tidak valid', show_alert: true });
        return;
      }

      const selectedMember = state.slotData.slots[memberIndex];
      
      // Update state dengan member yang dipilih
      editkuberStates.set(chatId, {
        ...state,
        step: 'input_kuber',
        selectedMember: selectedMember,
        memberIndex: memberIndex
      });

      // Show kuber input message
      const inputMsg = await bot.sendMessage(chatId,
        `⚙️ <b>EDIT KUBER - LANGKAH 3</b>\n\n` +
        `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
        `👤 <b>Anggota Dipilih:</b> ${selectedMember.alias} (${selectedMember.msisdn})\n\n` +
        `📊 <b>MASUKKAN KUBER BARU (GB)</b>\n\n` +
        `Ketik jumlah kuber baru dalam GB:\n\n` +
        `💡 <b>Contoh:</b> <code>50</code> (untuk 50 GB)\n` +
        `💡 <b>Format:</b> Angka saja (1-999)\n\n` +
        `💡 Ketik "keluar" untuk membatalkan`,
        { parse_mode: 'HTML' }
      );

      editkuberStates.set(chatId, {
        ...state,
        step: 'input_kuber',
        selectedMember: selectedMember,
        memberIndex: memberIndex,
        inputMessageId: inputMsg.message_id
      });

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

        // Hapus input message
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}

        // Processing message
        const processingMsg = await bot.sendMessage(chatId,
          `⚡ <b>MEMPROSES STEP 1: API1+CEKSLOT1...</b>\n\n` +
          `📞 <b>Pengelola:</b> ${cleanNumber}\n` +
          `🔄 <b>Status:</b> Mengambil data anggota keluarga...\n\n` +
          `� <b>COMBO:</b> API1+CEKSLOT1+EDITKUBER1`,
          { parse_mode: 'HTML' }
        );

        // Get slot data from API1+CEKSLOT1
        const slotResult = await getSlotInfoAPI1Only(cleanNumber);
        
        if (!slotResult.success || slotResult.slots.length === 0) {
          await bot.editMessageText(
            `❌ <b>GAGAL MENGAMBIL DATA SLOT</b>\n\n` +
            `📞 <b>Pengelola:</b> ${cleanNumber}\n` +
            `🔍 <b>Error:</b> ${slotResult.error || 'Tidak ada anggota ditemukan'}\n\n` +
            `💡 <b>Kemungkinan:</b>\n` +
            `• Nomor pengelola salah\n` +
            `• Tidak ada anggota dalam keluarga\n` +
            `• API1 sedang maintenance`,
            {
              chat_id: chatId,
              message_id: processingMsg.message_id,
              parse_mode: 'HTML'
            }
          );
          editkuberStates.delete(chatId);
          return;
        }

        // Create inline keyboard with members
        const keyboard = [];
        
        // Format deskripsi pengelola dan slot info
        let pengelolaInfo = `✅ <b>PILIH ANGGOTA YANG AKAN DIEDIT KUBERNYA</b>\n\n`;
        pengelolaInfo += `<b>Pengelola:</b>\n\n`;
        
        slotResult.slots.forEach((slot, index) => {
          // Coba ambil kuota dari berbagai field yang mungkin ada
          const quotaMB = slot.quota_allocated || slot.kuota || slot.limit || slot.allocation || 0;
          const quotaGB = quotaMB ? (parseInt(quotaMB) / 1024).toFixed(1) : '0.0';
          const slotId = slot.slot_id || (index + 1);
          const addChances = slot.add_chances || 0;
          const alias = slot.alias || 'Unknown';
          
          pengelolaInfo += `Slot ${index + 1} : ${slotId} : ${addChances} : ${alias}\n`;
          
          // Create keyboard button dengan format: msisdn : quota_gb : alias  
          // Jika tidak ada data kuota, tampilkan "N/A"
          const quotaDisplay = quotaMB ? `${quotaGB}GB` : 'N/A';
          const buttonText = `${slot.msisdn} : ${quotaDisplay} : ${slot.alias}`;
          
          keyboard.push([{
            text: buttonText,
            callback_data: `edit_member_${index}`
          }]);
        });

        // Add cancel button
        keyboard.push([{ text: '❌ Batal', callback_data: 'menu_admin' }]);

        await bot.editMessageText(pengelolaInfo, {
          chat_id: chatId,
          message_id: processingMsg.message_id,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });

        // Update state dengan slot data
        editkuberStates.set(chatId, {
          step: 'select_member',
          pengelola: cleanNumber,
          slotData: slotResult
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
        
        // Process STEP 2: API1+EDITKUBER1 dengan data yang sudah ada
        const processingMsg = await bot.sendMessage(chatId,
          `⚡ <b>MEMPROSES STEP 2: API1+EDITKUBER1...</b>\n\n` +
          `📞 <b>Pengelola:</b> ${state.pengelola}\n` +
          `👤 <b>Anggota:</b> ${state.selectedMember.alias} (${state.selectedMember.msisdn})\n` +
          `📊 <b>Kuber Baru:</b> ${kuberNumber} GB\n\n` +
          `� <b>Status:</b> Mengirim request edit kuber...\n` +
          `� <b>COMBO:</b> API1+CEKSLOT1+EDITKUBER1`,
          { parse_mode: 'HTML' }
        );

        try {
          // STEP 2: API1+EDITKUBER1 langsung dengan data dari state
          const formattedPengelola = formatNomorToInternational(state.pengelola);
          
          const formData = new URLSearchParams();
          formData.append('token', API_PRIMARY_TOKEN);
          formData.append('id_parent', formattedPengelola);
          formData.append('member_id', state.selectedMember.family_member_id);
          formData.append('new_allocation', kuberNumber.toString());

          console.log('🚀 STEP 2: API1+EDITKUBER1 - Editing kuber...');
          console.log('📝 Form Data:', {
            token: API_PRIMARY_TOKEN ? API_PRIMARY_TOKEN.substring(0, 10) + '...' : 'KOSONG',
            id_parent: formattedPengelola,
            member_id: state.selectedMember.family_member_id,
            new_allocation: kuberNumber.toString()
          });

          const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_EDITKUBER_ENDPOINT, formData, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 30000
          });

          console.log('🔍 EDITKUBER1 Response:', JSON.stringify(response.data, null, 2));

          let responseText = `⚙️ <b>HASIL EDIT KUBER - API1+CEKSLOT1+EDITKUBER1</b>\n\n`;
          responseText += `📞 <b>Pengelola:</b> ${state.pengelola}\n`;
          responseText += `� <b>Anggota:</b> ${state.selectedMember.alias}\n`;
          responseText += `� <b>Nomor:</b> ${state.selectedMember.msisdn}\n`;
          responseText += `📊 <b>Kuber Baru:</b> ${kuberNumber} GB\n`;
          responseText += `� <b>Sumber API:</b> 🟢 KHFY API1\n\n`;

          if (response.data?.status === 'success' || response.data?.status === true) {
            responseText += `✅ <b>BERHASIL MENGUBAH KUBER!</b>\n\n`;
            responseText += `🎉 <b>Pesan:</b> ${response.data.message || 'Kuber berhasil diubah'}\n\n`;
            
            responseText += `📋 <b>Detail Anggota:</b>\n`;
            responseText += `💌 Member ID: <code>${state.selectedMember.family_member_id}</code>\n`;
            responseText += `✨ Nama: ${state.selectedMember.alias}\n`;
            responseText += `� Nomor: ${state.selectedMember.msisdn}\n`;
            responseText += `⚡ Slot ID: ${state.selectedMember.slot_id}\n`;
            responseText += `♻️ Kuber Baru: ${kuberNumber} GB\n\n`;
            
            responseText += `� <b>Total Anggota Keluarga:</b> ${state.slotData.slots.length} orang\n`;
          } else {
            responseText += `❌ <b>GAGAL MENGUBAH KUBER</b>\n\n`;
            responseText += `🔍 <b>Error:</b> ${response.data?.message || 'Tidak ada response dari API'}\n\n`;
            
            responseText += `� <b>Detail Request:</b>\n`;
            responseText += `� Member ID: <code>${state.selectedMember.family_member_id}</code>\n`;
            responseText += `✨ Nama: ${state.selectedMember.alias}\n`;
            responseText += `� Nomor: ${state.selectedMember.msisdn}\n`;
            responseText += `♻️ Kuber Diminta: ${kuberNumber} GB\n\n`;
            
            responseText += `� <b>Solusi:</b>\n`;
            responseText += `• Pastikan member_id valid\n`;
            responseText += `• Pastikan kuber dalam range yang diizinkan\n`;
            responseText += `• Coba cek slot terlebih dahulu\n`;
          }
          
          responseText += `\n⚡ <b>COMBO API1:</b> API1+CEKSLOT1+EDITKUBER1\n`;
          responseText += `🎯 <b>API Digunakan:</b> 🟢 KHFY API1\n`;
          responseText += `🔥 <b>Keunggulan:</b> Data akurat dari slot, presisi tinggi`;

          await bot.editMessageText(responseText, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'HTML'
          });

        } catch (error) {
          console.error('💥 EDITKUBER1 Error:', error);
          
          let responseText = `⚙️ <b>HASIL EDIT KUBER - API1+CEKSLOT1+EDITKUBER1</b>\n\n`;
          responseText += `📞 <b>Pengelola:</b> ${state.pengelola}\n`;
          responseText += `� <b>Anggota:</b> ${state.selectedMember.alias}\n`;
          responseText += `📧 <b>Nomor:</b> ${state.selectedMember.msisdn}\n`;
          responseText += `� <b>Kuber Baru:</b> ${kuberNumber} GB\n\n`;
          responseText += `❌ <b>GAGAL MENGUBAH KUBER</b>\n\n`;
          responseText += `🔍 <b>Error:</b> ${error.message}\n\n`;
          responseText += `💡 <b>Kemungkinan:</b>\n`;
          responseText += `• Koneksi timeout ke API\n`;
          responseText += `• API sedang maintenance\n`;
          responseText += `• Data tidak valid\n\n`;
          responseText += `⚡ <b>COMBO API1:</b> API1+CEKSLOT1+EDITKUBER1\n`;
          responseText += `🎯 <b>API Digunakan:</b> 🟢 KHFY API1`;

          await bot.editMessageText(responseText, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'HTML'
          });
        }
        
        editkuberStates.delete(chatId);
        return;
      }
      
    } catch (error) {
      await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      editkuberStates.delete(chatId);
    }
  });
};