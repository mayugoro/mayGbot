const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { getJakartaTime, formatJakartaTime, getDompulTimestamp } = require('./utils/date');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// === Inisialisasi tabel ===
const init = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Buat tabel stok
      db.run(`
        CREATE TABLE IF NOT EXISTS stok (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kategori TEXT NOT NULL,
          nomor TEXT NOT NULL,
          pengelola TEXT NOT NULL,
          status TEXT DEFAULT 'allow',
          anggota TEXT,
          slot_ke INTEGER,
          kuota TEXT,
          expired_at TEXT,
          user_id INTEGER
        )
      `, (err) => {
        if (err) {
          console.error("Error creating stok table: ", err.message);
          return reject(err);
        }
        
        // Tambahkan kolom user_id jika belum ada (untuk database existing)
        db.run(`ALTER TABLE stok ADD COLUMN user_id INTEGER`, (alterErr) => {
          // Ignore error jika kolom sudah ada
          if (alterErr && !alterErr.message.includes('duplicate column name')) {
            console.error("Error adding user_id column:", alterErr.message);
          } else if (!alterErr) {
            console.log("user_id column added to stok table.");
          }
        });
      });

      // Buat tabel pengguna
      db.run(`
        CREATE TABLE IF NOT EXISTS pengguna (
          user_id INTEGER PRIMARY KEY,
          username TEXT,
          saldo REAL DEFAULT 0,
          blocked INTEGER DEFAULT 0,
          blocked_at TEXT
        )
      `, (err) => {
        if (err) {
          console.error("Error creating pengguna table: ", err.message);
          return reject(err);
        }
        
        // Add blocked columns if they don't exist (for existing databases)
        db.run(`ALTER TABLE pengguna ADD COLUMN blocked INTEGER DEFAULT 0`, (alterErr) => {
          // Ignore error if column already exists
        });
        db.run(`ALTER TABLE pengguna ADD COLUMN blocked_at TEXT`, (alterErr) => {
          // Ignore error if column already exists  
        });
      });

      // Buat tabel transaction_history untuk menyimpan permanent record
      db.run(`
        CREATE TABLE IF NOT EXISTS transaction_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          username TEXT,
          kategori TEXT NOT NULL,
          nomor TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          expired_at TEXT,
          status TEXT DEFAULT 'completed'
        )
      `, (err) => {
        if (err) {
          console.error("Error creating transaction_history table: ", err.message);
          return reject(err);
        }
      });

      // Buat tabel konfigurasi produk
      db.run(`
        CREATE TABLE IF NOT EXISTS konfigurasi (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          description TEXT
        )
      `, (err) => {
        if (err) {
          console.error("Error creating konfigurasi table: ", err.message);
          return reject(err);
        }
        
        // Insert default values jika belum ada (sistem dasar + produk lokal)
        const defaultConfigs = [
          // === PRODUK LOKAL (BEKASAN) ===
          { key: 'harga_3h', value: '5000', description: 'Harga paket BEKASAN 3H' },
          { key: 'harga_4h', value: '6500', description: 'Harga paket BEKASAN 4H' },
          { key: 'harga_5h', value: '9000', description: 'Harga paket BEKASAN 5H' },
          { key: 'harga_6h', value: '11000', description: 'Harga paket BEKASAN 6H' },
          { key: 'harga_7h', value: '13000', description: 'Harga paket BEKASAN 7H' },
          { key: 'harga_8h', value: '15000', description: 'Harga paket BEKASAN 8H' },
          { key: 'harga_9h', value: '18000', description: 'Harga paket BEKASAN 9H' },
          { key: 'harga_10h', value: '20000', description: 'Harga paket BEKASAN 10H' },
          
          // Deskripsi bekasan lokal
          { key: 'deskripsi_3h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 3H' },
          { key: 'deskripsi_4h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 4H' },
          { key: 'deskripsi_5h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 5H' },
          { key: 'deskripsi_6h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 6H' },
          { key: 'deskripsi_7h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 7H' },
          { key: 'deskripsi_8h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 8H' },
          { key: 'deskripsi_9h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 9H' },
          { key: 'deskripsi_10h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 10H' },

          // === PRODUK LOKAL (BULANAN) ===
          { key: 'harga_supermini', value: '40000', description: 'Harga paket BULANAN SUPERMINI' },
          { key: 'harga_superbig', value: '60000', description: 'Harga paket BULANAN SUPERBIG' },
          { key: 'harga_mini', value: '50000', description: 'Harga paket BULANAN MINI' },
          { key: 'harga_big', value: '55000', description: 'Harga paket BULANAN BIG' },
          { key: 'harga_lite', value: '70000', description: 'Harga paket BULANAN LITE' },
          { key: 'harga_jumbo', value: '75000', description: 'Harga paket BULANAN JUMBO' },
          { key: 'harga_megabig', value: '85000', description: 'Harga paket BULANAN MEGABIG' },
          { key: 'harga_superjumbo', value: '90000', description: 'Harga paket BULANAN SUPER JUMBO' },

          // === PRODUK GLOBAL (BULANAN) - Berdasarkan daftar-paket.js ===
          { key: 'harga_xla14', value: '45000', description: 'Harga paket BULANAN GLOBAL SUPERMINI (XLA14)' },
          { key: 'harga_xla32', value: '55000', description: 'Harga paket BULANAN GLOBAL MINI (XLA32)' },
          { key: 'harga_xla39', value: '60000', description: 'Harga paket BULANAN GLOBAL BIG L (XLA39)' },
          { key: 'harga_xla65', value: '80000', description: 'Harga paket BULANAN GLOBAL JUMBO (XLA65)' },
          { key: 'harga_xla51', value: '82000', description: 'Harga paket BULANAN GLOBAL JUMBO V2 (XLA51)' },
          { key: 'harga_xla89', value: '90000', description: 'Harga paket BULANAN GLOBAL MEGABIG (XLA89)' },
          { key: 'harga_xx', value: '65000', description: 'Harga paket BULANAN GLOBAL BIG PLUS (XX)' },
          
          // Deskripsi bulanan lokal
          { key: 'deskripsi_supermini', value: 'AREA 1 : 13 GB\nAREA 2 : 15 GB\nAREA 3 : 20 GB\nAREA 4 : 30 GB', description: 'Deskripsi kuota BULANAN SUPERMINI' },
          { key: 'deskripsi_superbig', value: 'AREA 1 : 7 GB\nAREA 2 : 12 GB\nAREA 3 : 25 GB\nAREA 4 : 65 GB', description: 'Deskripsi kuota BULANAN SUPERBIG' },
          { key: 'deskripsi_mini', value: 'AREA 1 : 22,5 GB\nAREA 2 : 25,5 GB\nAREA 3 : 34 GB\nAREA 4 : 49 GB', description: 'Deskripsi kuota BULANAN MINI' },
          { key: 'deskripsi_big', value: 'AREA 1 : 38 GB\nAREA 2 : 40 GB\nAREA 3 : 45 GB\nAREA 4 : 55 GB', description: 'Deskripsi kuota BULANAN BIG' },
          { key: 'deskripsi_lite', value: 'AREA 1 : 47 GB\nAREA 2 : 52 GB\nAREA 3 : 65 GB\nAREA 4 : 105 GB', description: 'Deskripsi kuota BULANAN LITE' },
          { key: 'deskripsi_jumbo', value: 'AREA 1 : 66 GB\nAREA 2 : 70 GB\nAREA 3 : 83 GB\nAREA 4 : 123 GB', description: 'Deskripsi kuota BULANAN JUMBO' },
          { key: 'deskripsi_megabig', value: 'AREA 1 : 88 GB\nAREA 2 : 90 GB\nAREA 3 : 95 GB\nAREA 4 : 105 GB', description: 'Deskripsi kuota BULANAN MEGABIG' },
          { key: 'deskripsi_superjumbo', value: 'AREA 1 : 86 GB\nAREA 2 : 91 GB\nAREA 3 : 104 GB\nAREA 4 : 144 GB', description: 'Deskripsi kuota BULANAN SUPER JUMBO' },

          // === DESKRIPSI PRODUK GLOBAL (BULANAN) - Berdasarkan daftar-paket.js ===
          { key: 'deskripsi_xla14', value: 'Kuota Global Unlimited\nSpeed Full Speed\nMasa Aktif 30 Hari\nBonus Kuota Lokal', description: 'Deskripsi BULANAN GLOBAL SUPERMINI (XLA14)' },
          { key: 'deskripsi_xla32', value: 'Kuota Global Unlimited\nSpeed Full Speed\nMasa Aktif 30 Hari\nBonus Kuota Lokal', description: 'Deskripsi BULANAN GLOBAL MINI (XLA32)' },
          { key: 'deskripsi_xla39', value: 'Kuota Global Unlimited\nSpeed Full Speed\nMasa Aktif 30 Hari\nBonus Kuota Lokal', description: 'Deskripsi BULANAN GLOBAL BIG L (XLA39)' },
          { key: 'deskripsi_xla65', value: 'Kuota Global Unlimited\nSpeed Full Speed\nMasa Aktif 30 Hari\nBonus Kuota Lokal', description: 'Deskripsi BULANAN GLOBAL JUMBO (XLA65)' },
          { key: 'deskripsi_xla51', value: 'Kuota Global Unlimited\nSpeed Full Speed\nMasa Aktif 30 Hari\nBonus Kuota Lokal', description: 'Deskripsi BULANAN GLOBAL JUMBO V2 (XLA51)' },
          { key: 'deskripsi_xla89', value: 'Kuota Global Unlimited\nSpeed Full Speed\nMasa Aktif 30 Hari\nBonus Kuota Lokal', description: 'Deskripsi BULANAN GLOBAL MEGABIG (XLA89)' },
          { key: 'deskripsi_xx', value: 'Kuota Global Unlimited\nSpeed Full Speed\nMasa Aktif 30 Hari\nBonus Kuota Lokal', description: 'Deskripsi BULANAN GLOBAL BIG PLUS (XX)' },
          
          // Konfigurasi kuota default untuk bulanan lokal
          { key: 'kuota_supermini', value: '0', description: 'Kuota default BULANAN SUPERMINI (GB)' },
          { key: 'kuota_superbig', value: '0', description: 'Kuota default BULANAN SUPERBIG (GB)' },
          { key: 'kuota_mini', value: '15', description: 'Kuota default BULANAN MINI (GB)' },
          { key: 'kuota_big', value: '25', description: 'Kuota default BULANAN BIG (GB)' },
          { key: 'kuota_lite', value: '20', description: 'Kuota default BULANAN LITE (GB)' },
          { key: 'kuota_jumbo', value: '40', description: 'Kuota default BULANAN JUMBO (GB)' },
          { key: 'kuota_megabig', value: '75', description: 'Kuota default BULANAN MEGABIG (GB)' },
          { key: 'kuota_superjumbo', value: '60', description: 'Kuota default BULANAN SUPER JUMBO (GB)' },

          // NOTE: Kuota untuk produk bulanan global (XLA14, XLA32, etc) tidak perlu dikonfigurasi
          // karena sudah diatur otomatis oleh API KHFY-STORE

          // === KONFIGURASI SISTEM ===
          { key: 'harga_gagal', value: '700', description: 'Harga yang dipotong jika transaksi gagal' },
          { key: 'min_saldo_bekasan', value: '5000', description: 'Minimal saldo untuk akses menu bekasan' },
          { key: 'min_saldo_bulanan', value: '100000', description: 'Minimal saldo untuk akses menu bulanan' },
          { key: 'min_saldo_global', value: '150000', description: 'Minimal saldo untuk akses menu global' },
          { key: 'pesan_tolak_bekasan', value: 'Saldo tidak cukup untuk akses menu ini\n\n⏤͟͟ᴍᴀʏᴜɢᴏʀᴏ', description: 'Pesan penolakan akses bekasan' },
          { key: 'pesan_tolak_bulanan', value: 'Saldo tidak cukup untuk akses menu ini\n\n⏤͟͟ᴍᴀʏᴜɢᴏʀᴏ', description: 'Pesan penolakan akses bulanan' },
          { key: 'pesan_tolak_global', value: 'Saldo tidak cukup untuk akses menu global\n\n⏤͟͟ᴍᴀʏᴜɢᴏʀᴏ', description: 'Pesan penolakan akses global' },

          // Harga Global Bekasan (masih menggunakan sistem lama karena tidak ada API dinamis untuk bekasan global)
          { key: 'harga_bekasan_global_l_3h', value: '12000', description: 'Harga BEKASAN GLOBAL L 3H' },
          { key: 'harga_bekasan_global_l_5h', value: '15000', description: 'Harga BEKASAN GLOBAL L 5H' },
          { key: 'harga_bekasan_global_l_7h', value: '18000', description: 'Harga BEKASAN GLOBAL L 7H' },
          { key: 'harga_bekasan_global_l_9h', value: '21000', description: 'Harga BEKASAN GLOBAL L 9H' },
          { key: 'harga_bekasan_global_l_11h', value: '24000', description: 'Harga BEKASAN GLOBAL L 11H' },
          { key: 'harga_bekasan_global_l_13h', value: '27000', description: 'Harga BEKASAN GLOBAL L 13H' },
          { key: 'harga_bekasan_global_l_15h', value: '30000', description: 'Harga BEKASAN GLOBAL L 15H' },
          { key: 'harga_bekasan_global_l_17h', value: '33000', description: 'Harga BEKASAN GLOBAL L 17H' },
          { key: 'harga_bekasan_global_l_19h', value: '36000', description: 'Harga BEKASAN GLOBAL L 19H' },

          // Harga Global Bekasan XL
          { key: 'harga_bekasan_global_xl_3h', value: '15000', description: 'Harga BEKASAN GLOBAL XL 3H' },
          { key: 'harga_bekasan_global_xl_5h', value: '19000', description: 'Harga BEKASAN GLOBAL XL 5H' },
          { key: 'harga_bekasan_global_xl_7h', value: '23000', description: 'Harga BEKASAN GLOBAL XL 7H' },
          { key: 'harga_bekasan_global_xl_9h', value: '27000', description: 'Harga BEKASAN GLOBAL XL 9H' },
          { key: 'harga_bekasan_global_xl_11h', value: '31000', description: 'Harga BEKASAN GLOBAL XL 11H' },
          { key: 'harga_bekasan_global_xl_13h', value: '35000', description: 'Harga BEKASAN GLOBAL XL 13H' },
          { key: 'harga_bekasan_global_xl_15h', value: '39000', description: 'Harga BEKASAN GLOBAL XL 15H' },
          { key: 'harga_bekasan_global_xl_17h', value: '43000', description: 'Harga BEKASAN GLOBAL XL 17H' },
          { key: 'harga_bekasan_global_xl_19h', value: '47000', description: 'Harga BEKASAN GLOBAL XL 19H' },

          // Harga Global Bekasan XXL  
          { key: 'harga_bekasan_global_xxl_3h', value: '18000', description: 'Harga BEKASAN GLOBAL XXL 3H' },
          { key: 'harga_bekasan_global_xxl_5h', value: '23000', description: 'Harga BEKASAN GLOBAL XXL 5H' },
          { key: 'harga_bekasan_global_xxl_7h', value: '28000', description: 'Harga BEKASAN GLOBAL XXL 7H' },
          { key: 'harga_bekasan_global_xxl_9h', value: '33000', description: 'Harga BEKASAN GLOBAL XXL 9H' },
          { key: 'harga_bekasan_global_xxl_11h', value: '38000', description: 'Harga BEKASAN GLOBAL XXL 11H' },
          { key: 'harga_bekasan_global_xxl_13h', value: '43000', description: 'Harga BEKASAN GLOBAL XXL 13H' },
          { key: 'harga_bekasan_global_xxl_15h', value: '48000', description: 'Harga BEKASAN GLOBAL XXL 15H' },
          { key: 'harga_bekasan_global_xxl_17h', value: '53000', description: 'Harga BEKASAN GLOBAL XXL 17H' },
          { key: 'harga_bekasan_global_xxl_19h', value: '58000', description: 'Harga BEKASAN GLOBAL XXL 19H' }
        ];

        defaultConfigs.forEach(config => {
          db.run('INSERT OR IGNORE INTO konfigurasi (key, value, description) VALUES (?, ?, ?)', 
            [config.key, config.value, config.description]);
        });
      });

      // Buat tabel produk dinamis untuk menyimpan data API
      db.run(`
        CREATE TABLE IF NOT EXISTS produk_dinamis (
          kode_produk TEXT PRIMARY KEY,
          nama_produk TEXT NOT NULL,
          kategori TEXT NOT NULL,
          harga_api INTEGER NOT NULL,
          harga_markup INTEGER NULL,
          deskripsi TEXT,
          status_api TEXT DEFAULT 'active',
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error("Error creating produk_dinamis table: ", err.message);
          return reject(err);
        }
        //console.log("✅ Tabel produk_dinamis berhasil dibuat/divalidasi");
      });

      // Buat tabel redeem_codes
      db.run(`
        CREATE TABLE IF NOT EXISTS redeem_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          nominal INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          used_at DATETIME NULL,
          used_by INTEGER NULL,
          used BOOLEAN DEFAULT 0
        )
      `, (err) => {
        if (err) {
          console.error("Error creating redeem_codes table: ", err.message);
          return reject(err);
        }
      });

      // Buat tabel kick_schedule
      db.run(`
        CREATE TABLE IF NOT EXISTS kick_schedule (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id TEXT NOT NULL,
          nomor_hp TEXT NOT NULL,
          jam INTEGER NOT NULL,
          menit INTEGER NOT NULL,
          target_time TEXT NOT NULL,
          target_date TEXT NULL,
          schedule_type TEXT DEFAULT 'time_only',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'active'
        )
      `, (err) => {
        if (err) {
          console.error("Error creating kick_schedule table: ", err.message);
          return reject(err);
        }
        
        // Add new columns for existing tables (backward compatibility)
        db.run(`ALTER TABLE kick_schedule ADD COLUMN target_date TEXT NULL`, (alterErr) => {
          // Ignore error jika kolom sudah ada
          if (alterErr && !alterErr.message.includes('duplicate column name')) {
            console.error("Error adding target_date column:", alterErr.message);
          } else if (!alterErr) {
            console.log("target_date column added to kick_schedule table.");
          }
        });
        
        db.run(`ALTER TABLE kick_schedule ADD COLUMN schedule_type TEXT DEFAULT 'time_only'`, (alterErr) => {
          // Ignore error jika kolom sudah ada
          if (alterErr && !alterErr.message.includes('duplicate column name')) {
            console.error("Error adding schedule_type column:", alterErr.message);
          } else if (!alterErr) {
            console.log("schedule_type column added to kick_schedule table.");
          }
        });
        
        resolve();
      });
    });
  });
};

// === Tambah stok (admin input) ===
const addStok = (kategori, nomor, pengelola) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO stok (kategori, nomor, pengelola, status)
      VALUES (?, ?, ?, 'allow')
    `);
    stmt.run(kategori.toUpperCase(), nomor, pengelola, function (err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
    stmt.finalize();
  });
};

