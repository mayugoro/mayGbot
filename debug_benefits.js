const axios = require('axios');

async function debugBenefits() {
  try {
    const response = await axios.get('https://apigw.kmsp-store.com/sidompul/v4/cek_kuota', {
      params: {
        msisdn: '087764659979',
        isJSON: 'true',
        _: Date.now().toString()
      },
      headers: {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
        "Authorization": "Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw",
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://sidompul.kmsp-store.com",
        "Priority": "u=1, i",
        "Referer": "https://sidompul.kmsp-store.com/",
        "Sec-CH-UA": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "X-API-Key": "60ef29aa-a648-4668-90ae-20951ef90c55",
        "X-App-Version": "4.0.0"
      }
    });

    console.log('🔍 DEBUGGING BENEFITS STRUCTURE');
    console.log('================================\n');

    if (response.data?.data?.data_sp?.quotas?.value) {
      response.data.data.data_sp.quotas.value.forEach((packageGroup, idx) => {
        if (Array.isArray(packageGroup)) {
          packageGroup.forEach((pkg, subIdx) => {
            if (pkg.packages && pkg.benefits) {
              console.log(`📦 Package ${idx + 1}.${subIdx + 1}: ${pkg.packages.name}`);
              console.log('📋 Benefits raw structure:');
              
              // Show first 3 benefits with all their properties
              pkg.benefits.slice(0, 3).forEach((benefit, benefitIdx) => {
                console.log(`  Benefit ${benefitIdx + 1}:`, JSON.stringify(benefit, null, 4));
              });
              
              console.log('\n📋 Available properties in benefits:');
              if (pkg.benefits.length > 0) {
                const sampleBenefit = pkg.benefits[0];
                Object.keys(sampleBenefit).forEach(key => {
                  console.log(`  - ${key}: ${typeof sampleBenefit[key]} (${sampleBenefit[key]})`);
                });
              }
              console.log('─'.repeat(50));
            }
          });
        }
      });
    } else {
      console.log('❌ No quotas data found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

debugBenefits();
