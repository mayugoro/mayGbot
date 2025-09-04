// Handler untuk proses pembelian bulanan global
// Berinteraksi dengan API AKRAB GLOBAL untuk pembelian paket
// Flow diperbaiki mengikuti handler_bulanan.js yang rapi

const axios = require('axios');

// State management untuk bulanan global
const stateBulananGlobal = new Map();

// === HELPER FUNCTION: FORMAT NOMOR TO 628 FORMAT ===
function formatNomorTo628(nomor) {
  // Remove all non-digit characters
  let cleanNomor = nomor.replace(/\D/g, '');
  
  // Convert to 628 format for AKRAB GLOBAL API
  if (cleanNomor.startsWith('62')) {
    // Already in 62 format
    cleanNomor = cleanNomor;
  } else if (cleanNomor.startsWith('0')) {
    // 08xxxxxxxx -> 628xxxxxxxx
    cleanNomor = '62' + cleanNomor.substring(1);
  } else if (cleanNomor.startsWith('8')) {
    // 8xxxxxxxx -> 628xxxxxxxx  
    cleanNomor = '62' + cleanNomor;
  } else {
    // Unknown format -> add 628
    cleanNomor = '628' + cleanNomor;
  }
  
  return cleanNomor;
}

// === MAIN KEYBOARD GENERATOR ===
const generateMainKeyboard = (userId) => {
  const keyboard = [
    [
      { text: '🗒️ REDEEM KODE 🗒️', callback_data: 'redeem_menu' }
    ],
    [
      { text: '📦 STOK BULANAN', callback_data: 'cek_stok_bulanan' },
      { text: '📦 STOK BEKASAN', callback_data: 'cek_stok' }
    ],
    [
      { text: '🌙 BELI BULANAN', callback_data: 'menu_bulanan' },
      { text: '⚡ BELI BEKASAN', callback_data: 'menu_bekasan' }
    ],
    [
      { text: '✨ AKRAB GLOBAL ✨', callback_data: 'menu_akrab_global' }
    ],
    [
      { text: '💌 CEK SIDOMPUL 💌', callback_data: 'cek_sidompul' }
    ]
  ];

  // Only add admin button if user is admin
  if (userId.toString() === process.env.ADMIN_ID) {
    keyboard.push([
      { text: '🛠️ ADMIN', callback_data: 'menu_admin' }
    ]);
  }

  return keyboard;
};

// Export function untuk set state dari list_bulanan_global.js
const setStateBulananGlobal = async (chatId, state) => {
  const { userId, paket } = state;
  
  // === VALIDASI SALDO SEBELUM PROSES ===
  try {
    const { getUserSaldo, getKonfigurasi } = require('../../../db');
    const saldoUser = await getUserSaldo(userId);
    const harga = await getKonfigurasi(`harga_global_${paket}`) || await getKonfigurasi(`harga_${paket}`);
    const hargaValue = harga ? parseInt(harga) : 0;
    
    if (saldoUser < hargaValue) {
      // Saldo tidak cukup
      global.bot.sendMessage(chatId, `❗<b>Saldo tidak cukup untuk membeli produk!</b>`, {
        parse_mode: 'HTML'
      }).catch(err => console.error('Error sending insufficient balance message:', err));
      return;
    }
  } catch (dbErr) {
    console.error('Error checking balance:', dbErr.message);
    global.bot.sendMessage(chatId, '❌ <b>Gagal memverifikasi saldo</b>\n\nSilakan coba lagi atau hubungi admin.', {
      parse_mode: 'HTML'
    }).catch(err => console.error('Error sending DB error message:', err));
    return;
  }
  
  console.log('=== BULANAN GLOBAL: MEMULAI PROSES ===');
  console.log('Chat ID:', chatId);
  console.log('User ID:', userId);
  console.log('Paket:', paket);
  console.log('Original Message ID:', state.originalMessageId);
  
  stateBulananGlobal.set(chatId, state);
  
  // Langsung ke input nomor (tidak ada pengecekan slot untuk global)
  setTimeout(() => {
    inputNomorHP(chatId);
  }, 500);
};

