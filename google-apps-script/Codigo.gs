/* ==========================================================
   BACKEND GOOGLE — Pedidos de Compra | Cheiro Verde Ambiental
   Transforma a Planilha Google em banco de dados do sistema e
   salva os orçamentos em uma pasta do Google Drive.

   Arquivos deste projeto Apps Script:
     - Codigo.gs  (este arquivo)
     - Engine.gs  (cópia exata de js/engine.js do site)

   Passo a passo completo no arquivo GUIA-GOOGLE.txt
   ========================================================== */

// ---------------- AJUSTES ----------------
const NOME_PASTA_ORCAMENTOS = 'CV Compras - Orçamentos';
const COMPARTILHAR_ARQUIVOS_COM_LINK = true; // true = quem tiver o link do orçamento consegue abrir
const TAMANHO_MAX_ARQUIVO_MB = 10;
const SESSAO_HORAS = 6;                        // tempo até pedir login novamente (máx. 6)
// -----------------------------------------

const FUSO = 'America/Sao_Paulo';

/** Menu dentro da planilha */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CV Compras')
    .addItem('1) Configurar planilha (primeira vez)', 'setup')
    .addItem('Recriar aba Painel', 'criarPainel')
    .addItem('Mostrar link da pasta de orçamentos', 'mostrarPasta')
    .addToUi();
}

function props_() { return PropertiesService.getScriptProperties(); }

function ctx_() {
  const salt = props_().getProperty('SALT') || '';
  return {
    uuid: () => Utilities.getUuid(),
    hash: (s) => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + s, Utilities.Charset.UTF_8)
      .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('')
  };
}