// === Ambil stok aktif (mode allow & belum expired) ===
const getStok = (kategori) => {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.all(`
      SELECT nomor FROM stok
      WHERE kategori = ? AND status = 'allow'
      AND (expired_at IS NULL OR expired_at > ?)
    `, [kategori.toUpperCase(), now], (err, rows) => {
      if (err) return reject(err);
      const hasil = rows.map(r => r.nomor);
      resolve(hasil);
    });
  });
};

// === Update saldo pengguna ===
const updateSaldo = (userId, newSaldo) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE pengguna SET saldo = ? WHERE user_id = ?', [newSaldo, userId], function(err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
};

// === Tambah saldo pengguna (dengan auto-create user jika belum ada) ===
const tambahSaldo = (userId, jumlah) => {
  return new Promise((resolve, reject) => {
    // Cek apakah user sudah ada
    db.get('SELECT user_id FROM pengguna WHERE user_id = ?', [userId], (err, row) => {
      if (err) return reject(err);
      
      if (!row) {
        // User belum ada, buat user baru
        db.run('INSERT INTO pengguna (user_id, username, saldo) VALUES (?, ?, ?)', 
          [userId, `user_${userId}`, jumlah], function(err) {
          if (err) return reject(err);
          resolve(this.changes);
        });
      } else {
        // User sudah ada, tambah saldo
        db.run('UPDATE pengguna SET saldo = saldo + ? WHERE user_id = ?', [jumlah, userId], function(err) {
          if (err) return reject(err);
          resolve(this.changes);
        });
      }
    });
  });
};