// Function untuk meminta input nomor HP
const inputNomorHP = async (chatId) => {
  const state = stateBulananGlobal.get(chatId);
  if (!state || state.step !== 'input_nomor_global') return;

  const { paket } = state;
  
  console.log('=== BULANAN GLOBAL: INPUT NOMOR HP ===');
  console.log('Chat ID:', chatId);
  console.log('Paket:', paket);

  // Update state
  state.step = 'input_nomor_global';
  stateBulananGlobal.set(chatId, state);

  // Kirim pesan input nomor
  const teksInput = `❗<b>Masukan Nomor....</b>`;
  await global.bot.sendMessage(chatId, teksInput, { parse_mode: 'HTML' });

  console.log('📤 Input nomor message terkirim');

  // Set timer 30 detik untuk auto cancel jika tidak ada input
  const timeoutId = setTimeout(() => {
    const currentState = stateBulananGlobal.get(chatId);
    if (currentState && currentState.step === 'input_nomor_global') {
      // Auto cancel jika tidak ada input dalam 30 detik
      stateBulananGlobal.delete(chatId);
      global.bot.sendMessage(chatId, 
        '⌛ <b>Waktu habis</b>\n\n' +
        'Sesi pembelian dibatalkan karena tidak ada input nomor dalam 30 detik.\n' +
        '🔄 Silakan mulai transaksi baru.',
        { parse_mode: 'HTML' }
      ).catch(err => console.error('Error sending timeout message:', err));
      
      console.log('⌛ Session timeout untuk chat:', chatId);
    }
  }, 30000); // 30 detik

  // Simpan timeoutId ke state untuk bisa dibatalkan nanti
  state.timeoutId = timeoutId;
  stateBulananGlobal.set(chatId, state);
};

// Auto cleanup untuk session yang timeout/stale  
const cleanupStaleSessions = () => {
  const now = Date.now();
  const TIMEOUT_DURATION = 180000; // 3 menit timeout
  
  for (const [chatId, state] of stateBulananGlobal) {
    if (state.timestamp && (now - state.timestamp > TIMEOUT_DURATION)) {
      stateBulananGlobal.delete(chatId);
      
      // Notify user
      global.bot.sendMessage(chatId, 
        '⌛ <b>Sesi telah berakhir</b>\n\n' +
        'Sesi Anda telah berakhir karena tidak ada aktivitas.\n' +
        '🔄 Silakan mulai transaksi baru.',
        { parse_mode: 'HTML' }
      ).catch(err => console.error('Error sending cleanup notification:', err));
    }
  }
};

// Jalankan cleanup setiap 1 menit
setInterval(cleanupStaleSessions, 60000);

