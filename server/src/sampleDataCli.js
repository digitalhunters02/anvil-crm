// sampleDataCli.js
// PARA QUE SERVE: comando de linha para carregar/remover/ver os dados de exemplo sem abrir o app. Mesmas regras de segurança do botão
// do dono (sampleData.js): nunca carrega em instalação com dado real, é idempotente e remove SÓ o que é marcado como exemplo.
//   npm run sample -w server -- status
//   npm run sample -w server -- load
//   npm run sample -w server -- remove
import pool, { initSchema } from './db.js';
import { sampleStatus, loadSampleData, removeSampleData } from './sampleData.js';

const cmd = process.argv[2];
async function main() {
  if (!['load', 'remove', 'status'].includes(cmd)) {
    console.error('Usage: node src/sampleDataCli.js load | remove | status');
    return 2;
  }
  await initSchema();
  if (cmd === 'status') {
    console.log(JSON.stringify(await sampleStatus(), null, 2));
    return 0;
  }
  if (cmd === 'load') {
    try {
      const r = await loadSampleData();
      console.log(r.already ? 'Sample data was already loaded. Nothing added.' : `Loaded ${r.created} sample records.`);
      return 0;
    } catch (e) {
      if (e.code === 'sample_has_real_data') { console.error(e.message); return 3; }
      throw e;
    }
  }
  const r = await removeSampleData();
  console.log(`Removed ${r.removed} sample records.${r.kept ? ` ${r.kept} sample records were kept because real records still use them.` : ''}`);
  return 0;
}

main()
  .then(async (code) => { await pool.end(); process.exit(code); })
  .catch(async (e) => { console.error(e); await pool.end().catch(() => {}); process.exit(1); });