// === Kurangi saldo pengguna (dengan auto-create user jika belum ada) ===
const kurangiSaldo = (userId, jumlah) => {
  return new Promise((resolve, reject) => {
    // Cek apakah user sudah ada
    db.get('SELECT user_id FROM pengguna WHERE user_id = ?', [userId], (err, row) => {
      if (err) return reject(err);
      
      if (!row) {
        // User belum ada, buat user baru dengan saldo 0 lalu kurangi
        db.run('INSERT INTO pengguna (user_id, username, saldo) VALUES (?, ?, ?)', 
          [userId, `user_${userId}`, -jumlah], function(err) {
          if (err) return reject(err);
          resolve(this.changes);
        });
      } else {
        // User sudah ada, kurangi saldo
        db.run('UPDATE pengguna SET saldo = saldo - ? WHERE user_id = ?', [jumlah, userId], function(err) {
          if (err) return reject(err);
          resolve(this.changes);
        });
      }
    });
  });
};

// === Ambil saldo pengguna (dengan auto-create user jika belum ada + auto-unblock) ===
const getUserSaldo = (userId, username = null) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT saldo, username, blocked FROM pengguna WHERE user_id = ?', [userId], (err, row) => {
      if (err) return reject(err);
      
      if (!row) {
        // User belum ada, buat user baru dengan username yang benar
        const finalUsername = username || `user_${userId}`;
        db.run('INSERT INTO pengguna (user_id, username, saldo, blocked) VALUES (?, ?, ?, ?)', 
          [userId, finalUsername, 0, 0], function(err) {
          if (err) return reject(err);
          resolve(0);
        });
      } else {
        // === AUTO-UNBLOCK USER YANG KEMBALI AKTIF ===
        if (row.blocked === 1) {
          console.log(`🔓 Auto-unblocking user ${userId} (user is active again)`);
          db.run('UPDATE pengguna SET blocked = 0, blocked_at = NULL WHERE user_id = ?', [userId], (unblockErr) => {
            if (unblockErr) {
              console.error('Error auto-unblocking user:', unblockErr);
            } else {
              console.log(`✅ User ${userId} has been auto-unblocked`);
            }
          });
        }
        
        // User sudah ada, update username jika berubah dan bukan default username
        if (username && username !== row.username && !username.startsWith('user_')) {
          db.run('UPDATE pengguna SET username = ? WHERE user_id = ?', [username, userId], (updateErr) => {
            if (updateErr) console.error('Error updating username:', updateErr);
            resolve(row.saldo);
          });
        } else {
          resolve(row.saldo);
        }
      }
    });
  });
};

// === Tandai stok sebagai FREEZE dengan detail slot, kuota, anggota ===
const freezeStok = (kategori, nomor, anggota, slotKe, kuota = "0", userId = null, bot = null, saldoData = null) => {
  return new Promise((resolve, reject) => {
    let durasi;
    
    // Tentukan durasi berdasarkan jenis paket
    if (['3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H'].includes(kategori.toUpperCase())) {
      // BEKASAN: gunakan angka dari kategori + 1 hari
      durasi = parseInt(kategori.replace('H', '')) + 1;
    } else if (['SUPERMINI', 'MINI', 'BIG', 'LITE', 'JUMBO', 'MEGABIG'].includes(kategori.toUpperCase())) {
      // BULANAN: tetap disimpan 31 hari
      durasi = 31;
    } else {
      // Default fallback
      durasi = parseInt(kategori) || 31;
    }
    
    const expiredAt = new Date(Date.now() + durasi * 86400000).toISOString();
    
    // Langsung update tanpa ALTER TABLE karena sudah dilakukan di init()
    db.run(`
      UPDATE stok
      SET status = 'freeze', anggota = ?, expired_at = ?, slot_ke = ?, kuota = ?, user_id = ?
      WHERE id = (
        SELECT id FROM stok
        WHERE kategori = ? AND nomor = ? AND status = 'allow'
        LIMIT 1
      )
    `, [anggota, expiredAt, slotKe, kuota, userId, kategori.toUpperCase(), nomor], function (err) {
      if (err) return reject(err);
      
      // Jika berhasil update stok, simpan ke transaction_history
      if (this.changes > 0) {
        // Ambil username untuk history
        db.get("SELECT username FROM pengguna WHERE user_id = ?", [userId], async (err, user) => {
          const username = user ? user.username : null;
          
          // Insert ke transaction_history
          db.run(`
            INSERT INTO transaction_history (user_id, username, kategori, nomor, created_at, expired_at, status)
            VALUES (?, ?, ?, ?, datetime('now'), ?, 'completed')
          `, [userId, username, kategori.toUpperCase(), nomor, expiredAt], async (err) => {
            if (err) {
              console.error('Warning: Failed to save transaction history:', err.message);
            }
            
            // Log transaksi ke grup/channel (jika bot tersedia)
            if (bot && userId) {
              try {
                const { logTransaction } = require('./transaction_logger');
                const logData = {
                  userId,
                  username,
                  kategori: kategori.toUpperCase(),
                  nomor: anggota, // Nomor customer/pembeli
                  pengelola: nomor, // Nomor pengelola  
                  status: 'completed',
                  provider: 'SISTEM'
                };
                
                // Tambahkan data saldo jika tersedia
                if (saldoData) {
                  logData.saldoSebelum = saldoData.saldoSebelum;
                  logData.saldoSesudah = saldoData.saldoSesudah;
                  logData.harga = saldoData.harga;
                }
                
                await logTransaction(bot, logData);
              } catch (logError) {
                console.error('Warning: Failed to log transaction:', logError.message);
              }
            }
            
            // Lanjut resolve meskipun history gagal
            resolve(this.changes);
          });
        });
      } else {
        resolve(this.changes);
      }
    });
  });
};