module.exports = (bot) => {
  // Store bot instance globally
  global.bot = bot;

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    const text = msg.text.trim();
    const state = stateBulananGlobal.get(chatId);

    if (!state || state.step !== 'input_nomor_global' || text.startsWith('/')) return;

    const { userId, paket } = state;
    
    console.log('=== BULANAN GLOBAL: USER INPUT NOMOR HP ===');
    console.log('Chat ID:', chatId);
    console.log('Input text:', text);
    console.log('User ID:', userId);
    console.log('Username:', msg.from?.username);
    console.log('Paket:', paket);
    
    // BATALKAN TIMEOUT TIMER karena user sudah input
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      delete state.timeoutId;
    }

    // NORMALISASI NOMOR INPUT ke format 628
    const normalizedNumber = formatNomorTo628(text);
    console.log('Normalized number (628 format):', normalizedNumber);
    
    // Validasi basic nomor HP
    if (normalizedNumber.length < 12 || normalizedNumber.length > 15) {
      console.log('❌ Nomor tidak valid - length tidak sesuai');
      await bot.sendMessage(chatId, '❌ <b>Format nomor tidak valid!</b>\n\n✅ Format yang diterima:\n• 08xxxxxxxxxx\n• 628xxxxxxxxxx\n• 8xxxxxxxxxx\n\n💡 Contoh: 08123456789 atau 628123456789', {
        parse_mode: 'HTML'
      });
      // Hapus input user untuk privacy
      try {
        await bot.deleteMessage(chatId, msg.message_id);
        console.log('🔒 Invalid input berhasil dihapus (privacy)');
      } catch (e) {
        console.log('❌ Gagal hapus invalid input:', e.message);
      }
      return;
    }
    
    // Hapus message nomor HP user untuk privacy
    try {
      await bot.deleteMessage(chatId, msg.message_id);
      console.log('🔒 User input nomor berhasil dihapus (privacy)');
    } catch (e) {
      console.log('❌ Gagal hapus user input:', e.message);
    }

    const startTime = Date.now();
    const processingMsg = await bot.sendMessage(chatId, '⏳ <b>Memproses pembelian global...</b>', { parse_mode: 'HTML' });
    
    console.log('📤 Processing message terkirim');

    try {
      // === API AKRAB GLOBAL INTEGRATION ===
      console.log('=== BULANAN GLOBAL: KIRIM API REQUEST ===');
      
      // Get current date in DDMMYY format
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      const timeFormat = day + month + year;
      console.log('Time format generated:', timeFormat);

      // Generate unique transaction ID
      const trxId = `TRX${Date.now()}${Math.random().toString(36).substr(2, 5)}`;
      console.log('Transaction ID generated:', trxId);

      // Get kode paket dari mapping
      const kodePaketMap = {
        'supermini': 'XLASM',
        'megabig': 'XLA89',
        'mini': 'XLAM',
        'big': 'XLAB',
        'jumbo': 'XLAJ'
      };
      const kodePaket = kodePaketMap[paket] || paket.toUpperCase();
      console.log('Kode paket untuk API:', kodePaket);

      // Prepare API payload
      const apiPayload = {
        req: "topup",
        produk: kodePaket,
        msisdn: normalizedNumber,
        reffid: trxId,
        time: timeFormat,
        kodereseller: process.env.KODERESSG,
        password: process.env.PASSWORDG,
        pin: process.env.PING
      };
      
      console.log('API Payload prepared:');
      console.log('- URL:', process.env.APIG_ORDER);
      console.log('- Payload:', JSON.stringify(apiPayload, null, 2));

      // Kirim request ke AKRAB GLOBAL API
      const response = await axios.post(process.env.APIG_ORDER, apiPayload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000 // 30 detik timeout
      });

      const executionTime = Math.floor((Date.now() - startTime) / 1000);
      console.log('API execution time:', executionTime + 's');
      console.log('API Response:', JSON.stringify(response.data, null, 2));

      // === PROSES RESPONSE DAN POTONG SALDO ===
      const { getKonfigurasi, potongSaldo } = require('../../../db');
      const harga = await getKonfigurasi(`harga_global_${paket}`) || await getKonfigurasi(`harga_${paket}`);
      const hargaValue = harga ? parseInt(harga) : 0;
      
      console.log('Harga paket:', hargaValue);

      let teksHasil = '';
      let isPending = false;

      // Cek response dari API
      if (response.data && response.data.status) {
        const status = response.data.status.toLowerCase();
        const message = response.data.message || '';
        
        console.log('API Status:', status);
        console.log('API Message:', message);
        
        if (status === 'success' || status === 'sukses') {
          // ✅ SUKSES - Potong saldo penuh
          const { kurangiSaldo } = require('../../../db');
          await kurangiSaldo(userId, hargaValue);
          console.log('✅ Saldo berhasil dipotong:', hargaValue);
          
          // Ambil saldo user setelah dipotong (untuk display)
          const { getUserSaldo } = require('../../../db');
          const saldoAkhir = await getUserSaldo(userId);
          const saldoAwal = saldoAkhir + hargaValue;
          
          teksHasil = `✅ Sukses !!\n\n` +
            `<code>Detail         : Sukses AKRAB GLOBAL 🌍\n` +
            `Jenis paket    : ${paket.toUpperCase()}\n` +
            `Nomor          : ${normalizedNumber}\n` +
            `TRX ID         : ${trxId}\n` +
            `Provider       : AKRAB GLOBAL\n` +
            `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n` +
            `Saldo terpotong: Rp.${hargaValue.toLocaleString('id-ID')}\n` +
            `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}\n` +
            `Waktu eksekusi : ${executionTime} detik ✅</code>`;

          // Log transaksi sukses ke grup/channel
          try {
            const { logTransaction } = require('../../../transaction_logger');
            await logTransaction(bot, {
              userId: userId,
              username: userInfo.username,
              kategori: `BULANAN GLOBAL ${paket.toUpperCase()}`,
              nomor: normalizedNumber, // Nomor customer/pembeli
              pengelola: 'AKRAB_GLOBAL', // Provider
              status: 'completed',
              harga: hargaValue,
              saldoSebelum: saldoAwal,
              saldoSesudah: saldoAkhir,
              trxId: trxId,
              provider: 'AKRAB_GLOBAL'
            });
          } catch (logError) {
            console.error('Warning: Failed to log successful transaction:', logError.message);
          }
            
        } else if (status === 'pending' || message.toLowerCase().includes('pending')) {
          // ⏳ PENDING - Potong saldo penuh (karena kemungkinan akan berhasil)
          isPending = true;
          const { kurangiSaldo } = require('../../../db');
          await kurangiSaldo(userId, hargaValue);
          console.log('⏳ Saldo berhasil dipotong (PENDING):', hargaValue);
          
          // Ambil saldo user setelah dipotong (untuk display)
          const { getUserSaldo } = require('../../../db');
          const saldoAkhir = await getUserSaldo(userId);
          const saldoAwal = saldoAkhir + hargaValue;
          
          teksHasil = `⏳ Pending !!\n\n` +
            `<code>Detail         : Sedang diproses\n` +
            `Jenis paket    : ${paket.toUpperCase()}\n` +
            `Nomor          : ${normalizedNumber}\n` +
            `TRX ID         : ${trxId}\n` +
            `Provider       : AKRAB GLOBAL\n` +
            `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n` +
            `Saldo terpotong: Rp.${hargaValue.toLocaleString('id-ID')}\n` +
            `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}\n` +
            `Waktu eksekusi : ${executionTime} detik ⏳\n` +
            `Status         : ${message}</code>`;

          // Log transaksi pending ke grup/channel
          try {
            const { logTransaction } = require('../../../transaction_logger');
            await logTransaction(bot, {
              userId: userId,
              username: userInfo.username,
              kategori: `BULANAN GLOBAL ${paket.toUpperCase()}`,
              nomor: normalizedNumber, // Nomor customer/pembeli
              pengelola: 'AKRAB_GLOBAL', // Provider
              status: 'pending',
              harga: hargaValue,
              saldoSebelum: saldoAwal,
              saldoSesudah: saldoAkhir,
              trxId: trxId,
              provider: 'AKRAB_GLOBAL',
              error: `Pending: ${message}`
            });
          } catch (logError) {
            console.error('Warning: Failed to log pending transaction:', logError.message);
          }
            
        } else if (status === 'Tujuan Diluar Wilayah' || message === 'Tujuan Diluar Wilayah') {
          // 🚫 TUJUAN DILUAR WILAYAH - TIDAK POTONG SALDO SAMA SEKALI
          console.log('🚫 Tujuan diluar wilayah - saldo tidak dipotong');
          
          // Ambil saldo user (tidak berubah)
          const { getUserSaldo } = require('../../../db');
          const saldoUser = await getUserSaldo(userId);
          
          teksHasil = `🚫 Tujuan Diluar Wilayah !!\n\n` +
            `<code>Detail         : Nomor diluar coverage\n` +
            `Jenis paket    : ${paket.toUpperCase()}\n` +
            `Nomor          : ${normalizedNumber}\n` +
            `TRX ID         : ${trxId}\n` +
            `Provider       : AKRAB GLOBAL\n` +
            `Saldo          : Rp.${saldoUser.toLocaleString('id-ID')} (tidak terpotong)\n` +
            `Waktu eksekusi : ${executionTime} detik 🚫\n` +
            `Info           : ${message}\n\n` +
            `💡 Silakan gunakan nomor yang berada dalam wilayah coverage</code>`;

          // Log transaksi ditolak ke grup/channel
          try {
            const { logTransaction } = require('../../../transaction_logger');
            await logTransaction(bot, {
              userId: userId,
              username: userInfo.username,
              kategori: `BULANAN GLOBAL ${paket.toUpperCase()}`,
              nomor: normalizedNumber, // Nomor customer/pembeli
              pengelola: 'AKRAB_GLOBAL', // Provider
              status: 'validation_failed',
              harga: 0, // Tidak ada potongan saldo
              saldoSebelum: saldoUser,
              saldoSesudah: saldoUser, // Saldo tidak berubah
              trxId: trxId,
              provider: 'AKRAB_GLOBAL',
              error: 'Tujuan Diluar Wilayah - Nomor tidak dalam coverage'
            });
          } catch (logError) {
            console.error('Warning: Failed to log validation failed transaction:', logError.message);
          }
            
        } else {
          // ❌ GAGAL LAINNYA - Potong biaya gagal
          const biayaGagal = await getKonfigurasi('biaya_gagal') || '1000';
          const biayaGagalValue = parseInt(biayaGagal);
          const { kurangiSaldo } = require('../../../db');
          await kurangiSaldo(userId, biayaGagalValue);
          console.log('❌ Saldo dipotong biaya gagal:', biayaGagalValue);
          
          // Ambil saldo user setelah dipotong biaya gagal (untuk display)
          const { getUserSaldo } = require('../../../db');
          const saldoAkhir = await getUserSaldo(userId);
          const saldoAwal = saldoAkhir + biayaGagalValue;
          
          teksHasil = `❌ Gagal !!\n\n` +
            `<code>Detail         : ${message}\n` +
            `Jenis paket    : ${paket.toUpperCase()}\n` +
            `Nomor          : ${normalizedNumber}\n` +
            `TRX ID         : ${trxId}\n` +
            `Provider       : AKRAB GLOBAL\n` +
            `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n` +
            `Saldo terpotong: Rp.${biayaGagalValue.toLocaleString('id-ID')}\n` +
            `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}\n` +
            `Waktu eksekusi : ${executionTime} detik ❌</code>`;

          // Log transaksi gagal ke grup/channel
          try {
            const { logTransaction } = require('../../../transaction_logger');
            await logTransaction(bot, {
              userId: userId,
              username: userInfo.username,
              kategori: `BULANAN GLOBAL ${paket.toUpperCase()}`,
              nomor: normalizedNumber, // Nomor customer/pembeli
              pengelola: 'AKRAB_GLOBAL', // Provider
              status: 'failed',
              harga: biayaGagalValue,
              saldoSebelum: saldoAwal,
              saldoSesudah: saldoAkhir,
              trxId: trxId,
              provider: 'AKRAB_GLOBAL',
              error: `API Error: ${message}`
            });
          } catch (logError) {
            console.error('Warning: Failed to log failed transaction:', logError.message);
          }
        }
      } else {
        // Response tidak sesuai format
        const biayaGagal = await getKonfigurasi('biaya_gagal') || '1000';
        const biayaGagalValue = parseInt(biayaGagal);
        await potongSaldo(userId, biayaGagalValue, `BULANAN GLOBAL ${paket.toUpperCase()} (ERROR)`);
        console.log('❌ Saldo dipotong biaya gagal (format error):', biayaGagalValue);
        
        teksHasil = `❌ <b>BULANAN GLOBAL ERROR</b>\n\n` +
          `📱 Nomor: ${normalizedNumber}\n` +
          `📦 Paket: ${paket.toUpperCase()}\n` +
          `💰 Biaya: Rp. ${biayaGagalValue.toLocaleString('id-ID')}\n` +
          `🆔 TRX ID: ${trxId}\n` +
          `⏱️ Waktu: ${executionTime}s\n\n` +
          `📋 Error: Response format tidak valid\n\n` +
          `🔄 <i>Silakan coba lagi atau hubungi admin</i>\n` +
          `🌍 <i>Powered by AKRAB GLOBAL</i>`;
      }

      console.log('=== BULANAN GLOBAL: HASIL FINAL ===');
      console.log('Teks hasil:', teksHasil);

      // Kirim hasil FIRST, lalu hapus processing message
      await bot.sendMessage(chatId, teksHasil, {
        parse_mode: 'HTML'
      });

      console.log('📤 Hasil final berhasil dikirim');

      // Hapus message "Memproses..." setelah hasil terkirim
      try {
        await bot.deleteMessage(chatId, processingMsg.message_id);
        console.log('🗑️ Processing message berhasil dihapus');
      } catch (e) {
        console.log('❌ Gagal hapus processing message:', e.message);
      }

      // Cleanup state
      stateBulananGlobal.delete(chatId);
      console.log('🧹 State berhasil dibersihkan');

      // Auto restore menu setelah transaksi
      setTimeout(async () => {
        if (state.originalMessageId) {
          try {
            await bot.deleteMessage(chatId, state.originalMessageId);
            console.log('🗑️ Original message (detail paket) berhasil dihapus');
          } catch (e) {
            console.log('❌ Gagal hapus original message:', e.message);
          }
        }
      }, 1000); // 1 detik untuk hapus detail paket
      
      setTimeout(async () => {
        try {
          const keyboard = generateMainKeyboard(userId);
          await bot.sendPhoto(chatId, 'welcome.jpg', {
            caption: `💌 <b>ID</b>           : <code>${userId}</code>\n` +
                    `💌 <b>User</b>       : <code>${msg.from?.username || '-'}</code>\n` +
                    `📧 <b>Saldo</b>     : <code>Memuat...</code>\n` +
                    `⌚ <b>Uptime</b>  : <code>Memuat...</code>`,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          console.log('🔄 Main menu berhasil dikembalikan');
        } catch (e) {
          console.log('❌ Gagal kembalikan main menu:', e.message);
        }
      }, 2000); // 2 detik delay untuk memberi waktu user membaca hasil

      console.log('=== END BULANAN GLOBAL: SUCCESS ===\n');

    } catch (err) {
      console.error(`Error processing bulanan global: ${err.message}`);
      const executionTime = Math.floor((Date.now() - startTime) / 1000);
      
      // Error handling dengan biaya gagal
      const { getKonfigurasi, potongSaldo } = require('../../../db');
      const biayaGagal = await getKonfigurasi('biaya_gagal') || '1000';
      const biayaGagalValue = parseInt(biayaGagal);

      let teksError = '';
      
      // Special handling untuk timeout/network error
      if (err.code === 'ECONNRESET' || err.message.includes('socket hang up') || err.message.includes('timeout')) {
        // Timeout biasanya berarti masih diproses, potong saldo penuh
        const harga = await getKonfigurasi(`harga_global_${paket}`) || await getKonfigurasi(`harga_${paket}`);
        const hargaValue = harga ? parseInt(harga) : 0;
        await potongSaldo(userId, hargaValue, `BULANAN GLOBAL ${paket.toUpperCase()} (TIMEOUT)`);
        console.log('⏳ Saldo dipotong penuh (timeout):', hargaValue);
        
        teksError = `⏳ <b>BULANAN GLOBAL TIMEOUT</b>\n\n` +
          `📱 Nomor: ${normalizedNumber}\n` +
          `📦 Paket: ${paket.toUpperCase()}\n` +
          `💰 Harga: Rp. ${hargaValue.toLocaleString('id-ID')}\n` +
          `⏱️ Waktu: ${executionTime}s\n\n` +
          `📋 Status: Koneksi timeout\n\n` +
          `⚠️ <i>Kemungkinan transaksi sedang diproses</i>\n` +
          `💬 <i>Jika paket tidak masuk dalam 5 menit, hubungi admin</i>\n` +
          `🌍 <i>Powered by AKRAB GLOBAL</i>`;
      } else {
        // Error lainnya, potong biaya gagal
        await potongSaldo(userId, biayaGagalValue, `BULANAN GLOBAL ${paket.toUpperCase()} (ERROR)`);
        console.log('❌ Saldo dipotong biaya gagal (error):', biayaGagalValue);
        
        teksError = `❌ <b>BULANAN GLOBAL ERROR</b>\n\n` +
          `📱 Nomor: ${normalizedNumber}\n` +
          `📦 Paket: ${paket.toUpperCase()}\n` +
          `💰 Biaya: Rp. ${biayaGagalValue.toLocaleString('id-ID')}\n` +
          `⏱️ Waktu: ${executionTime}s\n\n` +
          `📋 Error: ${err.message}\n\n` +
          `🔄 <i>Silakan coba lagi atau hubungi admin</i>\n` +
          `🌍 <i>Powered by AKRAB GLOBAL</i>`;
      }

      console.log('=== BULANAN GLOBAL: ERROR RESULT ===');
      console.log('Teks error:', teksError);

      // Log transaksi error ke grup/channel
      try {
        const { logTransaction } = require('../../../transaction_logger');
        await logTransaction(bot, {
          userId: userId,
          username: userInfo.username,
          kategori: `BULANAN GLOBAL ${state.paket.toUpperCase()}`,
          nomor: state.nomor, // Nomor customer/pembeli
          pengelola: 'AKRAB_GLOBAL', // Provider
          status: 'failed',
          harga: 0, // Tidak ada potongan saldo untuk error jaringan
          saldoSebelum: 0,
          saldoSesudah: 0,
          provider: 'AKRAB_GLOBAL',
          error: `Network Error: ${err.message}`
        });
      } catch (logError) {
        console.error('Warning: Failed to log error transaction:', logError.message);
      }

      // Kirim hasil error
      await bot.sendMessage(chatId, teksError, {
        parse_mode: 'HTML'
      });

      // Hapus message "Memproses..." setelah hasil terkirim
      try {
        await bot.deleteMessage(chatId, processingMsg.message_id);
        console.log('🗑️ Processing message berhasil dihapus (error case)');
      } catch (e) {
        console.log('❌ Gagal hapus processing message (error case):', e.message);
      }

      // Cleanup state
      stateBulananGlobal.delete(chatId);
      console.log('🧹 State berhasil dibersihkan (error case)');

      // Auto restore menu setelah error
      setTimeout(async () => {
        if (state.originalMessageId) {
          try {
            await bot.deleteMessage(chatId, state.originalMessageId);
            console.log('🗑️ Original message berhasil dihapus (error case)');
          } catch (e) {
            console.log('❌ Gagal hapus original message (error case):', e.message);
          }
        }
      }, 1000);
      
      setTimeout(async () => {
        try {
          const keyboard = generateMainKeyboard(userId);
          await bot.sendPhoto(chatId, 'welcome.jpg', {
            caption: `💌 <b>ID</b>           : <code>${userId}</code>\n` +
                    `💌 <b>User</b>       : <code>${msg.from?.username || '-'}</code>\n` +
                    `📧 <b>Saldo</b>     : <code>Memuat...</code>\n` +
                    `⌚ <b>Uptime</b>  : <code>Memuat...</code>`,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          console.log('🔄 Main menu berhasil dikembalikan (error case)');
        } catch (e) {
          console.log('❌ Gagal kembalikan main menu (error case):', e.message);
        }
      }, 2000);

      console.log('=== END BULANAN GLOBAL: ERROR ===\n');
    }
  });
};

module.exports.setStateBulananGlobal = setStateBulananGlobal;
