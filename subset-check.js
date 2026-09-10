const { spawnSync } = require('child_process');
const fs = require('fs');
const files = fs.readdirSync('tests').filter(f => f.endsWith('.test.js')).sort();
for (let i = 1; i <= 6; i++) {
  const subset = files.slice(0, i);
  const p = spawnSync(process.execPath, ['node_modules/mocha/bin/mocha.js', '--exit', ...subset.map(f => 'tests/' + f)], { encoding: 'utf8' });
  console.log('SUBSET', i, subset.join(', '), 'EXIT', p.status);
  if (p.status !== 0) {
    const out = (p.stdout || '') + (p.stderr || '');
    console.log(out.slice(-1500));
    break;
  }
}