// === Hapus stok tertentu ===
const deleteStok = (kategori, nomor) => {
  return new Promise((resolve, reject) => {
    db.run(`
      DELETE FROM stok WHERE kategori = ? AND nomor = ?
    `, [kategori.toUpperCase(), nomor], function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
};

// === Hapus stok tertentu (HANYA 1 RECORD SAJA) - Function baru ===
const deleteSingleStok = (kategori, nomor) => {
  return new Promise((resolve, reject) => {
    db.run(`
      DELETE FROM stok 
      WHERE id = (
        SELECT id FROM stok 
        WHERE kategori = ? AND nomor = ? 
        LIMIT 1
      )
    `, [kategori.toUpperCase(), nomor], function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
};

// === Kosongkan stok berdasarkan kategori ===
const clearStokKategori = (kategori) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM stok WHERE kategori = ?`, [kategori.toUpperCase()], function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
};

// === Hitung stok per kategori ===
const countStok = (kategori) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) AS jumlah FROM stok WHERE kategori = ?`, [kategori.toUpperCase()], (err, row) => {
      if (err) return reject(err);
      resolve(row.jumlah);
    });
  });
};

// === Hitung semua stok per kategori ===
const countAllStok = () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT kategori, COUNT(*) as jumlah FROM stok GROUP BY kategori`, [], (err, rows) => {
      if (err) return reject(err);
      const result = {};
      for (const row of rows) {
        result[row.kategori.toUpperCase()] = row.jumlah;
      }
      resolve(result);
    });
  });
};

// === Hapus semua yang expired ===
const cleanExpired = () => {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(`
      DELETE FROM stok WHERE status = 'freeze' AND expired_at IS NOT NULL AND expired_at <= ?
    `, [now], function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
};

// === Tambah pengguna (admin input) ===
const addPengguna = (userId, username, saldo = 0) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO pengguna (user_id, username, saldo)
      VALUES (?, ?, ?)
    `);
    stmt.run(userId, username, saldo, function (err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
    stmt.finalize();
  });
};

// === Ambil semua user untuk broadcast (exclude blocked) ===
const getAllUsers = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT user_id, username FROM pengguna WHERE blocked = 0 OR blocked IS NULL', [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// === Ambil user berdasarkan filter saldo ===
const getUsersBySaldo = (minSaldo = 0, maxSaldo = null) => {
  return new Promise((resolve, reject) => {
    let query = 'SELECT user_id, username, saldo FROM pengguna WHERE saldo >= ?';
    let params = [minSaldo];
    
    if (maxSaldo !== null) {
      query += ' AND saldo <= ?';
      params.push(maxSaldo);
    }
    
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// === Hitung total user ===
const getTotalUsers = () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as total FROM pengguna', [], (err, row) => {
      if (err) return reject(err);
      resolve(row.total);
    });
  });
};

// === Log broadcast (opsional untuk tracking) ===
const logBroadcast = (adminId, message, targetCount, successCount) => {
  return new Promise((resolve, reject) => {
    // Buat tabel log jika belum ada
    db.run(`
      CREATE TABLE IF NOT EXISTS broadcast_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        message TEXT,
        target_count INTEGER,
        success_count INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) return reject(err);
      
      // Insert log
      db.run(`
        INSERT INTO broadcast_log (admin_id, message, target_count, success_count)
        VALUES (?, ?, ?, ?)
      `, [adminId, message, targetCount, successCount], function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      });
    });
  });
};

// === Get konfigurasi by key ===
const getKonfigurasi = (key) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM konfigurasi WHERE key = ?', [key], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.value : null);
    });
  });
};

// === Set konfigurasi ===
const setKonfigurasi = (key, value, description = null) => {
  return new Promise((resolve, reject) => {
    const query = description 
      ? 'INSERT OR REPLACE INTO konfigurasi (key, value, description) VALUES (?, ?, ?)'
      : 'UPDATE konfigurasi SET value = ? WHERE key = ?';
    
    const params = description ? [key, value, description] : [value, key];
    
    db.run(query, params, function(err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
};

// === Get semua konfigurasi ===
const getAllKonfigurasi = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT key, value, description FROM konfigurasi ORDER BY key', [], (err, rows) => {
      if (err) return reject(err);
      const result = {};
      for (const row of rows) {
        result[row.key] = { value: row.value, description: row.description };
      }
      resolve(result);
    });
  });
};

// === Get harga paket berdasarkan kategori/kode produk dinamis ===
const getHargaPaket = async (kategori) => {
  const key = `harga_${kategori.toLowerCase()}`;
  const harga = await getKonfigurasi(key);
  return harga ? parseInt(harga) : 0;
};

// === Get harga paket dengan prioritas kode produk dinamis (VERSI BARU) ===
const getHargaPaketDynamic = async (kodeProduK, fallbackKategori = null) => {
  try {
    // Priority 1: Cari di tabel produk_dinamis
    const hargaFinal = await getHargaFinalProduk(kodeProduK);
    if (hargaFinal > 0) {
      return hargaFinal;
    }
    
    // Priority 2: Fallback ke sistem konfigurasi lama
    let key = `harga_${kodeProduK.toLowerCase()}`;
    let harga = await getKonfigurasi(key);
    
    if (harga) {
      return parseInt(harga);
    }
    
    // Priority 3: Cari berdasarkan global prefix + kode produk
    key = `harga_global_${kodeProduK.toLowerCase()}`;
    harga = await getKonfigurasi(key);
    
    if (harga) {
      return parseInt(harga);
    }
    
    // Priority 4: Fallback ke kategori lama jika ada
    if (fallbackKategori) {
      key = `harga_${fallbackKategori.toLowerCase()}`;
      harga = await getKonfigurasi(key);
      
      if (harga) {
        return parseInt(harga);
      }
    }
    
    // Default: return 0 jika tidak ditemukan
    return 0;
  } catch (error) {
    console.error('Error in getHargaPaketDynamic:', error);
    return 0;
  }
};

// === Get deskripsi paket berdasarkan kategori ===
const getDeskripsiPaket = async (kategori) => {
  const key = `deskripsi_${kategori.toLowerCase()}`;
  return await getKonfigurasi(key) || '';
};

// === Get harga gagal transaksi ===
const getHargaGagal = async () => {
  const harga = await getKonfigurasi('harga_gagal');
  return harga ? parseInt(harga) : 700;
};

// === Get minimal saldo bekasan ===
const getMinSaldoBekasan = async () => {
  const saldo = await getKonfigurasi('min_saldo_bekasan');
  return saldo ? parseInt(saldo) : 5000;
};

// === Get kuota paket bulanan ===
const getKuotaPaket = async (kategori) => {
  const key = `kuota_${kategori.toLowerCase()}`;
  const kuota = await getKonfigurasi(key);
  return kuota || '100';
};

// === FUNGSI PRODUK DINAMIS ===

// REMOVED: syncProdukFromAPI - manual tools digunakan untuk sync produk

// Get semua produk dinamis
const getAllProdukDinamis = (kategori = null) => {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM produk_dinamis WHERE 1=1';
    const params = [];
    
    if (kategori) {
      query += ' AND kategori = ?';
      params.push(kategori);
    }
    
    query += ' ORDER BY nama_produk ASC';
    
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// Get produk dinamis berdasarkan kode
const getProdukDinamis = (kodeProduK) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM produk_dinamis WHERE kode_produk = ?', [kodeProduK.toUpperCase()], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

// Update harga markup produk
const updateHargaMarkup = (kodeProduK, hargaMarkup) => {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE produk_dinamis 
      SET harga_markup = ?, last_updated = CURRENT_TIMESTAMP 
      WHERE kode_produk = ?
    `, [hargaMarkup, kodeProduK.toUpperCase()], function(err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
};

// Get harga final produk (markup jika ada, atau harga API)
const getHargaFinalProduk = (kodeProduK) => {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        harga_markup, 
        harga_api,
        CASE 
          WHEN harga_markup IS NOT NULL AND harga_markup > 0 THEN harga_markup
          ELSE harga_api
        END as harga_final
      FROM produk_dinamis 
      WHERE kode_produk = ?
    `, [kodeProduK.toUpperCase()], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.harga_final : 0);
    });
  });
};

// REMOVED: Auto-sync functions - manual tools digunakan untuk fetch API KHFY

// REMOVED: syncProdukFromAPIPreserveMarkup - manual tools digunakan untuk sync produk

// Jalankan fungsi init() dan tunggu sampai selesai
init().then(() => {
  // console.log("✅ Database initialized successfully");
  // NOTE: Auto-sync ke API KHFY sudah dihapus - gunakan manual tools untuk fetch data
  
}).catch((err) => {
  console.error("Database initialization failed:", err);
});

// === FUNGSI CODE REDEEM ===

// Create new redeem code
const createCode = (code, nominal) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO redeem_codes (code, nominal)
      VALUES (?, ?)
    `);
    stmt.run(code, nominal, function (err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
    stmt.finalize();
  });
};

// Get code information
const getCodeInfo = (code) => {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM redeem_codes
      WHERE code = ?
    `, [code], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

// Mark code as used
const useCode = (code, userId) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      UPDATE redeem_codes
      SET used = 1, used_at = CURRENT_TIMESTAMP, used_by = ?
      WHERE code = ? AND used = 0
    `);
    stmt.run(userId, code, function (err) {
      if (err) return reject(err);
      if (this.changes === 0) {
        return reject(new Error('Code not found or already used'));
      }
      resolve(this.changes);
    });
    stmt.finalize();
  });
};

