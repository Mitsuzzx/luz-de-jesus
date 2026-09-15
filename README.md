# ✝ Luz de Jesus — Site de Doação Black Premium 💛

Doações para **necessitados + animais**, mínimo **R$2**, PIX via **Sharpify**.

## Rodar local
```powershell
npm install
copy .env.example .env
npm start
# site: http://localhost:3000
# admin: http://localhost:3000/admin (senha do .env, padrão jesus123)
```

## Banco de dados — Supabase 💛 (opcional, recomendado)
Sim, conecta! Sem Supabase o site usa banco local (`db.json`) — na Vercel ele zera a cada deploy. Com Supabase as doações ficam salvas de verdade:
1. Crie um projeto em [supabase.com](https://supabase.com) (grátis).
2. Abra **SQL Editor → New query**, cole o conteúdo do `supabase.sql` e rode ▶️.
3. Vá em **Project Settings → API** e copie: `Project URL` + `service_role` key.
4. Local: coloque no `.env` como `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` e rode `npm start` (vai aparecer "Banco: Supabase conectado").
5. Vercel: adicione as 2 variáveis em **Settings → Environment Variables** + redeploy.
> ⚠️ Use a **service_role** (só no servidor). O frontend nunca acessa o banco direto — só via `/api`, então é seguro.

## Subir na Vercel 🚀
1. Suba a pasta pro GitHub (`git init`, commit, push).
2. Em [vercel.com](https://vercel.com) → **Add New Project** → importe o repositório.
3. Em **Settings → Environment Variables**, adicione:
   - `SHARPIFY_CLIENT_ID` e `SHARPIFY_CLIENT_SECRET` (painel sharpify.com.br → Credenciais API, permissões `CREATE_PAYMENT_LINK` + `GET_PAYMENT_LINK`)
   - `GOAL=65000`, `BASE_RAISED=48230`, `BASE_DONORS=1847`
   - `ADMIN_PASSWORD=sua-senha-forte`
   - `WEBHOOK_URL=https://SEU-projeto.vercel.app/api/webhook` (p/ aprovação automática)
4. **Deploy**. Pronto: site + `/api/*` + `/admin` no ar.
5. Na Sharpify, cadastre o webhook apontando para `https://SEU-projeto.vercel.app/api/webhook`.

> Sem credencial Sharpify o site roda em **modo demonstração** (QR fake) — ótimo pra testar o visual.

## Tráfego pago + Meta Pixel 🎯
**Ver visitas:** o site registra cada acesso (com UTMs) e o painel `/admin` mostra aba **📊 Tráfego pago**: visitas, visitantes únicos, conversão %, receita por campanha e por origem (Hoje/7d/30d).

**Links dos anúncios (UTM):** use sempre assim —
`seusite.com/?utm_source=instagram&utm_medium=cpc&utm_campaign=natal`
Cada doação carrega a UTM de origem → você vê exatamente qual campanha vendeu.

**Conectar o Pixel (Meta Ads) — passo a passo:**
1. Em [business.facebook.com](https://business.facebook.com) → **Todas as ferramentas → Gerenciador de Eventos** → **Conectar fontes de dados → Web → Pixel** → crie e copie o **ID (só números)**.
2. No painel `/admin` → **⚙️ Pixel & anúncios** → cole o ID → **Salvar** (ou ponha `META_PIXEL_ID` no `.env`). Pronto: PageView, InitiateCheckout e Purchase disparam sozinhos.
3. **CAPI (recomendado):** no Pixel → **Configurações → API de Conversões → Gerar token** → cole no mesmo campo do painel. O Purchase passa a ir também pelo servidor (não perde venda de iPhone).
4. Valide com a extensão **Meta Pixel Helper** (Chrome) — PageView 🟢 + teste uma doação pra ver o Purchase.
5. Nos anúncios use o link com UTM (`...?utm_source=instagram&utm_medium=cpc&utm_campaign=natal`) e lance a verba em **💸 Verba de anúncios** — o painel calcula **ROAS, ROI e ticket médio** por campanha. 🚀

## Fluxo de doação
Clique em doar → **tela grande de checkout** → nome/e-mail **opcionais** → **Gerar PIX** → QR Code grande + copia-e-cola + link de pagamento → polling de status até aprovar ✅.

## Painel ADM (`/admin`) — tudo em tempo real 🔴
Como acessar:
- Local: http://localhost:3000/admin
- Vercel: https://SEU-projeto.vercel.app/admin
- Senha: a do `.env` (`ADMIN_PASSWORD`, padrão `jesus123` — **troque!**)

O que você vê (atualiza sozinho a cada 5s, com alerta 🎉 a cada doação nova):
- **Arrecadado, % da meta, doadores, pendente**, tabela completa (nome, causa, valor, status, link) e **exportar CSV**. A meta começa em **R$0 / 0%** e anda sozinha a cada PIX aprovado.

## Imagens
Fotos HD reais (Unsplash). Pra arte IA do Jesus, gere com:
```
Cinematic ultra-detailed portrait of Jesus Christ with open arms, warm golden light, dark black background, volunteers feeding poor families and dogs at his feet, photorealistic, 8k
```
Salve como `jesus-ia.jpg` e troque no `index.html`.
