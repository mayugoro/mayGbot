const axios = require('axios');

module.exports = (bot) => {
  // === Cek saldo dengan teks biasa ===
  bot.on('message', async (msg) => {
    // Cek apakah ini bukan command dan ada text
    if (!msg.text || msg.text.startsWith('/')) return;
    
    // Cek apakah user adalah admin
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;
    
    // Keywords untuk trigger cek saldo
    const saldoKeywords = [
      'cek saldo', 'saldo', 'balance', 'panel saldo', 'saldo panel',
      'cek balance', 'balance panel', 'panel balance', 'uang', 'duit'
    ];
    
    const messageText = msg.text.toLowerCase();
    const isSaldoRequest = saldoKeywords.some(keyword => 
      messageText.includes(keyword)
    );
    
    if (!isSaldoRequest) return;

    // Auto-delete command message
    setTimeout(async () => {
      try {
        await bot.deleteMessage(msg.chat.id, msg.message_id);
      } catch (e) {}
    }, 1000);

    try {
      // Hit API untuk cek saldo
      const response = await axios.post('https://api.hidepulsa.com/api/tools', {
        action: "cek_saldo",
        id_telegram: process.env.ADMIN_ID,
        password: process.env.PASSWORD2
      }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.APIKEY2
        },
        timeout: 15000 // Timeout 15 detik
      });

      // Parse response
      const data = response.data;
      
      if (data.status === 'success' && data.data) {
        const saldoInfo = data.data;
        
        // Format saldo dengan pemisah ribuan
        const formatRupiah = (amount) => {
          return `Rp ${Number(amount).toLocaleString('id-ID')}`;
        };

        // Ambil informasi dari response
        const idTelegram = saldoInfo.id_telegram || 'Unknown';
        const saldo = saldoInfo.saldo || 0;
        const role = saldoInfo.role || 'Unknown';
        
        // Buat pesan dengan format monospace untuk alignment
        let saldoText = `<code>💰 PANEL SALDO REALTIME\n\n`;
        saldoText += `💌 ID anda     : ${idTelegram}\n`;
        saldoText += `📧 Saldo panel : ${formatRupiah(saldo)}\n`;
        saldoText += `🏆 Role anda   : ${role}</code>`;

        const resultMsg = await bot.sendMessage(msg.chat.id, saldoText, {
          parse_mode: 'HTML'
        });

        // Auto delete hasil setelah 5 detik sesuai pesan
        setTimeout(async () => {
          try {
            await bot.deleteMessage(msg.chat.id, resultMsg.message_id);
          } catch (e) {}
        }, 5000);

      } else {
        // Response tidak sesuai format yang diharapkan atau status tidak success
        console.log('⚠️ Unexpected response format:', data);
        
        // Coba parsing alternatif untuk format response yang berbeda
        let saldoText = `<code>💰 PANEL SALDO REALTIME\n\n`;
        
        // Cek apakah ada data saldo langsung di root response
        if (data.saldo) {
          const formatRupiah = (amount) => `Rp ${Number(amount).toLocaleString('id-ID')}`;
          
          saldoText += `💌 ID anda: ${data.id_telegram || 'Unknown'}\n`;
          saldoText += `📧 Saldo panel : ${formatRupiah(data.saldo)}\n`;
          saldoText += `🏆 Role anda: ${data.role || 'Unknown'}</code>`;
        } else {
          // Tampilkan raw response untuk debugging
          saldoText = `❌ <b>Format Response Tidak Dikenal</b>\n\n🔍 <b>Raw Response:</b>\n<code>${JSON.stringify(data, null, 2)}</code>\n\n💡 <b>Info:</b>\n• Silakan screenshot ini untuk debugging\n• Format API mungkin berubah\n• Status: ${data.status || 'Unknown'}\n• Message: ${data.message || 'No message'}`;
        }
        
        const resultMsg = await bot.sendMessage(msg.chat.id, saldoText, {
          parse_mode: 'HTML'
        });

        // Auto delete hasil setelah 5 detik
        setTimeout(async () => {
          try {
            await bot.deleteMessage(msg.chat.id, resultMsg.message_id);
          } catch (e) {}
        }, 5000);
      }

    } catch (error) {
      console.error('Error checking saldo panel:', error);
      
      // Tentukan jenis error
      let errorMessage = '❌ <b>Gagal mengecek saldo panel</b>\n\n';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage += '⏰ <b>Timeout:</b> Server tidak merespons dalam 15 detik\n';
      } else if (error.response) {
        errorMessage += `🌐 <b>HTTP Error:</b> ${error.response.status}\n`;
        errorMessage += `📄 <b>Message:</b> ${error.response.data?.message || 'Unknown error'}\n`;
      } else if (error.request) {
        errorMessage += '🔌 <b>Network Error:</b> Tidak dapat terhubung ke server\n';
      } else {
        errorMessage += `🐛 <b>Error:</b> ${error.message}\n`;
      }
      
      errorMessage += '\n💡 <b>Solusi:</b>\n';
      errorMessage += '• Cek koneksi internet\n';
      errorMessage += '• Pastikan API key valid\n';
      errorMessage += '• Coba lagi beberapa saat\n';
      errorMessage += '• Hubungi admin jika masalah berlanjut';

      const errorMsg = await bot.sendMessage(msg.chat.id, errorMessage, {
        parse_mode: 'HTML'
      });

      // Auto delete error setelah 1 menit
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, errorMsg.message_id);
        } catch (e) {}
      }, 60000);
    }
  });

  // === /testpanel - Test koneksi API (Debug) ===
  bot.onText(/\/testpanel/, async (msg) => {
    if (msg.from.id.toString() !== process.env.ADMIN_ID) {
      return;
    }

    const testMsg = await bot.sendMessage(msg.chat.id, '🧪 <b>Testing API Connection...</b>\n\n📋 <b>Checking:</b>\n• Environment variables\n• API endpoint\n• Network connectivity', {
      parse_mode: 'HTML'
    });

    // Auto-delete command message
    setTimeout(async () => {
      try {
        await bot.deleteMessage(msg.chat.id, msg.message_id);
      } catch (e) {}
    }, 1000);

    let testResult = '🧪 <b>API CONNECTION TEST</b>\n\n';
    
    // Check environment variables
    testResult += '📋 <b>Environment Check:</b>\n';
    testResult += `• ADMIN_ID: ${process.env.ADMIN_ID ? '✅ Set' : '❌ Missing'}\n`;
    testResult += `• PASSWORD: ${process.env.PASSWORD ? '✅ Set' : '❌ Missing'}\n`;
    testResult += `• API_KEY: ${process.env.API_KEY ? '✅ Set' : '❌ Missing'}\n\n`;

    // Test API call
    testResult += '🌐 <b>API Test:</b>\n';
    try {
      const response = await axios.post('https://api.hidepulsa.com/api/tools', {
        action: "cek_saldo",
        id_telegram: process.env.ADMIN_ID,
        password: process.env.PASSWORD2
      }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.APIKEY2  
        },
        timeout: 10000
      });

      testResult += `• Connection: ✅ Success\n`;
      testResult += `• Status Code: ${response.status}\n`;
      testResult += `• Response: ${response.data ? '✅ Data received' : '❌ No data'}\n\n`;
      testResult += `📄 <b>Raw Response:</b>\n<code>${JSON.stringify(response.data, null, 2)}</code>`;

    } catch (error) {
      testResult += `• Connection: ❌ Failed\n`;
      testResult += `• Error: ${error.message}\n`;
      testResult += `• Code: ${error.code || 'Unknown'}\n`;
      if (error.response) {
        testResult += `• HTTP Status: ${error.response.status}\n`;
      }
    }

    // Hapus test message dan kirim hasil
    try {
      await bot.deleteMessage(msg.chat.id, testMsg.message_id);
    } catch (e) {}

    const resultMsg = await bot.sendMessage(msg.chat.id, testResult, {
      parse_mode: 'HTML'
    });

    // Auto delete test result setelah 2 menit
    setTimeout(async () => {
      try {
        await bot.deleteMessage(msg.chat.id, resultMsg.message_id);
      } catch (e) {}
    }, 120000);
  });

  // === /saldoinfo - Info tentang command panel ===
  bot.onText(/\/saldoinfo/, async (msg) => {
    if (msg.from.id.toString() !== process.env.ADMIN_ID) {
      return;
    }

    const infoText = `ℹ️ <b>INFO PANEL SALDO</b>\n\n🔧 <b>Cara Pakai:</b>\n• Ketik kata kunci: "saldo", "cek saldo", "balance"\n• Atau kata: "panel saldo", "uang", "duit"\n\n🔑 <b>Akses:</b>\nHanya admin yang bisa menggunakan\n\n🌐 <b>API Endpoint:</b>\n<code>https://api.hidepulsa.com/api/tools</code>\n\n📊 <b>Data Yang Ditampilkan:</b>\n• ID Telegram\n• Saldo Panel\n• Role User\n\n🔒 <b>Keamanan:</b>\n• Auto-delete setelah 5 detik\n• Hanya admin yang bisa akses\n• Credential dari environment variables\n\n💡 <b>Contoh:</b>\n"Cek saldo dong" atau "Berapa saldo panel?"`;

    const infoMsg = await bot.sendMessage(msg.chat.id, infoText, {
      parse_mode: 'HTML'
    });

    // Auto-delete command message
    setTimeout(async () => {
      try {
        await bot.deleteMessage(msg.chat.id, msg.message_id);
      } catch (e) {}
    }, 1000);

    // Auto delete info setelah 30 detik
    setTimeout(async () => {
      try {
        await bot.deleteMessage(msg.chat.id, infoMsg.message_id);
      } catch (e) {}
    }, 30000);
  });
};