// Get all codes (for admin)
const getAllCodes = () => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT r.*, p.username
      FROM redeem_codes r
      LEFT JOIN pengguna p ON r.used_by = p.user_id
      ORDER BY r.created_at DESC
    `, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// Get transaction count dari history table (permanent)
const getUserTransactionCount = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT COUNT(*) as count
      FROM transaction_history
      WHERE user_id = ? AND status = 'completed'
    `, [userId], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.count : 0);
    });
  });
};

// Get all users dengan transaction count dari history
const getUsersWithHistoryCount = () => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        p.user_id,
        CASE 
          WHEN p.username LIKE 'user_%' THEN NULL
          ELSE p.username
        END as username,
        p.saldo,
        COALESCE(
          (SELECT COUNT(*) FROM transaction_history th 
           WHERE th.user_id = p.user_id AND th.status = 'completed'),
          0
        ) as total_transactions
      FROM pengguna p
      ORDER BY p.user_id ASC
    `, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// === Functions untuk kick schedule ===
const addKickSchedule = (chatId, nomorHp, jam, menit, targetTime, targetDate = null, scheduleType = 'time_only') => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO kick_schedule (chat_id, nomor_hp, jam, menit, target_time, target_date, schedule_type) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([chatId, nomorHp, jam, menit, targetTime, targetDate, scheduleType], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
    
    stmt.finalize();
  });
};

const getKickSchedules = (chatId) => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM kick_schedule 
      WHERE chat_id = ? AND status = 'active' 
      ORDER BY jam, menit
    `, [chatId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const getAllKickSchedules = () => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM kick_schedule 
      WHERE status = 'active' 
      ORDER BY chat_id, jam, menit
    `, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const deleteKickSchedule = (chatId, nomorHp = null) => {
  return new Promise((resolve, reject) => {
    let query = `UPDATE kick_schedule SET status = 'cancelled' WHERE chat_id = ?`;
    let params = [chatId];
    
    if (nomorHp) {
      query += ` AND nomor_hp = ?`;
      params.push(nomorHp);
    }
    
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

const completeKickSchedule = (chatId, nomorHp) => {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE kick_schedule 
      SET status = 'completed' 
      WHERE chat_id = ? AND nomor_hp = ? AND status = 'active'
    `, [chatId, nomorHp], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

// === Get all unique pengelola numbers by kategori ===
const getAllPengelolaNumbers = (kategori) => {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.all(`
      SELECT DISTINCT pengelola FROM stok
      WHERE kategori = ? AND status = 'allow'
      AND (expired_at IS NULL OR expired_at > ?)
      ORDER BY pengelola
    `, [kategori.toUpperCase(), now], (err, rows) => {
      if (err) return reject(err);
      const pengelolaList = rows.map(r => r.pengelola);
      resolve(pengelolaList);
    });
  });
};

// === Function untuk auto-unblock user saat ada aktivitas ===
const autoUnblockIfActive = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT blocked FROM pengguna WHERE user_id = ?', [userId], (err, row) => {
      if (err) return reject(err);
      
      if (row && row.blocked === 1) {
        // User di-block, tapi sedang aktif -> auto-unblock
        db.run(`
          UPDATE pengguna 
          SET blocked = 0, blocked_at = NULL 
          WHERE user_id = ?
        `, [userId], function(unblockErr) {
          if (unblockErr) {
            reject(unblockErr);
          } else {
            console.log(`🔓 Auto-unblocked user ${userId} (detected activity)`);
            resolve(true); // User was unblocked
          }
        });
      } else {
        resolve(false); // User was not blocked
      }
    });
  });
};