function planilha_() {
  const id = props_().getProperty('SS_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function pasta_() {
  const id = props_().getProperty('PASTA_ID');
  if (!id) throw new Error('Pasta de orçamentos não configurada. Rode o setup.');
  return DriveApp.getFolderById(id);
}

// =====================================================================
// SETUP — cria abas, cabeçalhos, formatação, dados iniciais e a pasta
// =====================================================================
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Abra o Apps Script pela planilha: Extensões > Apps Script.');
  const p = props_();
  p.setProperty('SS_ID', ss.getId());
  if (!p.getProperty('SALT')) p.setProperty('SALT', Utilities.getUuid());
  ss.setSpreadsheetTimeZone(FUSO);

  const T = CVEngine.TABELAS;
  const MOEDA = ['total', 'valorUnit', 'subtotal', 'valor', 'ultimoPreco'];
  Object.keys(T).forEach(nome => {
    const sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    const cols = T[nome];
    if (sh.getMaxColumns() < cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, cols.length).setValues([cols])
      .setFontWeight('bold').setBackground('#1b6b35').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    const linhas = Math.max(sh.getMaxRows() - 1, 1);
    cols.forEach((c, i) => {
      const rg = sh.getRange(2, i + 1, linhas, 1);
      if (CVEngine.TEXTOS.indexOf(c) >= 0) rg.setNumberFormat('@');
      else if (nome !== 'Config' && MOEDA.indexOf(c) >= 0) rg.setNumberFormat('"R$" #,##0.00');
      else if (CVEngine.DATAS.indexOf(c) >= 0) rg.setNumberFormat('dd/MM/yyyy HH:mm');
    });
    if (nome === 'Usuarios') sh.hideColumns(cols.indexOf('senhaHash') + 1);
  });

  // Dados iniciais (somente se as abas estiverem vazias)
  const db = carregar_();
  const base = CVEngine.seed(ctx_(), { demo: false });
  db._dirty = {};
  ['Usuarios', 'Itens', 'Fornecedores', 'Config'].forEach(t => {
    if (!db[t].length) { db[t] = base[t]; db._dirty[t] = true; }
  });
  salvar_(db);

  // Pasta de orçamentos (ao lado da planilha)
  let pasta = null;
  try { pasta = p.getProperty('PASTA_ID') ? DriveApp.getFolderById(p.getProperty('PASTA_ID')) : null; } catch (e) { pasta = null; }
  if (!pasta) {
    const pais = DriveApp.getFileById(ss.getId()).getParents();
    const pai = pais.hasNext() ? pais.next() : DriveApp.getRootFolder();
    pasta = pai.createFolder(NOME_PASTA_ORCAMENTOS);
    p.setProperty('PASTA_ID', pasta.getId());
  }

  criarPainel();

  // Remove a aba padrão vazia
  ['Página1', 'Planilha1', 'Sheet1'].forEach(n => {
    const sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  const msg = 'Planilha configurada!\n\nPasta de orçamentos: ' + pasta.getUrl() +
    '\n\nPróximo passo: Implantar > Nova implantação > App da Web.\n' +
    'IMPORTANTE: troque a senha 1234 dos usuários de demonstração.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* executado pelo editor */ }
}

function mostrarPasta() {
  SpreadsheetApp.getUi().alert('Pasta de orçamentos:\n' + pasta_().getUrl());
}

/** Aba "Painel" com resumos automáticos (alimenta o dashboard de gestores / Looker Studio) */
function criarPainel() {
  const ss = planilha_();
  const sh = ss.getSheetByName('Painel') || ss.insertSheet('Painel', 0);
  sh.clear();
  sh.getRange('A1').setValue('Painel de Compras — Cheiro Verde Ambiental').setFontSize(16).setFontWeight('bold').setFontColor('#1b6b35');
  sh.getRange('A2').setValue('Atualiza sozinho a partir da aba Solicitacoes. Não edite esta aba.').setFontColor('#7b8a81');
  const blocos = [
    ['A4', 'Por status', "select P, count(B), sum(N) where B is not null group by P label P 'Status', count(B) 'Pedidos', sum(N) 'Valor (R$)'"],
    ['E4', 'Aprovado por centro de custo', "select H, sum(N) where P = 'aprovado' or P = 'comprado' group by H order by sum(N) desc label H 'Centro de custo', sum(N) 'Valor aprovado'"],
    ['H4', 'Por mês', "select year(C), month(C)+1, count(B), sum(N) where B is not null group by year(C), month(C)+1 order by year(C), month(C)+1 label year(C) 'Ano', month(C)+1 'Mês', count(B) 'Pedidos', sum(N) 'Valor'"],
    ['M4', 'Fornecedores (comprados)', "select V, count(B), sum(N) where P = 'comprado' group by V order by sum(N) desc limit 15 label V 'Fornecedor', count(B) 'Pedidos', sum(N) 'Valor'"],
    ['Q4', 'Pendentes de aprovação', "select B, C, E, H, N, O where P = 'pendente' order by C label B 'Nº', C 'Criado em', E 'Solicitante', H 'Centro de custo', N 'Total', O 'Nível necessário'"]
  ];
  blocos.forEach(([cel, titulo, q]) => {
    const r = sh.getRange(cel);
    r.setValue(titulo).setFontWeight('bold').setBackground('#e6f4ea');
    r.offset(1, 0).setFormula('=IFERROR(QUERY(Solicitacoes!A:V,"' + q + '",1),"Sem dados")');
  });
  sh.getRange('C:C').setNumberFormat('"R$" #,##0.00');
  sh.getRange('F:F').setNumberFormat('"R$" #,##0.00');
  sh.getRange('K:K').setNumberFormat('"R$" #,##0.00');
  sh.getRange('O:O').setNumberFormat('"R$" #,##0.00');
  sh.getRange('R:R').setNumberFormat('dd/MM/yyyy');
  sh.getRange('U:U').setNumberFormat('"R$" #,##0.00');
  sh.setFrozenRows(2);
}

// =====================================================================
// LEITURA / GRAVAÇÃO DAS ABAS
// Não reordene as colunas. Colunas extras podem ser adicionadas à DIREITA
// (mas serão apagadas ao regravar a aba).
// =====================================================================
function carregar_() {
  const ss = planilha_();
  const db = CVEngine.novoDb();
  Object.keys(CVEngine.TABELAS).forEach(nome => {
    const sh = ss.getSheetByName(nome);
    if (!sh) throw new Error('Aba "' + nome + '" não encontrada. Rode o setup pelo menu CV Compras.');
    const cols = CVEngine.TABELAS[nome];
    const last = sh.getLastRow();
    if (last < 2) return;
    const vals = sh.getRange(2, 1, last - 1, cols.length).getValues();
    db[nome] = vals
      .filter(r => r.some(v => v !== '' && v !== null))
      .map(r => { const o = {}; cols.forEach((c, i) => { o[c] = ler_(c, r[i]); }); return o; });
  });
  return db;
}

function ler_(c, v) {
  if (v instanceof Date) return c === 'dataNecessidade' ? Utilities.formatDate(v, FUSO, 'yyyy-MM-dd') : v.toISOString();
  if (CVEngine.BOOLEANOS.indexOf(c) >= 0) return !(v === false || String(v).toUpperCase() === 'FALSE' || String(v).toUpperCase() === 'FALSO');
  if (CVEngine.NUMEROS.indexOf(c) >= 0) return v === '' || v === null ? '' : Number(v);
  return v === null ? '' : String(v);
}

function gravar_(c, v) {
  if (v === null || v === undefined) return '';
  if (CVEngine.DATAS.indexOf(c) >= 0 && v) { const d = new Date(v); return isNaN(d) ? v : d; }
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v; // evita fórmulas injetadas
  return v;
}

function salvar_(db) {
  if (!db._dirty) return;
  const ss = planilha_();
  Object.keys(db._dirty).forEach(nome => {
    const sh = ss.getSheetByName(nome);
    const cols = CVEngine.TABELAS[nome];
    const linhas = db[nome].map(o => cols.map(c => gravar_(c, o[c])));
    const last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, cols.length).clearContent();
    if (linhas.length) sh.getRange(2, 1, linhas.length, cols.length).setValues(linhas);
  });
  SpreadsheetApp.flush();
}

// =====================================================================
// API (App da Web) — o site conversa com estas funções
// =====================================================================
function doGet() {
  return json_({ ok: true, app: 'CV Compras API', mensagem: 'API funcionando. Cole esta URL em js/config.js (apiUrl).' });
}

function doPost(e) {
  let p;
  try { p = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, erro: 'Requisição inválida.' }); }
  const cache = CacheService.getScriptCache();
  const ttl = Math.min(SESSAO_HORAS, 6) * 3600;
  try {
    // ---- login ----
    if (p.action === 'login') {
      const db = carregar_();
      const u = CVEngine.login(db, p.email, p.senha, ctx_());
      if (!u) return json_({ ok: false, erro: 'E-mail ou senha inválidos.' });
      const token = Utilities.getUuid() + Utilities.getUuid();
      cache.put('t_' + token, u.id, ttl);
      return json_({ ok: true, token: token, state: extras_(CVEngine.estado(db, u), u) });
    }
    // ---- sessão ----
    const userId = p.token ? cache.get('t_' + p.token) : null;
    if (!userId) return json_({ ok: false, sessao: false, erro: 'Sessão expirada. Entre novamente.' });
    if (p.action === 'logout') { cache.remove('t_' + p.token); return json_({ ok: true }); }
    cache.put('t_' + p.token, userId, ttl); // renova

    const somenteLeitura = p.action === 'state';
    const lock = LockService.getScriptLock();
    if (!somenteLeitura) lock.waitLock(25000);
    try {
      const db = carregar_();
      const u = db.Usuarios.filter(x => x.id === userId && x.ativo !== false)[0];
      if (!u) return json_({ ok: false, sessao: false, erro: 'Usuário inativo.' });
      let acao = p.action;
      if (acao === 'uploadOrcamento') { p = salvarArquivo_(p, db, u); acao = 'addOrcamento'; }
      const state = CVEngine.handle(db, acao, p, u, ctx_());
      salvar_(db);
      return json_({ ok: true, state: extras_(state, u) });
    } finally {
      if (!somenteLeitura) lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, erro: err && err.message ? err.message : String(err) });
  }
}

