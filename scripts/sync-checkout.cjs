// Gera /doacao/<valor>/index.html como cópia do checkout (arquivo real sempre vence fallback de rota)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'public');
const src = path.join(root, 'checkout.html');
const VALORES = [2, 5, 10, 20, 50, 100];
const html = fs.readFileSync(src, 'utf8');
for (const v of VALORES) {
  for (const dir of [path.join(root, 'doacao', String(v)), path.join(root, 'checkout-' + v)]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }
  console.log('gerado /doacao/' + v + '/ + /checkout-' + v + '/');
}
