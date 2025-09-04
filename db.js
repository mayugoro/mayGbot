const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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
          saldo REAL DEFAULT 0
        )
      `, (err) => {
        if (err) {
          console.error("Error creating pengguna table: ", err.message);
          return reject(err);
        }
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
        
        // Insert default values jika belum ada
        const defaultConfigs = [
          { key: 'harga_3h', value: '5000', description: 'Harga paket BEKASAN 3H' },
          { key: 'harga_4h', value: '6500', description: 'Harga paket BEKASAN 4H' },
          { key: 'harga_5h', value: '9000', description: 'Harga paket BEKASAN 5H' },
          { key: 'harga_6h', value: '11000', description: 'Harga paket BEKASAN 6H' },
          { key: 'harga_7h', value: '13000', description: 'Harga paket BEKASAN 7H' },
          { key: 'harga_8h', value: '15000', description: 'Harga paket BEKASAN 8H' },
          { key: 'harga_9h', value: '18000', description: 'Harga paket BEKASAN 9H' },
          { key: 'harga_10h', value: '20000', description: 'Harga paket BEKASAN 10H' },
          { key: 'deskripsi_3h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 3H' },
          { key: 'deskripsi_4h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 4H' },
          { key: 'deskripsi_5h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 5H' },
          { key: 'deskripsi_6h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 6H' },
          { key: 'deskripsi_7h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 7H' },
          { key: 'deskripsi_8h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 8H' },
          { key: 'deskripsi_9h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 9H' },
          { key: 'deskripsi_10h', value: 'AREA 1 = 8 GB\nAREA 2 = 10 GB\nAREA 3 = 15 GB\nAREA 4 = 25 GB', description: 'Deskripsi kuota BEKASAN 10H' },

          // Fitur lainnya
          { key: 'harga_gagal', value: '700', description: 'Harga yang dipotong jika transaksi gagal' },
          { key: 'min_saldo_bekasan', value: '5000', description: 'Minimal saldo untuk akses menu bekasan' },
          { key: 'min_saldo_bulanan', value: '100000', description: 'Minimal saldo untuk akses menu bulanan' },
          { key: 'min_saldo_global', value: '150000', description: 'Minimal saldo untuk akses menu global' },
          { key: 'pesan_tolak_bekasan', value: 'Saldo tidak cukup untuk akses menu ini\n\n⏤͟͟ᴍᴀʏᴜɢᴏʀᴏ', description: 'Pesan penolakan akses bekasan' },
          { key: 'pesan_tolak_bulanan', value: 'Saldo tidak cukup untuk akses menu ini\n\n⏤͟͟ᴍᴀʏᴜɢᴏʀᴏ', description: 'Pesan penolakan akses bulanan' },
          { key: 'pesan_tolak_global', value: 'Saldo tidak cukup untuk akses menu global\n\n⏤͟͟ᴍᴀʏᴜɢᴏʀᴏ', description: 'Pesan penolakan akses global' },


          // Konfigurasi untuk menu BULANAN
          { key: 'harga_supermini', value: '40000', description: 'Harga paket BULANAN SUPERMINI' },
          { key: 'harga_superbig', value: '60000', description: 'Harga paket BULANAN SUPERBIG' },
          { key: 'harga_mini', value: '50000', description: 'Harga paket BULANAN MINI' },
          { key: 'harga_big', value: '55000', description: 'Harga paket BULANAN BIG' },
          { key: 'harga_lite', value: '70000', description: 'Harga paket BULANAN LITE' },
          { key: 'harga_jumbo', value: '75000', description: 'Harga paket BULANAN JUMBO' },
          { key: 'harga_megabig', value: '85000', description: 'Harga paket BULANAN MEGABIG' },
          { key: 'harga_superjumbo', value: '90000', description: 'Harga paket BULANAN SUPER JUMBO' },
          { key: 'deskripsi_supermini', value: 'AREA 1 : 13 GB\nAREA 2 : 15 GB\nAREA 3 : 20 GB\nAREA 4 : 30 GB', description: 'Deskripsi kuota BULANAN SUPERMINI' },
          { key: 'deskripsi_superbig', value: 'AREA 1 : 7 GB\nAREA 2 : 12 GB\nAREA 3 : 25 GB\nAREA 4 : 65 GB', description: 'Deskripsi kuota BULANAN SUPERBIG' },
          { key: 'deskripsi_mini', value: 'AREA 1 : 22,5 GB\nAREA 2 : 25,5 GB\nAREA 3 : 34 GB\nAREA 4 : 49 GB', description: 'Deskripsi kuota BULANAN MINI' },
          { key: 'deskripsi_big', value: 'AREA 1 : 38 GB\nAREA 2 : 40 GB\nAREA 3 : 45 GB\nAREA 4 : 55 GB', description: 'Deskripsi kuota BULANAN BIG' },
          { key: 'deskripsi_lite', value: 'AREA 1 : 47 GB\nAREA 2 : 52 GB\nAREA 3 : 65 GB\nAREA 4 : 105 GB', description: 'Deskripsi kuota BULANAN LITE' },
          { key: 'deskripsi_jumbo', value: 'AREA 1 : 66 GB\nAREA 2 : 70 GB\nAREA 3 : 83 GB\nAREA 4 : 123 GB', description: 'Deskripsi kuota BULANAN JUMBO' },
          { key: 'deskripsi_megabig', value: 'AREA 1 : 88 GB\nAREA 2 : 90 GB\nAREA 3 : 95 GB\nAREA 4 : 105 GB', description: 'Deskripsi kuota BULANAN MEGABIG' },
          { key: 'deskripsi_superjumbo', value: 'AREA 1 : 86 GB\nAREA 2 : 91 GB\nAREA 3 : 104 GB\nAREA 4 : 144 GB', description: 'Deskripsi kuota BULANAN SUPER JUMBO' },
          // Konfigurasi kuota default untuk bulanan
          { key: 'kuota_supermini', value: '0', description: 'Kuota default BULANAN SUPERMINI (GB)' },
          { key: 'kuota_superbig', value: '0', description: 'Kuota default BULANAN SUPERBIG (GB)' },
          { key: 'kuota_mini', value: '15', description: 'Kuota default BULANAN MINI (GB)' },
          { key: 'kuota_big', value: '25', description: 'Kuota default BULANAN BIG (GB)' },
          { key: 'kuota_lite', value: '20', description: 'Kuota default BULANAN LITE (GB)' },
          { key: 'kuota_jumbo', value: '40', description: 'Kuota default BULANAN JUMBO (GB)' },
          { key: 'kuota_megabig', value: '75', description: 'Kuota default BULANAN MEGABIG (GB)' },
          { key: 'kuota_superjumbo', value: '60', description: 'Kuota default BULANAN SUPER JUMBO (GB)' },
        ];

        defaultConfigs.forEach(config => {
          db.run('INSERT OR IGNORE INTO konfigurasi (key, value, description) VALUES (?, ?, ?)', 
            [config.key, config.value, config.description]);
        });
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
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'active'
        )
      `, (err) => {
        if (err) {
          console.error("Error creating kick_schedule table: ", err.message);
          return reject(err);
        }
        
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

// === Ambil saldo pengguna (dengan auto-create user jika belum ada) ===
const getUserSaldo = (userId, username = null) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT saldo, username FROM pengguna WHERE user_id = ?', [userId], (err, row) => {
      if (err) return reject(err);
      
      if (!row) {
        // User belum ada, buat user baru dengan username yang benar
        const finalUsername = username || `user_${userId}`;
        db.run('INSERT INTO pengguna (user_id, username, saldo) VALUES (?, ?, ?)', 
          [userId, finalUsername, 0], function(err) {
          if (err) return reject(err);
          resolve(0);
        });
      } else {
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

// === Ambil semua user untuk broadcast ===
const getAllUsers = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT user_id, username FROM pengguna', [], (err, rows) => {
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

// === Get harga paket berdasarkan kategori ===
const getHargaPaket = async (kategori) => {
  const key = `harga_${kategori.toLowerCase()}`;
  const harga = await getKonfigurasi(key);
  return harga ? parseInt(harga) : 0;
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

// Jalankan fungsi init() dan tunggu sampai selesai
init().then(() => {
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
const addKickSchedule = (chatId, nomorHp, jam, menit, targetTime) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO kick_schedule (chat_id, nomor_hp, jam, menit, target_time) 
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run([chatId, nomorHp, jam, menit, targetTime], function(err) {
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
  deleteKickSchedule,
  completeKickSchedule
};