function extras_(state, u) {
  state.extra = state.extra || {};
  state.extra.modo = 'google';
  if (Number(u.nivel) >= 3) {
    try { state.extra.planilhaUrl = planilha_().getUrl(); } catch (e) {}
    try { state.extra.pastaUrl = pasta_().getUrl(); } catch (e) {}
  }
  return state;
}

function salvarArquivo_(p, db, u) {
  const r = db.Solicitacoes.filter(x => x.id === p.solicitacaoId)[0];
  if (!r) throw new Error('Solicitação não encontrada.');
  if (r.solicitanteId !== u.id && Number(u.nivel) < 2) throw new Error('Somente o solicitante ou um aprovador pode anexar orçamentos.');
  if (!p.base64) throw new Error('Arquivo não recebido.');
  const bytes = Utilities.base64Decode(p.base64);
  if (bytes.length > TAMANHO_MAX_ARQUIVO_MB * 1024 * 1024) throw new Error('Arquivo maior que ' + TAMANHO_MAX_ARQUIVO_MB + ' MB.');
  const raiz = pasta_();
  const it = raiz.getFoldersByName(r.numero);
  const sub = it.hasNext() ? it.next() : raiz.createFolder(r.numero);
  const nomeArq = r.numero + ' - ' + (p.fornecedor ? p.fornecedor + ' - ' : '') + (p.nome || 'orcamento');
  const file = sub.createFile(Utilities.newBlob(bytes, p.mime || 'application/octet-stream', nomeArq));
  if (COMPARTILHAR_ARQUIVOS_COM_LINK) {
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* domínio pode bloquear */ }
  }
  return { solicitacaoId: r.id, fornecedor: p.fornecedor, valor: p.valor, arquivoNome: p.nome, arquivoUrl: file.getUrl() };
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Teste rápido pelo editor: Executar > testeLogin (veja o registro) */
function testeLogin() {
  const db = carregar_();
  const u = CVEngine.login(db, 'gerente@cheiroverde.com.br', '1234', ctx_());
  Logger.log(u ? 'Login OK: ' + u.nome : 'Login falhou (senha já foi trocada?)');
}
