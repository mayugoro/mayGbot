// Test file untuk melihat endpoint APIG list
const axios = require('axios');
require('dotenv').config();

async function testAPIG() {
  console.log('🧪 TESTING APIG ENDPOINT');
  console.log('=' .repeat(50));
  
  // Ambil konfigurasi dari .env
  const APIG_LISTPRODUK = process.env.APIG_LISTPRODUK;
  const API1 = process.env.API1;
  const APIKEY1 = process.env.APIKEY1;
  const LISTPRODUK1 = process.env.LISTPRODUK1;
  
  console.log('📋 Configuration:');
  console.log('APIG_LISTPRODUK:', APIG_LISTPRODUK);
  console.log('API1:', API1);
  console.log('APIKEY1:', APIKEY1);
  console.log('LISTPRODUK1:', LISTPRODUK1);
  console.log('');

  // Test endpoints berbeda
  const testEndpoints = [
    {
      name: 'APIG_LISTPRODUK (Original)',
      url: APIG_LISTPRODUK,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    },
    {
      name: 'KHFY API1 + LISTPRODUK1',
      url: API1 + LISTPRODUK1,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    },
    {
      name: 'KHFY API1 + LISTPRODUK1 (with token)',
      url: API1 + LISTPRODUK1,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      data: { token: APIKEY1 }
    }
  ];

  for (const endpoint of testEndpoints) {
    console.log(`🔍 Testing: ${endpoint.name}`);
    console.log(`URL: ${endpoint.url}`);
    console.log('-'.repeat(40));

    if (!endpoint.url) {
      console.log('⚠️ URL tidak dikonfigurasi, skip...\n');
      continue;
    }

    try {
      let response;
      
      if (endpoint.data) {
        // POST request
        const FormData = require('form-data');
        const form = new FormData();
        Object.keys(endpoint.data).forEach(key => {
          form.append(key, endpoint.data[key]);
        });
        
        response = await axios.post(endpoint.url, form, {
          headers: {
            ...endpoint.headers,
            ...form.getHeaders()
          },
          timeout: 15000
        });
      } else {
        // GET request
        response = await axios.get(endpoint.url, {
          headers: endpoint.headers,
          timeout: 15000
        });
      }

      console.log('✅ SUCCESS');
      console.log('Status:', response.status);
      console.log('Data Type:', typeof response.data);
      console.log('Is Array:', Array.isArray(response.data));
      
      if (Array.isArray(response.data)) {
        console.log('Items Count:', response.data.length);
        if (response.data.length > 0) {
          console.log('Sample Item:', JSON.stringify(response.data[0], null, 2));
        }
      } else if (typeof response.data === 'object') {
        console.log('Object Keys:', Object.keys(response.data));
        console.log('Sample Data:', JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
      } else {
        console.log('Data:', response.data);
      }

    } catch (error) {
      console.log('❌ FAILED');
      console.log('Error:', error.message);
      
      if (error.response) {
        console.log('Status Code:', error.response.status);
        console.log('Response Data:', error.response.data);
      }
    }
    
    console.log('');
  }
}

// Jalankan test
console.log('🚀 Starting APIG API Test...');
console.log('Time:', new Date().toLocaleString('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}));
console.log('');

testAPIG()
  .then(() => {
    console.log('');
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.log('');
    console.log('❌ Test failed:', error.message);
    process.exit(1);
  });
