#!/usr/bin/env node

require('dotenv').config();

const { route, getAgentInfo } = require('./router');
const etsy = require('./integrations/etsy');
const ollama = require('./agents/ollama');

const HELP = `
╔══════════════════════════════════════════════════════════╗
║              JAUN MANAGER - AI Team CLI                  ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  CODING AGENTS:                                          ║
║    quick <pesan>     → Task ringan (3B)                  ║
║    code <pesan>      → Nulis kode (7B)                   ║
║    debug <pesan>     → Fix bug (7B)                      ║
║    review <pesan>    → Review kode (Big Pickle)          ║
║    auto <pesan>      → Auto-route                        ║
║                                                          ║
║  ETSY MANAGEMENT:                                        ║
║    etsy:list          → List semua produk                 ║
║    etsy:stat          → Statistik toko                   ║
║    etsy:desc <judul>  → Generate deskripsi produk        ║
║    etsy:tags <judul>  → Generate SEO tags                ║
║    etsy:reply <msg>   → Draft reply customer             ║
║    etsy:analytics     → Analisis penjualan               ║
║                                                          ║
║  UTILITIES:                                              ║
║    status             → Status system                    ║
║    agents             → List semua agents                 ║
║    help               → Tampilkan help ini               ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`;

async function handleCommand(input) {
  const trimmed = input.trim();
  const [command, ...args] = trimmed.split(' ');
  const message = args.join(' ');

  switch (command.toLowerCase()) {
    case 'quick':
      if (!message) return console.log('❌ Contoh: quick apa itu variable?');
      console.log(`\n[QUICK] 🔄 Memproses...`);
      const quickResult = await route(message, 'quick');
      console.log(`\n✅ [QUICK]:\n${quickResult.response}`);
      break;

    case 'code':
    case 'coder':
      if (!message) return console.log('❌ Contoh: code buatkan fungsi factorial');
      console.log(`\n[CODER] 🔄 Memproses...`);
      const coderResult = await route(message, 'coder');
      console.log(`\n✅ [CODER]:\n${coderResult.response}`);
      break;

    case 'debug':
    case 'debugger':
      if (!message) return console.log('❌ Contoh: debug error di line 42');
      console.log(`\n[DEBUGGER] 🔄 Memproses...`);
      const debugResult = await route(message, 'debugger');
      console.log(`\n✅ [DEBUGGER]:\n${debugResult.response}`);
      break;

    case 'review':
      if (!message) return console.log('❌ Contoh: review cek kode saya');
      console.log(`\n[REVIEWER] 🔄 Memproses...`);
      const reviewResult = await route(message, 'reviewer');
      console.log(`\n✅ [REVIEWER]:\n${reviewResult.response}`);
      break;

    case 'auto':
      if (!message) return console.log('❌ Contoh: auto buatkan web scraper');
      console.log(`\n[AUTO] 🔄 Menganalisis task...`);
      const autoResult = await route(message);
      console.log(`\n✅ [${autoResult.agent}]:\n${autoResult.response}`);
      break;

    case 'etsy:list':
      console.log('\n📦 Listing produk...');
      const listings = await etsy.getListings();
      console.log(`\n✅ Total: ${listings.count} produk`);
      listings.results?.forEach((l, i) => {
        const price = typeof l.price === 'object' ? `${l.price.amount / 100} ${l.price.currency_code}` : `${l.price} ${l.currency_code || ''}`;
        console.log(`${i + 1}. ${l.title} - ${price}`);
      });
      break;

    case 'etsy:stat':
      console.log('\n📊 Statistik toko...');
      const stats = await etsy.getListingStats();
      console.log(`\n✅ Total aktif: ${stats.totalActive} produk`);
      break;

    case 'etsy:desc':
      if (!message) return console.log('❌ Contoh: etsy:desc Digital Planner 2025');
      console.log(`\n📝 Generating deskripsi untuk: ${message}`);
      const descResult = await route(
        `Buatkan deskripsi produk Etsy yang menarik dan SEO-friendly untuk: "${message}". 
         Deskripsi harus:
         - 200-300 kata
         - Include keywords yang relevan
         - Call to action yang jelas
         - Formatting yang rapi`,
        'coder'
      );
      console.log(`\n✅ Deskripsi:\n${descResult.response}`);
      break;

    case 'etsy:tags':
      if (!message) return console.log('❌ Contoh: etsy:tags Digital Planner 2025');
      console.log(`\n🏷️ Generating SEO tags untuk: ${message}`);
      const tagsResult = await route(
        `Buatkan 13 tags SEO untuk Etsy listing produk: "${message}".
         Tags harus:
         - Relevan dengan produk
         - Mix long-tail dan short-tail keywords
         - Format: tag1, tag2, tag3, ...
         - Maksimal 20 karakter per tag`,
        'quick'
      );
      console.log(`\n✅ Tags:\n${tagsResult.response}`);
      break;

    case 'etsy:reply':
      if (!message) return console.log('❌ Contoh: etsy:reply Terima kasih sudah order');
      console.log(`\n💬 Drafting reply...`);
      const replyResult = await route(
        `Buatkan balasan yang profesional dan ramah untuk customer Etsy: "${message}". 
         Balasan harus:
         - Personal dan hangat
         - Solution-oriented
         - Singkat tapi informatif
         - Call to action jika perlu`,
        'coder'
      );
      console.log(`\n✅ Reply:\n${replyResult.response}`);
      break;

    case 'etsy:analytics':
      console.log('\n📈 Analytics toko...');
      const analytics = await etsy.getReceiptsSummary();
      console.log(`\n✅ Ringkasan:`);
      console.log(`   Total orders: ${analytics.totalOrders}`);
      console.log(`   Total revenue: $${analytics.totalRevenue.toFixed(2)}`);
      if (analytics.recentOrders.length > 0) {
        console.log(`\n   Recent orders:`);
        analytics.recentOrders.forEach((o, i) => {
          console.log(`   ${i + 1}. #${o.id} - $${o.total} (${o.status})`);
        });
      }
      break;

    case 'status':
      console.log('\n🔍 Checking status...');
      const ollamaOk = await ollama.isAvailable();
      console.log(`   Ollama: ${ollamaOk ? '✅ Running' : '❌ Not running'}`);
      console.log(`   Model 3B: qwen2.5-coder:3b`);
      console.log(`   Model 7B: qwen2.5-coder:7b`);
      console.log(`   Big Pickle: ✅ Cloud`);
      break;

    case 'agents':
      console.log('\n🤖 Agents:');
      getAgentInfo().forEach(a => {
        console.log(`   ${a.key} → ${a.name}`);
      });
      break;

    case 'help':
      console.log(HELP);
      break;

    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log(HELP);
  }
}

async function interactiveMode() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(HELP);
  console.log('💡 Ketik command atau pesan. Ketik "exit" untuk keluar.\n');

  const prompt = () => {
    rl.question('jaun> ', async (input) => {
      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        console.log('👋 Sampai jumpa!');
        rl.close();
        process.exit(0);
      }

      if (!input.trim()) {
        prompt();
        return;
      }

      try {
        await handleCommand(input);
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
      }

      prompt();
    });
  };

  prompt();
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    await interactiveMode();
  } else {
    const input = args.join(' ');
    try {
      await handleCommand(input);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
}

main();