// === Function untuk unblock user (saat user kembali aktif) ===
const unblockUser = (userId) => {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE pengguna 
      SET blocked = 0, blocked_at = NULL 
      WHERE user_id = ?
    `, [userId], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

// === Function untuk mark blocked users ===
const markUserBlocked = (userId) => {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE pengguna 
      SET blocked = 1, blocked_at = datetime('now') 
      WHERE user_id = ?
    `, [userId], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

// === Function untuk cleanup blocked users ===
const removeBlockedUsers = () => {
  return new Promise((resolve, reject) => {
    db.run(`
      DELETE FROM pengguna 
      WHERE blocked = 1
    `, [], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

// === Function untuk get blocked users count ===
const getBlockedUsersCount = () => {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT COUNT(*) as count 
      FROM pengguna 
      WHERE blocked = 1
    `, [], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row.count);
      }
    });
  });
};

// === Function untuk tracking nomor ke pengelola sebelumnya ===
const getLastPengelolaForNumber = (nomorCustomer, kategori = null, daysPeriod = 30) => {
  return new Promise((resolve, reject) => {
    // Import normalize function
    const { normalizePhoneNumber, formatForLogger } = require('./utils/normalize');
    
    // Generate kedua format nomor (08 dan 62)
    const searchNumbers = generateSearchNumbers(nomorCustomer);
    
    // Step 1: Cari transaksi terakhir dulu
    let findLastTransactionQuery = `
      SELECT 
        MAX(CASE WHEN th.created_at IS NOT NULL THEN th.created_at ELSE s.expired_at END) as last_transaction_date
      FROM stok s
      LEFT JOIN transaction_history th ON (
        th.user_id = s.user_id AND 
        th.kategori = s.kategori AND
        th.nomor = s.anggota
      )
      WHERE s.anggota IN (${searchNumbers.map(() => '?').join(',')})
      AND s.status = 'freeze'
    `;
    
    db.get(findLastTransactionQuery, searchNumbers, (err, lastTxRow) => {
      if (err) return reject(err);
      
      if (!lastTxRow || !lastTxRow.last_transaction_date) {
        // Tidak ada transaksi sama sekali
        return resolve([]);
      }
      
      const lastTransactionDate = new Date(lastTxRow.last_transaction_date);
      const now = new Date();
      const daysDiff = Math.floor((now - lastTransactionDate) / (1000 * 60 * 60 * 24));
      
      // Jika transaksi terakhir lebih dari daysPeriod hari, return kosong
      if (daysDiff > daysPeriod) {
        console.log(`⏰ Transaksi terakhir: ${daysDiff} hari yang lalu (melebihi batas ${daysPeriod} hari)`);
        return resolve([]);
      }
      
      // Step 2: Ambil data dari tanggal transaksi terakhir (bukan dari daysPeriod hari yang lalu)
      // Hitung cutoff berdasarkan transaksi terakhir
      const cutoffDate = new Date(lastTransactionDate.getTime() - (daysPeriod * 24 * 60 * 60 * 1000));
      const cutoffDateStr = cutoffDate.toISOString();
      
      let query = `
        SELECT 
          s.pengelola,
          s.kategori,
          s.anggota as nomor_customer,
          s.expired_at,
          th.created_at as transaction_date,
          th.username,
          CASE WHEN th.created_at IS NOT NULL THEN th.created_at ELSE s.expired_at END as sort_date
        FROM stok s
        LEFT JOIN transaction_history th ON (
          th.user_id = s.user_id AND 
          th.kategori = s.kategori AND
          th.nomor = s.anggota
        )
        WHERE s.anggota IN (${searchNumbers.map(() => '?').join(',')})
        AND s.status = 'freeze'
        AND (th.created_at IS NULL OR th.created_at >= ?)
      `;
      
      let params = [...searchNumbers, cutoffDateStr];
      
      // Filter berdasarkan kategori jika diminta
      if (kategori) {
        query += ' AND s.kategori = ?';
        params.push(kategori.toUpperCase());
      }
      
      query += `
        ORDER BY sort_date DESC
        LIMIT 5
      `;
      
      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        
        // Tambahkan informasi umur transaksi
        const enhancedRows = rows.map(row => ({
          ...row,
          days_ago: Math.floor((now - new Date(row.sort_date)) / (1000 * 60 * 60 * 24)),
          is_recent: daysDiff <= daysPeriod
        }));
        
        resolve(enhancedRows);
      });
    });
  });
};

// === Function helper untuk generate format nomor pencarian ===
const generateSearchNumbers = (inputNumber) => {
  const { normalizePhoneNumber } = require('./utils/normalize');
  
  if (!inputNumber || typeof inputNumber !== 'string') return [inputNumber];
  
  const cleanNumber = inputNumber.replace(/\D/g, '');
  const searchNumbers = [];
  
  // Tambahkan nomor asli
  searchNumbers.push(inputNumber);
  
  // Format 1: 08xxxxxxxxx (normalized)
  const normalized = normalizePhoneNumber(inputNumber);
  if (normalized && !searchNumbers.includes(normalized)) {
    searchNumbers.push(normalized);
  }
  
  // Format 2: 62xxxxxxxxx (international)
  if (cleanNumber.startsWith('08')) {
    const international = '62' + cleanNumber.substring(1);
    if (!searchNumbers.includes(international)) {
      searchNumbers.push(international);
    }
  } else if (cleanNumber.startsWith('628')) {
    const international = cleanNumber;
    if (!searchNumbers.includes(international)) {
      searchNumbers.push(international);
    }
  } else if (cleanNumber.startsWith('8') && cleanNumber.length >= 10) {
    // Format 8xxxxxxxxx
    const withZero = '0' + cleanNumber;
    const international = '62' + cleanNumber;
    if (!searchNumbers.includes(withZero)) {
      searchNumbers.push(withZero);
    }
    if (!searchNumbers.includes(international)) {
      searchNumbers.push(international);
    }
  }
  
  // Remove duplicates dan null values
  return [...new Set(searchNumbers.filter(num => num))];
};

// === Function untuk mendapatkan riwayat transaksi nomor dalam periode tertentu ===
const getNumberTransactionHistory = (nomorCustomer, daysPeriod = 30) => {
  return new Promise((resolve, reject) => {
    // Generate kedua format nomor (08 dan 62)
    const searchNumbers = generateSearchNumbers(nomorCustomer);
    
    // Step 1: Cari transaksi terakhir dulu
    let findLastTransactionQuery = `
      SELECT 
        MAX(th.created_at) as last_transaction_date
      FROM transaction_history th
      WHERE th.nomor IN (${searchNumbers.map(() => '?').join(',')})
      AND th.status = 'completed'
    `;
    
    db.get(findLastTransactionQuery, searchNumbers, (err, lastTxRow) => {
      if (err) return reject(err);
      
      if (!lastTxRow || !lastTxRow.last_transaction_date) {
        // Tidak ada transaksi sama sekali
        return resolve([]);
      }
      
      const lastTransactionDate = new Date(lastTxRow.last_transaction_date);
      const now = new Date();
      const daysDiff = Math.floor((now - lastTransactionDate) / (1000 * 60 * 60 * 24));
      
      // Jika transaksi terakhir lebih dari daysPeriod hari, return kosong
      if (daysDiff > daysPeriod) {
        console.log(`⏰ Transaksi terakhir: ${daysDiff} hari yang lalu (melebihi batas ${daysPeriod} hari)`);
        return resolve([]);
      }
      
      // Step 2: Ambil data dari rentang berdasarkan transaksi terakhir
      const cutoffDate = new Date(lastTransactionDate.getTime() - (daysPeriod * 24 * 60 * 60 * 1000));
      const cutoffDateStr = cutoffDate.toISOString();
      
      const query = `
        SELECT 
          th.id,
          th.user_id,
          th.username,
          th.kategori,
          th.nomor,
          th.created_at,
          th.expired_at,
          th.status,
          -- Coba ambil pengelola dari stok yang cocok
          (
            SELECT s.pengelola 
            FROM stok s 
            WHERE s.anggota = th.nomor 
            AND s.kategori = th.kategori 
            AND s.user_id = th.user_id
            AND s.status = 'freeze'
            LIMIT 1
          ) as pengelola_terakhir
        FROM transaction_history th
        WHERE th.nomor IN (${searchNumbers.map(() => '?').join(',')})
        AND th.created_at >= ?
        AND th.status = 'completed'
        ORDER BY th.created_at DESC
      `;
      
      const params = [...searchNumbers, cutoffDateStr];
      
      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        
        // Tambahkan informasi umur transaksi
        const enhancedRows = rows.map(row => ({
          ...row,
          days_ago: Math.floor((now - new Date(row.created_at)) / (1000 * 60 * 60 * 24)),
          is_recent: daysDiff <= daysPeriod
        }));
        
        resolve(enhancedRows);
      });
    });
  });
};

// === Function untuk mendapatkan pengelola yang paling sering digunakan untuk nomor tertentu ===
const getMostUsedPengelolaForNumber = (nomorCustomer, daysPeriod = 30) => {
  return new Promise((resolve, reject) => {
    // Generate kedua format nomor (08 dan 62)
    const searchNumbers = generateSearchNumbers(nomorCustomer);
    
    // Step 1: Cari transaksi terakhir dulu
    let findLastTransactionQuery = `
      SELECT 
        MAX(CASE WHEN th.created_at IS NOT NULL THEN th.created_at ELSE s.expired_at END) as last_transaction_date
      FROM stok s
      LEFT JOIN transaction_history th ON (
        th.user_id = s.user_id AND 
        th.kategori = s.kategori AND
        th.nomor = s.anggota
      )
      WHERE s.anggota IN (${searchNumbers.map(() => '?').join(',')})
      AND s.status = 'freeze'
    `;
    
    db.get(findLastTransactionQuery, searchNumbers, (err, lastTxRow) => {
      if (err) return reject(err);
      
      if (!lastTxRow || !lastTxRow.last_transaction_date) {
        // Tidak ada transaksi sama sekali
        return resolve([]);
      }
      
      const lastTransactionDate = new Date(lastTxRow.last_transaction_date);
      const now = new Date();
      const daysDiff = Math.floor((now - lastTransactionDate) / (1000 * 60 * 60 * 24));
      
      // Jika transaksi terakhir lebih dari daysPeriod hari, return kosong
      if (daysDiff > daysPeriod) {
        console.log(`⏰ Transaksi terakhir: ${daysDiff} hari yang lalu (melebihi batas ${daysPeriod} hari)`);
        return resolve([]);
      }
      
      // Step 2: Ambil data dari rentang berdasarkan transaksi terakhir
      const cutoffDate = new Date(lastTransactionDate.getTime() - (daysPeriod * 24 * 60 * 60 * 1000));
      const cutoffDateStr = cutoffDate.toISOString();
      
      const query = `
        SELECT 
          s.pengelola,
          COUNT(*) as usage_count,
          MAX(th.created_at) as last_used_date,
          GROUP_CONCAT(DISTINCT s.kategori) as categories_used
        FROM stok s
        LEFT JOIN transaction_history th ON (
          th.user_id = s.user_id AND 
          th.kategori = s.kategori AND
          th.nomor = s.anggota
        )
        WHERE s.anggota IN (${searchNumbers.map(() => '?').join(',')})
        AND s.status = 'freeze'
        AND (th.created_at IS NULL OR th.created_at >= ?)
        GROUP BY s.pengelola
        ORDER BY usage_count DESC, last_used_date DESC
      `;
      
      const params = [...searchNumbers, cutoffDateStr];
      
      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        
        // Tambahkan informasi umur transaksi
        const enhancedRows = rows.map(row => ({
          ...row,
          days_ago: row.last_used_date ? Math.floor((now - new Date(row.last_used_date)) / (1000 * 60 * 60 * 24)) : null,
          is_recent: daysDiff <= daysPeriod
        }));
        
        resolve(enhancedRows);
      });
    });
  });
};

// === FUNGSI BEKASAN AUTO-SHIFT SYSTEM ===

// === KONFIGURASI WAKTU SHIFT (EDIT HANYA DI SINI) ===
const BEKASAN_SHIFT_TIME = "02:05";  // Format: HH:MM (24-hour) - Production: 01:00 WIB
// ============================================

// Protection flag untuk mencegah multiple execution dalam menit yang sama
let isShiftInProgress = false;

// Function untuk auto-shift bekasan categories (daily at 00:00 WIB)
const shiftBekasanDaily = () => {
  return new Promise((resolve, reject) => {
    // Get current date in Jakarta timezone using utils/date
    const jakartaTime = getJakartaTime();
    const today = jakartaTime.toISOString().split('T')[0]; // YYYY-MM-DD
    
    console.log(`🚀 Bekasan auto-shift started at ${formatJakartaTime(jakartaTime)}`);
    
    // Check if already shifted today
    getKonfigurasi('last_bekasan_shift_date').then(lastShiftDate => {
      if (lastShiftDate === today) {
        console.log(`⏭️ Already shifted today (${today})`);
        resolve({ success: false, message: 'Already shifted today', date: today });
        return;
      }
      
      // Begin transaction
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Step 1: Get 3H items yang akan dihapus (untuk debugging)
          db.all(`
            SELECT nomor, pengelola, anggota 
            FROM stok 
            WHERE kategori = '3H' AND status = 'allow'
            ORDER BY nomor
          `, [], (err, expiredItems) => {
            if (err) {
              console.error(`❌ Error getting 3H items:`, err.message);
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            // Step 2: Get current stock summary
            db.all(`
              SELECT kategori, COUNT(*) as count 
              FROM stok 
              WHERE kategori IN ('3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H') 
              AND status = 'allow' 
              GROUP BY kategori 
              ORDER BY kategori
            `, [], (err, beforeRows) => {
              if (err) {
                console.error(`❌ Error checking stock:`, err.message);
                db.run('ROLLBACK');
                reject(err);
                return;
              }
              
              // Log before state
              const beforeSummary = beforeRows.length > 0 
                ? beforeRows.map(row => `${row.kategori}:${row.count}`).join(', ')
                : 'No bekasan stock';
              console.log(`📊 Before: ${beforeSummary}`);
              
              // Log items yang akan expired
              if (expiredItems.length > 0) {
                console.log(`�️ Will expire: ${expiredItems.length} items from 3H`);
                expiredItems.forEach(item => {
                  console.log(`   └ ${item.nomor} (${item.pengelola}) - Member: ${item.anggota || 'N/A'}`);
                });
              } else {
                console.log(`🗑️ Will expire: No 3H items to remove`);
              }
              
              // Show transformation mapping
              console.log(`📊 BEKASAN SHIFT TRANSFORMATION:`);
              
              // Create a complete mapping showing all categories 3H-10H
              const categoryMap = {};
              beforeRows.forEach(row => {
                categoryMap[row.kategori] = row.count;
              });
              
              // Show transformation untuk semua kategori 3H-10H
              const categories = ['3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H'];
              categories.forEach(cat => {
                const count = categoryMap[cat] || 0;
                if (cat === '3H') {
                  console.log(`   ${cat} : ${count} stok → 2H (HAPUS)`);
                } else {
                  const targetCat = (parseInt(cat) - 1) + 'H';
                  console.log(`   ${cat} : ${count} stok → ${targetCat}`);
                }
              });
              
              // Log detail items yang akan dihapus
              if (expiredItems.length > 0) {
                console.log(`🗑️ DETAIL STOK YANG AKAN DIHAPUS (${expiredItems.length} items):`);
                expiredItems.forEach((item, index) => {
                  console.log(`   ${index + 1}. ${item.nomor} (${item.pengelola})${item.anggota ? ` - Member: ${item.anggota}` : ''}`);
                });
              } else {
                console.log(`🗑️ TIDAK ADA STOK 3H YANG AKAN DIHAPUS`);
              }
              
              // Step 3: Execute single UPDATE to shift all categories
              console.log(`⚡ Executing shift: All bekasan down 1 level...`);
              db.run(`
                UPDATE stok 
                SET kategori = CASE 
                  WHEN kategori = '10H' THEN '9H'
                  WHEN kategori = '9H' THEN '8H'
                  WHEN kategori = '8H' THEN '7H'
                  WHEN kategori = '7H' THEN '6H'
                  WHEN kategori = '6H' THEN '5H'
                  WHEN kategori = '5H' THEN '4H'
                  WHEN kategori = '4H' THEN '3H'
                  WHEN kategori = '3H' THEN '2H'
                  ELSE kategori
                END
                WHERE kategori IN ('3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H')
                AND status = 'allow'
              `, [], function(shiftErr) {
                if (shiftErr) {
                  console.error(`❌ Shift error:`, shiftErr.message);
                  db.run('ROLLBACK');
                  reject(shiftErr);
                  return;
                }
                
                const totalShifted = this.changes;
                
                // Step 4: Delete expired items (now in 2H category)
                db.run(`DELETE FROM stok WHERE kategori = '2H' AND status = 'allow'`, [], function(deleteErr) {
                  if (deleteErr) {
                    console.error(`❌ Delete error:`, deleteErr.message);
                    db.run('ROLLBACK');
                    reject(deleteErr);
                    return;
                  }
                  
                  const deletedCount = this.changes;
                  const netShifted = totalShifted - deletedCount;
                  
                  // Step 5: Get final stock summary
                  db.all(`
                    SELECT kategori, COUNT(*) as count 
                    FROM stok 
                    WHERE kategori IN ('3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H') 
                    AND status = 'allow' 
                    GROUP BY kategori 
                    ORDER BY kategori
                  `, [], (err, afterRows) => {
                    if (err) {
                      console.error(`❌ Error checking final stock:`, err.message);
                      db.run('ROLLBACK');
                      reject(err);
                      return;
                    }
                    
                    // Show hasil shift dalam format yang mudah dipahami
                    console.log(`📊 HASIL SETELAH SHIFT:`);
                    const afterCategoryMap = {};
                    afterRows.forEach(row => {
                      afterCategoryMap[row.kategori] = row.count;
                    });
                    
                    const categoriesAfter = ['3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H'];
                    categoriesAfter.forEach(cat => {
                      const count = afterCategoryMap[cat] || 0;
                      console.log(`   ${cat} : ${count} stok`);
                    });
                    
                    // Save completion to database
                    setKonfigurasi('last_bekasan_shift_date', today).then(() => {
                      // Commit transaction
                      db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                          console.error(`❌ Commit error:`, commitErr.message);
                          reject(commitErr);
                        } else {
                          console.log(`✅ Shift completed! Expired: ${deletedCount}, Active shifted: ${netShifted}`);
                          
                          resolve({
                            success: true,
                            date: today,
                            expired: deletedCount,
                            shifted: netShifted,
                            total_processed: totalShifted,
                            expired_items: expiredItems,
                            message: `Shift completed: ${deletedCount} expired, ${netShifted} active shifted`
                          });
                        }
                      });
                    }).catch(reject);
                  });
                });
              });
            });
          });
        });
      });
    }).catch(reject);
  });
};
          console.log(`� Step 1: Starting category shifts (3H will become 2H, then delete expired 2H)...`);
          
          // PERBAIKAN: Shift dulu, baru delete
          // Step 2: Shift categories (REVERSE ORDER + 3H→2H)
          // CRITICAL: Must be done in reverse order to prevent cascade shifting!
          const shiftMappings = [
            { from: '4H', to: '3H' },
            { from: '5H', to: '4H' },
            { from: '6H', to: '5H' },
            { from: '7H', to: '6H' },
            { from: '8H', to: '7H' },
            { from: '9H', to: '8H' },
            { from: '10H', to: '9H' },
            { from: '3H', to: '2H' }  // TAMBAH: 3H menjadi 2H
          ];
            
            let shiftIndex = 0;
            
            const processShift = () => {
              if (shiftIndex >= shiftMappings.length) {
                // All shifts completed, NOW delete expired 2H
                console.log(`🗑️ Final Step: Deleting expired 2H stok...`);
                db.run('DELETE FROM stok WHERE kategori = ? AND status = ?', ['2H', 'allow'], function(err) {
                  if (err) {
                    console.error(`❌ Error deleting expired 2H stok:`, err.message);
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  
                  results.deleted = this.changes;
                  if (this.changes > 0) {
                    console.log(`✅ Deleted ${this.changes} expired 2H stok`);
                    results.details.push(`Deleted ${this.changes} expired 2H stok`);
                  } else {
                    console.log(`ℹ️ No expired 2H stok to delete`);
                  }
                  
                  // Save completion to database
                  console.log(`💾 Saving shift completion to database...`);
                  setKonfigurasi('last_bekasan_shift_date', today).then(() => {
                    // Commit transaction
                    db.run('COMMIT', (err) => {
                      if (err) {
                        console.error(`❌ Error committing transaction:`, err.message);
                        reject(err);
                      } else {
                        console.log(`✅ Bekasan auto-shift completed successfully!`);
                        console.log(`📊 Summary: ${results.deleted} deleted, ${results.shifted} shifted`);
                        console.log(`📋 Details: ${results.details.join(' | ')}`);
                        resolve({
                          success: true,
                          date: today,
                          deleted: results.deleted,
                          shifted: results.shifted,
                          details: results.details,
                          message: `Shift completed: ${results.deleted} deleted, ${results.shifted} shifted`
                        });
                      }
                    });
                  }).catch(reject);
                });
                return;
              }
              
              const mapping = shiftMappings[shiftIndex];
              
              console.log(`⚡ Processing shift: ${mapping.from} → ${mapping.to}`);
              db.run('UPDATE stok SET kategori = ? WHERE kategori = ? AND status = ?', 
                [mapping.to, mapping.from, 'allow'], function(err) {
                  if (err) {
                    console.error(`❌ Error shifting ${mapping.from}→${mapping.to}:`, err.message);
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  
                  if (this.changes > 0) {
                    console.log(`✅ ${mapping.from}→${mapping.to}: ${this.changes} items shifted`);
                    results.shifted += this.changes;
                    results.details.push(`${mapping.from}→${mapping.to}: ${this.changes} items`);
                  } else {
                    console.log(`ℹ️ ${mapping.from}→${mapping.to}: No items to shift`);
                  }
                  
                  shiftIndex++;
                  processShift();
                });
            };
            
// Function untuk cek apakah perlu auto-shift dan eksekusi jika perlu
const checkAndExecuteBekasanShift = async () => {
  try {
    const jakartaTime = getJakartaTime();
    const today = jakartaTime.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Cek apakah hari ini sudah shift
    const lastShiftDate = await getKonfigurasi('last_bekasan_shift_date');
    if (lastShiftDate === today) {
      // Sudah shift hari ini, skip pengecekan
      return { success: false, message: 'Already shifted today', date: today, skipCheck: true };
    }
    
    const hours = jakartaTime.getHours();
    const minutes = jakartaTime.getMinutes();
    
    // Parse BEKASAN_SHIFT_TIME dari format "HH:MM"
    const [shiftHour, shiftMinute] = BEKASAN_SHIFT_TIME.split(':').map(Number);
    
    // Execute at configured shift time
    if (hours === shiftHour && minutes === shiftMinute) {
      // Protection: cek apakah shift sudah dalam progress
      if (isShiftInProgress) {
        return { success: false, message: 'Shift already in progress', time: `${hours}:${minutes.toString().padStart(2, '0')}` };
      }
      
      console.log(`🕐 Auto-shift time reached: ${formatJakartaTime(jakartaTime)}`);
      
      // Set flag untuk mencegah multiple execution
      isShiftInProgress = true;
      
      try {
        const result = await shiftBekasanDaily();
        if (result.success) {
          console.log(`✅ Bekasan auto-shift completed: ${result.message}`);
        } else {
          console.log(`ℹ️ Bekasan auto-shift skipped: ${result.message}`);
        }
        
        // Reset flag setelah selesai (akan reset otomatis pada menit berikutnya)
        setTimeout(() => {
          isShiftInProgress = false;
        }, 65000); // Reset after 65 seconds (lebih dari 1 menit)
        
        return result;
      } catch (error) {
        // Reset flag jika ada error
        isShiftInProgress = false;
        throw error;
      }
    }
    
    // Reset flag jika bukan waktu shift (untuk memastikan reset di menit lain)
    if (minutes !== shiftMinute) {
      isShiftInProgress = false;
    }
    
    return { success: false, message: `Not shift time (${BEKASAN_SHIFT_TIME})`, time: `${hours}:${minutes.toString().padStart(2, '0')}` };
  } catch (error) {
    console.error('❌ Bekasan auto-shift error:', error.message);
    isShiftInProgress = false; // Reset flag jika ada error
    throw error;
  }
};

// Function untuk manual trigger shift (admin)
const manualBekasanShift = () => {
  return shiftBekasanDaily();
};

// Function untuk get bekasan shift status
const getBekasanShiftStatus = async () => {
  try {
    const lastShiftDate = await getKonfigurasi('last_bekasan_shift_date');
    const jakartaTime = getJakartaTime();
    const today = jakartaTime.toISOString().split('T')[0];
    
    return {
      lastShiftDate: lastShiftDate || 'Never',
      hasShiftedToday: lastShiftDate === today,
      nextShiftTime: `${BEKASAN_SHIFT_TIME} WIB (Daily)`,
      currentTime: formatJakartaTime(jakartaTime)
    };
  } catch (error) {
    return {
      lastShiftDate: 'Error',
      hasShiftedToday: false,
      nextShiftTime: `${BEKASAN_SHIFT_TIME} WIB (Daily)`,
      currentTime: formatJakartaTime(getJakartaTime()),
      error: error.message
    };
  }
};

// Enhanced getStok dengan auto-shift check (seamless integration)
const getStokWithAutoShift = async (kategori) => {
  try {
    // Check if we need to auto-shift before getting stok
    await checkAndExecuteBekasanShift();
  } catch (error) {
    // Silent fail untuk auto-shift, tetap return stok
    console.error('Auto-shift check failed, continuing with stok retrieval:', error.message);
  }
  
  // Return normal stok data
  return getStok(kategori);
};

// === TRACKING FUNCTIONS ===

// Function untuk memeriksa status nomor customer aktif
const checkNumberActiveStatus = (nomorCustomer, pengelola = null) => {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    // Generate kedua format nomor (08 dan 62)
    const searchNumbers = generateSearchNumbers(nomorCustomer);
    
    let query = `
      SELECT 
        s.pengelola,
        s.kategori,
        s.anggota,
        s.expired_at,
        s.kuota,
        s.slot_ke,
        CASE 
          WHEN s.expired_at IS NULL THEN 'permanent'
          WHEN s.expired_at > ? THEN 'active'
          ELSE 'expired'
        END as status
      FROM stok s
      WHERE s.anggota IN (${searchNumbers.map(() => '?').join(',')})
      AND s.status = 'freeze'
    `;
    
    let params = [now, ...searchNumbers];
    
    if (pengelola) {
      query += ' AND s.pengelola = ?';
      params.push(pengelola);
    }
    
    query += ' ORDER BY s.expired_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

module.exports = {
  db,
  addStok,
  getStok,
  freezeStok,
  deleteStok,
  deleteSingleStok, // Export function baru
  clearStokKategori,
  countStok,
  countAllStok,
  cleanExpired,
  updateSaldo,
  getUserSaldo,
  addPengguna,
  tambahSaldo,
  kurangiSaldo,
  // Tambahan untuk broadcast
  getAllUsers,
  getUsersBySaldo,
  getTotalUsers,
  logBroadcast,
  getKonfigurasi,
  setKonfigurasi,
  getAllKonfigurasi,
  getHargaPaket,
  getHargaPaketDynamic, // Fungsi baru untuk harga dinamis
  getDeskripsiPaket,
  getHargaGagal,
  getMinSaldoBekasan,
  getKuotaPaket,
  // Function baru untuk auto-switch pengelola
  getAllPengelolaNumbers,
  // Code redeem functions
  createCode,
  getCodeInfo,
  useCode,
  getAllCodes,
  // Transaction history functions
  getUserTransactionCount,
  getUsersWithHistoryCount,
  // Kick schedule functions
  addKickSchedule,
  getKickSchedules,
  getAllKickSchedules,
  deleteKickSchedule,
  completeKickSchedule,
  // Blocked users management
  markUserBlocked,
  removeBlockedUsers,
  getBlockedUsersCount,
  unblockUser,
  autoUnblockIfActive,
  // === PRODUK DINAMIS ===
  getAllProdukDinamis,
  getProdukDinamis,
  updateHargaMarkup,
  getHargaFinalProduk,
  // REMOVED: semua fungsi auto-sync API - gunakan manual tools
  
  // === TRACKING FUNCTIONS ===
  getLastPengelolaForNumber,
  getNumberTransactionHistory,
  getMostUsedPengelolaForNumber,
  checkNumberActiveStatus,
  
  // === BEKASAN AUTO-SHIFT FUNCTIONS ===
  shiftBekasanDaily,
  checkAndExecuteBekasanShift,
  manualBekasanShift,
  getBekasanShiftStatus,
  getStokWithAutoShift
};
