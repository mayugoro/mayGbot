const axios = require('axios');

const adminState = new Map();
let kickanggotaEnabled = false; // Default: OFF untuk user biasa

module.exports = (bot) => {
  // Text trigger keywords for onkickanggota
  const onkickKeywords = [
    'on kick', 'onkick', 'aktifkan kick', 'enable kick', 'nyalakan kick',
    'kick on', 'turn on kick', 'start kick', 'buka kick', 'izinkan kick',
    'aktif kick', 'hidup kick', 'allow kick'
  ];

  // Text trigger keywords for offkickanggota
  const offkickKeywords = [
    'off kick', 'offkick', 'matikan kick', 'disable kick', 'tutup kick',
    'kick off', 'turn off kick', 'stop kick', 'blokir kick', 'larang kick',
    'nonaktif kick', 'mati kick', 'block kick'
  ];

  // === Text Triggers for onkickanggota ===
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;
    
    // === PROTEKSI BROADCAST SESI ===
    // Jika admin sedang dalam sesi broadcast, jangan proses trigger menu lain
    if (bot.isAdminInBroadcastSession && bot.isAdminInBroadcastSession(msg)) {
      return; // Skip processing, biarkan broadcast handler yang menangani
    }
    
    const messageText = msg.text.toLowerCase();
    
    // Check for onkick keywords
    const hasOnKickKeyword = onkickKeywords.some(keyword => messageText.includes(keyword.toLowerCase()));
    if (hasOnKickKeyword) {
      await executeOnKickAnggota(bot, msg);
      return;
    }
    
    // Check for offkick keywords
    const hasOffKickKeyword = offkickKeywords.some(keyword => messageText.includes(keyword.toLowerCase()));
    if (hasOffKickKeyword) {
      await executeOffKickAnggota(bot, msg);
      return;
    }
  });

  // === /onkickanggota (backward compatibility) ===
  bot.onText(/\/onkickanggota/, async (msg) => {
    await executeOnKickAnggota(bot, msg);
  });

  // Main onkickanggota execution function
  const executeOnKickAnggota = async (bot, msg) => {
    if (msg.from.id.toString() !== process.env.ADMIN_ID) {
      return bot.sendMessage(msg.chat.id, 'ente siapa njir🗿');
    }
    
    kickanggotaEnabled = true;
    
    const statusMsg = await bot.sendMessage(msg.chat.id, '✅ <b>Fitur /kickanggota telah DIAKTIFKAN untuk semua user</b>\n\n📢 Sekarang semua user bisa menggunakan perintah /kickanggota', {
      parse_mode: 'HTML'
    });
    
    // Auto delete setelah 3 detik
    setTimeout(async () => {
      try {
        await bot.deleteMessage(msg.chat.id, msg.message_id);
        await bot.deleteMessage(msg.chat.id, statusMsg.message_id);
      } catch (e) {
        // Ignore delete error
      }
    }, 3000);
  };

  // === /offkickanggota (backward compatibility) ===
  bot.onText(/\/offkickanggota/, async (msg) => {
    await executeOffKickAnggota(bot, msg);
  });

  // Main offkickanggota execution function
  const executeOffKickAnggota = async (bot, msg) => {
    if (msg.from.id.toString() !== process.env.ADMIN_ID) {
      return bot.sendMessage(msg.chat.id, 'ente siapa njir🗿');
    }
    
    kickanggotaEnabled = false;
    
    const statusMsg = await bot.sendMessage(msg.chat.id, '❌ <b>Fitur /kickanggota telah DINONAKTIFKAN untuk user biasa</b>\n\n🔒 Hanya admin yang bisa menggunakan perintah /kickanggota', {
      parse_mode: 'HTML'
    });
    
    // Auto delete setelah 3 detik
    setTimeout(async () => {
      try {
        await bot.deleteMessage(msg.chat.id, msg.message_id);
        await bot.deleteMessage(msg.chat.id, statusMsg.message_id);
      } catch (e) {
        // Ignore delete error
      }
    }, 3000);
  };

  // === /statuskick - Cek status fitur kickanggota ===
  bot.onText(/\/statuskick/, async (msg) => {
    if (msg.from.id.toString() !== process.env.ADMIN_ID) {
      return bot.sendMessage(msg.chat.id, 'ente siapa njir🗿');
    }
    
    const status = kickanggotaEnabled ? '✅ AKTIF' : '❌ NONAKTIF';
    const akses = kickanggotaEnabled ? 'Semua user bisa menggunakan /kickanggota' : 'Hanya admin yang bisa menggunakan /kickanggota';
    
    const statusMsg = await bot.sendMessage(msg.chat.id, `📊 <b>STATUS FITUR KICKANGGOTA</b>\n\n🔧 Status: ${status}\n👥 Akses: ${akses}\n\n💡 Gunakan /onkickanggota atau /offkickanggota untuk mengubah`, {
      parse_mode: 'HTML'
    });
    
    // Auto delete setelah 5 detik
    setTimeout(async () => {
      try {
        await bot.deleteMessage(msg.chat.id, msg.message_id);
        await bot.deleteMessage(msg.chat.id, statusMsg.message_id);
      } catch (e) {
        // Ignore delete error
      }
    }, 5000);
  });

  // === /kickanggota ===
  bot.onText(/\/kickanggota/, async (msg) => {
    const isAdmin = msg.from.id.toString() === process.env.ADMIN_ID;
    
    // Cek akses: Admin selalu bisa, user biasa hanya jika fitur diaktifkan
    if (!isAdmin && !kickanggotaEnabled) {
      const accessMsg = await bot.sendMessage(msg.chat.id, '🔒 <b>Fitur ini sedang NONAKTIF untuk user biasa</b>\n\n👑 Hanya admin yang bisa menggunakan perintah ini saat ini\n💡 Admin bisa mengaktifkan dengan /onkickanggota', {
        parse_mode: 'HTML'
      });
      
      // Auto-delete command message dan response
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, msg.message_id);
          await bot.deleteMessage(msg.chat.id, accessMsg.message_id);
        } catch (e) {}
      }, 3000);
      return;
    }
    
    // Jika bukan admin, tampilkan pesan khusus user biasa
    if (!isAdmin) {
      const userMsg = await bot.sendMessage(msg.chat.id, '👤 <b>User Mode Aktif</b>\n\n✅ Fitur kickanggota telah diaktifkan admin untuk semua user\n⏳ Loading menu...', {
        parse_mode: 'HTML'
      });
      
      // Auto delete pesan info setelah 2 detik
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, userMsg.message_id);
        } catch (e) {}
      }, 2000);
    }
    
    adminState.set(msg.chat.id, { 
      mode: 'kick_anggota', 
      step: 'input_nomor',
      isAdmin: isAdmin // Set status admin dengan benar
    });
    
    const statusText = isAdmin ? '👑 <b>ADMIN MODE</b>' : '👤 <b>USER MODE</b>';
    const inputMsg = await bot.sendMessage(msg.chat.id, `🗑️ <b>KICK ANGGOTA</b>\n\n${statusText}\n\nMasukkan nomor anggota yang akan di-kick:\n\n💡 Ketik "exit" untuk membatalkan`, {
      parse_mode: 'HTML'
    });
    
    // Auto-delete command message setelah respons dikirim
    setTimeout(async () => {
      try {
        await bot.deleteMessage(msg.chat.id, msg.message_id);
      } catch (e) {}
    }, 1000);
    
    // Simpan message ID untuk bisa diedit nanti
    const currentState = adminState.get(msg.chat.id);
    currentState.inputMessageId = inputMsg.message_id;
    adminState.set(msg.chat.id, currentState);
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text) return;

    const state = adminState.get(chatId);
    if (!state || state.mode !== 'kick_anggota') return;

    const isAdmin = state.isAdmin; // Ambil status admin dari state yang sudah di-set

    // === CEK CANCEL/EXIT ===
    if (['exit', 'EXIT', 'Exit'].includes(msg.text.trim())) {
      // Hapus pesan input bot dan user
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {
          // Ignore delete error
        }
      }
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        // Ignore delete error
      }
      
      // Kirim notifikasi cancel yang akan hilang 2 detik
      const cancelMsg = await bot.sendMessage(chatId, '❌ Operasi dibatalkan.');
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, cancelMsg.message_id);
        } catch (e) {
          // Ignore delete error
        }
      }, 2000);
      
      adminState.delete(chatId);
      return;
    }

    // === STEP 1: INPUT NOMOR ===
    if (state.step === 'input_nomor') {
      const nomorInput = msg.text.trim();
      
      // Normalisasi nomor
      const { normalizePhoneNumber, isValidIndonesianPhone } = require('./utils/normalize');
      const normalizedNumber = normalizePhoneNumber(nomorInput);
      
      if (!normalizedNumber || !isValidIndonesianPhone(normalizedNumber)) {
        await bot.sendMessage(chatId, '❌ Format nomor tidak valid!\n\n✅ Format yang diterima:\n• 08xxxxxxxxxx\n• 628xxxxxxxxxx\n• 8xxxxxxxxxx');
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      // Hapus pesan input sebelumnya
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {
          // Ignore delete error
        }
      }
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        // Ignore delete error
      }

      // Kirim pesan "mengecek nomor..."
      const checkingMsg = await bot.sendMessage(chatId, '🔍 Mengecek nomor...');

      try {
        // Cek apakah nomor ada di transaksi sukses
        const { db } = require('./db');
        const transaksi = await new Promise((resolve, reject) => {
          db.all(`
            SELECT nomor, anggota, slot_ke, kategori, kuota, user_id 
            FROM stok 
            WHERE anggota = ? AND status = 'freeze'
            ORDER BY id DESC
          `, [normalizedNumber], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
          });
        });

        if (transaksi.length === 0) {
          // Hapus "mengecek nomor..." dan kirim error
          try {
            await bot.deleteMessage(chatId, checkingMsg.message_id);
          } catch (e) {}
          
          const errorMsg = await bot.sendMessage(chatId, '❌ Nomor tidak ditemukan dalam transaksi sukses!\n\nPastikan nomor pernah melakukan transaksi yang berhasil.');
          setTimeout(async () => {
            try {
              await bot.deleteMessage(chatId, errorMsg.message_id);
            } catch (e) {}
          }, 2000);
          
          adminState.delete(chatId);
          return;
        }

        // Nomor ditemukan, hapus "mengecek nomor..." dan lanjut ke step berikutnya
        try {
          await bot.deleteMessage(chatId, checkingMsg.message_id);
        } catch (e) {}

        // Update state dengan data transaksi
        state.nomor_anggota = normalizedNumber;
        state.transaksi_list = transaksi;
        state.step = 'input_kode';
        adminState.set(chatId, state);

        // Kirim pesan nomor ditemukan + request kode
        const kodeMsg = await bot.sendMessage(chatId, `✅ <b>Nomor ditemukan!</b>\n\n📋 Ditemukan ${transaksi.length} transaksi aktif\n\nMasukkan KODE pada transaksi sukses dari nomor ini:\n\n💡 Format: 5 digit terakhir nomor pengelola\n💡 Contoh: 08486\n💡 Ketik "exit" untuk membatalkan`, {
          parse_mode: 'HTML'
        });

        state.inputMessageId = kodeMsg.message_id;
        adminState.set(chatId, state);

      } catch (error) {
        console.error('Error checking nomor:', error);
        
        // Hapus "mengecek nomor..." dan kirim error
        try {
          await bot.deleteMessage(chatId, checkingMsg.message_id);
        } catch (e) {}
        
        const errorMsg = await bot.sendMessage(chatId, `❌ Gagal mengecek nomor: ${error.message}`);
        setTimeout(async () => {
          try {
            await bot.deleteMessage(chatId, errorMsg.message_id);
          } catch (e) {}
        }, 2000);
        
        adminState.delete(chatId);
      }
      return;
    }

    // === STEP 2: INPUT KODE ===
    if (state.step === 'input_kode') {
      const kodeInput = msg.text.trim();
      
      // Validasi format kode (5 digit)
      if (!/^\d{5}$/.test(kodeInput)) {
        await bot.sendMessage(chatId, '❌ Format kode salah!\n\nKode harus 5 digit angka.\nContoh: 08486');
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      // Hapus pesan input sebelumnya
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {}
      }
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}

      // Kirim pesan "Sedang diproses..."
      const processMsg = await bot.sendMessage(chatId, '⏳ <b>Sedang diproses...</b>', { parse_mode: 'HTML' });

      try {
        // Cari transaksi yang sesuai dengan kode
        const validTransaksi = state.transaksi_list.find(t => {
          const nomorPengelola = t.nomor;
          const kodePengelola = nomorPengelola.slice(-5);
          return kodePengelola === kodeInput;
        });

        if (!validTransaksi) {
          // Hapus "Sedang diproses..." dan kirim error
          try {
            await bot.deleteMessage(chatId, processMsg.message_id);
          } catch (e) {}
          
          const errorMsg = await bot.sendMessage(chatId, '❌ Kode tidak valid!\n\nKode tidak cocok dengan transaksi yang ditemukan.\nPastikan kode adalah 5 digit terakhir nomor pengelola yang benar.');
          setTimeout(async () => {
            try {
              await bot.deleteMessage(chatId, errorMsg.message_id);
            } catch (e) {}
          }, 2000);
          
          adminState.delete(chatId);
          return;
        }

        const nomorPengelola = validTransaksi.nomor;
        const slotKe = validTransaksi.slot_ke;
        const kategori = validTransaksi.kategori;

        // === PROSES KICK: HIT API 3 KALI ===
        
        // HIT PERTAMA: Refresh Token (15 detik)
        try {
          await axios.post("https://api.hidepulsa.com/api/akrab", {
            action: "info",
            id_telegram: process.env.ADMIN_ID,
            password: process.env.PASSWORD,
            nomor_hp: nomorPengelola
          }, {
            headers: {
              "Content-Type": "application/json",
              Authorization: process.env.API_KEY
            },
            timeout: 20000 // Timeout 20 detik untuk menghindari crash
          });
          
          // Wait 15 detik untuk refresh token
          await new Promise(resolve => setTimeout(resolve, 15000));
          
        } catch (refreshError) {
          console.warn('Warning: Refresh token failed, continuing with kick...', refreshError.message);
        }

        // HIT KEDUA: Kick Anggota
        try {
          await axios.post("https://api.hidepulsa.com/api/akrab", {
            action: "kick",
            id_telegram: process.env.ADMIN_ID,
            password: process.env.PASSWORD,
            nomor_hp: nomorPengelola,
            nomor_slot: slotKe
          }, {
            headers: {
              "Content-Type": "application/json",
              Authorization: process.env.API_KEY
            },
            timeout: 20000 // Timeout 20 detik untuk menghindari crash
          });
        } catch (kickError) {
          console.warn('Warning: Kick command failed, continuing with verification...', kickError.message);
        }

        // Wait 5 detik sebelum verifikasi
        await new Promise(resolve => setTimeout(resolve, 5000));

        // HIT KETIGA: Verifikasi apakah anggota sudah di-kick
        let isKickSuccessful = false;
        try {
          const verifyResponse = await axios.post("https://api.hidepulsa.com/api/akrab", {
            action: "info",
            id_telegram: process.env.ADMIN_ID,
            password: process.env.PASSWORD,
            nomor_hp: nomorPengelola
          }, {
            headers: {
              "Content-Type": "application/json",
              Authorization: process.env.API_KEY
            },
            timeout: 20000 // Timeout 20 detik untuk menghindari crash
          });

          const slotList = verifyResponse.data?.data?.data_slot || [];
          
          // Cek apakah nomor anggota masih ada di slot yang di-kick
          const targetSlot = slotList.find(slot => slot["slot-ke"] === slotKe);
          
          if (!targetSlot || !targetSlot.nomor || targetSlot.nomor === "" || targetSlot.nomor !== state.nomor_anggota) {
            // Nomor anggota sudah tidak ada di slot = SUKSES
            isKickSuccessful = true;
          } else {
            // Nomor anggota masih ada di slot = GAGAL
            isKickSuccessful = false;
          }

        } catch (verifyError) {
          console.error('Error verifying kick result:', verifyError.message);
          // Jika error verifikasi, anggap gagal
          isKickSuccessful = false;
        }

        // Update database hanya jika kick berhasil
        if (isKickSuccessful) {
          try {
            const { db } = require('./db');
            await new Promise((resolve, reject) => {
              db.run(`
                UPDATE stok 
                SET status = 'allow', anggota = NULL, slot_ke = NULL, expired_at = NULL, kuota = NULL, user_id = NULL
                WHERE nomor = ? AND anggota = ? AND slot_ke = ?
              `, [nomorPengelola, state.nomor_anggota, slotKe], function(err) {
                if (err) return reject(err);
                resolve(this.changes);
              });
            });
          } catch (dbError) {
            console.error('Error updating database:', dbError.message);
          }
        }

        // Hapus "Sedang diproses..." dan kirim hasil
        try {
          await bot.deleteMessage(chatId, processMsg.message_id);
        } catch (e) {}

        const userStatus = isAdmin ? '👑 ADMIN' : '👤 USER';
        let hasilMsg;
        if (isKickSuccessful) {
          hasilMsg = await bot.sendMessage(chatId, `✅ <b>SUKSES kick anggota!</b>\n\n👤 Dieksekusi oleh: ${userStatus}\n📱 Nomor: <code>${state.nomor_anggota}</code>\n🏷️ Kode: <code>${kodeInput}</code>\n📡 Pengelola: <code>${nomorPengelola}</code>\n🎯 Slot: ${slotKe}\n📦 Kategori: ${kategori}\n\n✨ Anggota berhasil di-kick dari slot\n🔄 Status nomor pengelola dikembalikan ke mode 'allow'`, {
            parse_mode: 'HTML'
          });
        } else {
          hasilMsg = await bot.sendMessage(chatId, `❌ <b>GAGAL kick anggota!</b>\n\n👤 Dieksekusi oleh: ${userStatus}\n📱 Nomor: <code>${state.nomor_anggota}</code>\n🏷️ Kode: <code>${kodeInput}</code>\n📡 Pengelola: <code>${nomorPengelola}</code>\n🎯 Slot: ${slotKe}\n📦 Kategori: ${kategori}\n\n⚠️ Anggota masih terdeteksi di slot\n💡 Coba lagi atau hubungi support API`, {
            parse_mode: 'HTML'
          });
        }

        // Auto delete hasil setelah 5 menit (300 detik)
        setTimeout(async () => {
          try {
            await bot.deleteMessage(chatId, hasilMsg.message_id);
          } catch (e) {
            // Ignore delete error
          }
        }, 300000);

      } catch (error) {
        console.error('Error dalam proses kick:', error);
        
        // Hapus "Sedang diproses..." dan kirim error
        try {
          await bot.deleteMessage(chatId, processMsg.message_id);
        } catch (e) {}
        
        const userStatus = isAdmin ? '👑 ADMIN' : '👤 USER';
        const errorMsg = await bot.sendMessage(chatId, `❌ <b>Gagal kick anggota!</b>\n\n👤 Dieksekusi oleh: ${userStatus}\n🔍 Detail Error:\n<code>${error.message}</code>\n\n💡 Kemungkinan penyebab:\n• Koneksi API bermasalah\n• Slot sudah kosong\n• Token expired\n• Timeout network`, {
          parse_mode: 'HTML'
        });
        
        // Auto delete error setelah 5 menit (300 detik)
        setTimeout(async () => {
          try {
            await bot.deleteMessage(chatId, errorMsg.message_id);
          } catch (e) {
            // Ignore delete error
          }
        }, 300000);
      }

      adminState.delete(chatId);
      return;
    }
  });
};
