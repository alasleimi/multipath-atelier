const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
let html = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8');
html = html.replace('<!--__QR__-->', () => fs.readFileSync(path.join(root, 'src/qr.html'), 'utf8'));
for (const [token, file] of Object.entries({ STYLE:'src/style.css', QR_STYLE:'src/qr.css', DATA:'data.json', ENGINE:'src/engine.js', APP:'src/app.js' })) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  html = html.replace(`/*__${token}__*/`, () => content);
}
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`Built self-contained index.html (${Math.round(Buffer.byteLength(html)/1024)} KB)`);
