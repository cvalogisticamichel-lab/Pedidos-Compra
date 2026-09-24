/* ==========================================================
   MOTOR DE REGRAS — Cheiro Verde Ambiental | Pedidos de Compra
   Este MESMO arquivo roda em dois lugares:
     1) no navegador (modo demonstração, dados no localStorage);
     2) no Google Apps Script (copie-o como "Engine.gs").
   Assim a regra de alçada é validada no servidor em produção.
   Trabalha com tabelas "planas" — cada tabela vira uma aba da planilha.
   ========================================================== */
var CVEngine = (function () {
  'use strict';

  // Cada chave = nome da aba na planilha; valores = colunas (ordem da planilha)
  var TABELAS = {
    Solicitacoes: ['id', 'numero', 'criadoEm', 'solicitanteId', 'solicitanteNome', 'nivelSolicitante', 'filial', 'centroCusto', 'categoria', 'fornecedor', 'urgencia', 'dataNecessidade', 'justificativa', 'total', 'nivelNecessario', 'status', 'aprovadorId', 'aprovadorNome', 'nivelAprovador', 'decididoEm', 'compradoEm', 'fornecedorFinal', 'condicaoPagamento', 'numeroPdf', 'cidade', 'pdfUrl', 'pdfId', 'orcIncompleto', 'qtdOrcamentos', 'valorFrete', 'prazoEntrega', 'departamento', 'emailEnviadoEm', 'modalidade', 'tipoManutencao', 'manutencaoId', 'manutencaoDesc', 'manutPdfEm', 'manutPdfUrl'],
    Itens_Solicitacao: ['solicitacaoId', 'numero', 'seq', 'itemId', 'descricao', 'qtd', 'unidade', 'valorUnit', 'subtotal', 'tipo', 'prazo'],
    Historico: ['solicitacaoId', 'numero', 'em', 'usuario', 'acao', 'obs'],
    Orcamentos: ['id', 'solicitacaoId', 'numero', 'fornecedor', 'valor', 'arquivoNome', 'arquivoUrl', 'enviadoPor', 'em'],
    Itens: ['id', 'codigo', 'descricao', 'unidade', 'categoria', 'fornecedorPreferido', 'ultimoPreco', 'ultimaCompra', 'ativo', 'criadoEm'],
    Fornecedores: ['id', 'nome', 'cnpj', 'contato', 'telefone', 'email', 'cidade', 'categorias', 'ativo', 'criadoEm', 'nomeFantasia', 'endereco', 'uf', 'cep', 'situacao', 'atividade', 'inscricaoEstadual', 'statusCred', 'cadastradoPor', 'credAnalisadoPor', 'credAnalisadoEm', 'credObs', 'credAlteracoes'],
    Listas: ['filial', 'modalidade', 'categoria', 'unidade', 'departamento'],
    Historico_Precos: ['em', 'itemId', 'codigo', 'descricao', 'fornecedor', 'unidade', 'qtd', 'valorUnit', 'numero', 'solicitacaoId'],
    Usuarios: ['id', 'nome', 'email', 'senhaHash', 'nivel', 'filial', 'ativo', 'criadoEm', 'cpf', 'status', 'aprovadoPor', 'aprovadoEm', 'obsAcesso', 'assinatura', 'tokenAssinatura', 'departamento'],
    Config: ['chave', 'valor'],
    Placas: ['placa', 'descricao', 'ativo', 'atualizadoEm', 'removidaEm']   // cópia da aba Placas da planilha da frota
  };
  // Tipos para conversão ao ler/gravar na planilha
  var NUMEROS = ['valorFrete', 'nivelSolicitante', 'total', 'nivelNecessario', 'nivelAprovador', 'seq', 'qtd', 'valorUnit', 'subtotal', 'valor', 'ultimoPreco', 'nivel'];
  var DATAS = ['criadoEm', 'decididoEm', 'compradoEm', 'em', 'ultimaCompra', 'aprovadoEm', 'credAnalisadoEm', 'emailEnviadoEm', 'atualizadoEm', 'removidaEm', 'manutPdfEm'];
  var BOOLEANOS = ['ativo'];
  var TEXTOS = ['numero', 'dataNecessidade', 'cnpj', 'telefone', 'codigo', 'senhaHash', 'chave', 'cep', 'filial', 'centroCusto', 'categoria', 'unidade', 'inscricaoEstadual', 'cpf', 'numeroPdf', 'tokenAssinatura', 'departamento', 'prazoEntrega', 'modalidade', 'tipoManutencao', 'tipo', 'prazo', 'placa', 'descricao', 'manutencaoId', 'manutencaoDesc'];

  var PADRAO = { limites: { 1: 2000, 2: 10000, 3: 50000 } };
  var NOMES = { 1: 'Comprador', 2: 'Supervisor', 3: 'Gerente', 4: 'Diretoria', 5: 'Financeiro' };
  var FINANCEIRO = 5;   // perfil somente consulta
  function fin(u) { return !!u && Number(u.nivel) === FINANCEIRO; }
  function nivelDe(u) { return fin(u) ? 0 : Number(u.nivel) || 0; }   // nível para permissões
  var ACOES_CONSULTA = { state: 1, assinaturas: 1, changePassword: 1, salvarMinhaAssinatura: 1, gerarLinkAssinatura: 1 };
  // ===== ACESSOS =====
  var DOMINIO_AUTORIZADO = 'cheiroverdeambiental.com.br';
  var EMAILS_EXTERNOS_AUTORIZADOS = {       // diretores (e-mails fora do domínio)
    'shiogabra@hotmail.com': 'Norio Shioga',
    'carlameleck@hotmail.com': 'Carla Méleck'
  };
  var SUPER_ADMIN = 'michel@cheiroverdeambiental.com.br'; // único que vê/edita "Alçadas e regras"
  function emailAutorizado(e) { e = String(e || '').trim().toLowerCase(); return /^[^@\s]+@cheiroverdeambiental\.com\.br$/.test(e) || !!EMAILS_EXTERNOS_AUTORIZADOS[e]; }
  function ehSuperAdmin(u) { return !!u && String(u.email || '').trim().toLowerCase() === SUPER_ADMIN; }
  function statusUsuario(u) { return u.status || (u.ativo === false ? 'inativo' : 'ativo'); }
  // Valores iniciais da aba "Listas" (base de dados das listas de validação)
  var LISTAS_PADRAO = {
    filial: ['Bernardino de Campos (Matriz)', 'Assis', 'São Manuel', 'Botucatu'],
    modalidade: ['Operações - Coleta', 'Manutenção de Veículos', 'Frota e Manutenção', 'Tratamento de Resíduos', 'Segurança do Trabalho', 'Administrativo', 'TI', 'Comercial'],
    categoria: ['EPI', 'Materiais de consumo', 'Embalagens e coletores', 'Peças e manutenção', 'Combustível', 'Equipamentos', 'Serviços', 'TI', 'Escritório'],
    unidade: ['un', 'cx', 'pct', 'kg', 'L', 'm', 'serv', 'h'],
    departamento: ['Logística', 'Administrativo', 'Comercial', 'Operacional']
  };
  var TIPOS_LISTA = { departamento: 'Departamento', modalidade: 'Modalidade', filial: 'Filial (centro de custo)', categoria: 'Categoria de itens', unidade: 'Unidade' };
  // ===== SOLICITAÇÃO: modalidade, categoria, manutenção de veículos =====
  var MODALIDADE_VEICULOS = 'Manutenção de Veículos';
  function ehVeiculo(m) { return semAc(m) === semAc(MODALIDADE_VEICULOS); }
  function semAc(s) { return norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  var CAT_PRODUTOS = 'Compra de Peças', CAT_SERVICOS = 'Prestação de Serviços', CAT_AMBOS = 'Peças + Serviços', CAT_CONSUMIVEIS = 'Consumíveis';
  var TIPOS_COMPRA = [CAT_PRODUTOS, CAT_SERVICOS, CAT_AMBOS, CAT_CONSUMIVEIS];   // Manutenção de Veículos
  var CAT_MAT_SERV = 'Materiais + Serviços';
  // Categorias das demais modalidades.  p = só itens · s = só serviços · a = itens + serviços
  var CATEGORIAS_GERAIS = [
    ['Materiais de Escritório', 'p'], ['Materiais de Limpeza e Higiene', 'p'], ['EPI e Uniformes', 'p'], ['Embalagens e Coletores', 'p'],
    ['Equipamentos e Ferramentas', 'p'], ['Informática e Tecnologia', 'p'], ['Consumíveis Operacionais', 'p'], ['Copa e Alimentação', 'p'],
    ['Prestação de Serviços', 's'], [CAT_MAT_SERV, 'a'], ['Outras Compras', 'p']
  ];
  var TIPO_CAT = {}; CATEGORIAS_GERAIS.forEach(function (c) { TIPO_CAT[c[0]] = c[1]; });
  TIPO_CAT[CAT_PRODUTOS] = 'p'; TIPO_CAT[CAT_SERVICOS] = 's'; TIPO_CAT[CAT_AMBOS] = 'a'; TIPO_CAT[CAT_CONSUMIVEIS] = 'p';
  /** Categorias oferecidas para a modalidade */
  function categoriasDe(modalidade) { return ehVeiculo(modalidade) ? TIPOS_COMPRA.slice() : CATEGORIAS_GERAIS.map(function (c) { return c[0]; }); }
  var CAT_ANTIGAS = { 'Compra de Produtos': CAT_PRODUTOS, 'Ambos (Produtos + Serviços)': CAT_AMBOS };   // nomes da v2.9
  function temProdutos(cat) { return (TIPO_CAT[cat] || 'p') !== 's'; }
  function temServicos(cat) { var t = TIPO_CAT[cat]; return t === 's' || t === 'a'; }
  /** Título do quadro de itens conforme a categoria */
  function rotuloProdutos(cat) { return cat === CAT_CONSUMIVEIS ? 'Consumíveis' : (cat === CAT_PRODUTOS || cat === CAT_AMBOS) ? 'Peças' : cat === CAT_MAT_SERV ? 'Materiais' : 'Itens'; }
  // Listas de validação: Gerentes destes departamentos NÃO criam/removem valores (Departamento, Modalidade, Centro de custo, Categoria...)
  var DEPARTAMENTOS_SEM_EDICAO_LISTAS = ['Operacional'];
  function podeEditarListas(u) {
    if (!u) return false;
    if (ehSuperAdmin(u)) return true;
    if (nivelDe(u) < 3) return false;
    return !DEPARTAMENTOS_SEM_EDICAO_LISTAS.some(function (d) { return norm(d) === norm(u.departamento); });
  }
  var TIPOS_MANUTENCAO = ['Manutenção Preventiva', 'Manutenção Corretiva', 'Pneus', 'Funilaria', 'Outros'];
  function linhaListaVazia() { var r = {}; Object.keys(TIPOS_LISTA).forEach(function (k) { r[k] = ''; }); return r; }

  // ---------- utilidades ----------
  function agora() { return new Date().toISOString(); }
  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function txt(s) { return String(s == null ? '' : s).trim(); }
  function norm(s) { return txt(s).toLowerCase().replace(/\s+/g, ' '); }
  function erro(m) { throw new Error(m); }
  function sujar(db) { db._dirty = db._dirty || {}; for (var i = 1; i < arguments.length; i++) db._dirty[arguments[i]] = true; }
  function pad(n, t) { n = String(n); while (n.length < t) n = '0' + n; return n; }
  function agrupar(arr, k) { var o = {}; arr.forEach(function (x) { (o[x[k]] = o[x[k]] || []).push(x); }); return o; }
  function porId(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }

  function novoDb() { var db = {}; Object.keys(TABELAS).forEach(function (t) { db[t] = []; }); return db; }

  function cfg(db, k, d) { for (var i = 0; i < db.Config.length; i++) if (db.Config[i].chave === k) return db.Config[i].valor; return d; }
  function setCfg(db, k, v) {
    for (var i = 0; i < db.Config.length; i++) if (db.Config[i].chave === k) { db.Config[i].valor = v; sujar(db, 'Config'); return; }
    db.Config.push({ chave: k, valor: v }); sujar(db, 'Config');
  }
  function proximo(db, chave) { var n = (Number(cfg(db, chave, 0)) || 0) + 1; setCfg(db, chave, n); return n; }

  function limites(db) {
    var dep = {};
    db.Config.forEach(function (c) { var k = String(c.chave); if (k.indexOf('limite_ger_') === 0 && c.valor !== '' && Number(c.valor) > 0) dep[k.slice(11)] = Number(c.valor); });
    return {
      1: Number(cfg(db, 'limite_1', PADRAO.limites[1])),
      2: Number(cfg(db, 'limite_2', PADRAO.limites[2])),
      3: Number(cfg(db, 'limite_3', PADRAO.limites[3])),
      dep: dep     // teto do Gerente por departamento (vazio = usa o limite padrão do Gerente)
    };
  }
  /** Teto do gerente de um departamento */
  function limiteGerente(lim, dep) {
    var d = lim.dep || {};
    for (var k in d) if (norm(k) === norm(dep)) return Number(d[k]);
    return Number(lim[3]);
  }
  /** Alçada de um usuário (Gerente: teto do seu departamento) */
  function limiteDoUsuario(lim, u) {
    var n = nivelDe(u);
    if (n === 3) return limiteGerente(lim, u.departamento);
    return n >= 1 && n <= 2 ? Number(lim[n]) : 0;
  }
  function maiorTetoGerente(lim) { var m = Number(lim[3]); for (var k in (lim.dep || {})) m = Math.max(m, Number(lim.dep[k])); return m; }
  function minOrcamentos(db) { var v = cfg(db, 'min_orcamentos', 3); return v === '' || v == null || isNaN(Number(v)) ? 3 : Number(v); }
  function nivelNecessario(lim, total) { if (total <= Number(lim[1])) return 1; if (total <= Number(lim[2])) return 2; if (total <= maiorTetoGerente(lim)) return 3; return 4; }
  function mesmoDep(a, b) { return norm(a) === norm(b); }
  /** Quem pode ver uma solicitação: Comprador = só as próprias; Supervisor = as do seu departamento; Gerente e Financeiro = todas */
  function podeVer(u, r) {
    if (!u) return false;
    if (r.solicitanteId === u.id || fin(u) || nivelDe(u) >= 3) return true;
    return nivelDe(u) === 2 && mesmoDep(r.departamento, u.departamento);
  }
  function podeAprovar(u, r, lim) {
    if (!u || fin(u) || r.status !== 'pendente') return false;
    var nn = Number(r.nivelNecessario), n = nivelDe(u);
    if (nn > n || nn > 3) return false;
    if (n === 2 && !mesmoDep(r.departamento, u.departamento)) return false;   // Supervisor: só o próprio departamento
    if (n === 3 && lim && Number(r.total) > limiteGerente(lim, u.departamento)) return false;   // Gerente: até o teto dele
    return true;
  }
  function publico(u) { return { id: u.id, nome: u.nome, email: u.email, nivel: Number(u.nivel) || 0, filial: u.filial, ativo: u.ativo !== false, status: statusUsuario(u), cpf: u.cpf || '', criadoEm: u.criadoEm || '', aprovadoPor: u.aprovadoPor || '', aprovadoEm: u.aprovadoEm || '', obsAcesso: u.obsAcesso || '', temAssinatura: !!u.assinatura, departamento: u.departamento || '' }; }
  function hist(db, r, usuario, acao, obs, em) {
    db.Historico.push({ solicitacaoId: r.id, numero: r.numero, em: em || agora(), usuario: usuario, acao: acao, obs: txt(obs) });
    sujar(db, 'Historico');
  }
  function itemPorDescricao(db, d) { var n = norm(d); for (var i = 0; i < db.Itens.length; i++) if (norm(db.Itens[i].descricao) === n) return db.Itens[i]; return null; }
  /** Fornecedor da solicitação ainda não credenciado? (vazio = sem fornecedor, não bloqueia) */
  function situacaoFornecedor(db, nome) {
    if (!txt(nome)) return { ok: true };
    var f = fornPorNome(db, nome);
    if (!f) return { ok: false, motivo: 'não cadastrado', fornecedor: null };
    if (f.statusCred === 'pendente') return { ok: false, motivo: 'aguardando credenciamento', fornecedor: f };
    if (f.statusCred === 'recusado') return { ok: false, motivo: 'com credenciamento recusado', fornecedor: f };
    return { ok: true, fornecedor: f };
  }
  function fornPorNome(db, nome) { var n = norm(nome); for (var i = 0; i < db.Fornecedores.length; i++) if (norm(db.Fornecedores[i].nome) === n) return db.Fornecedores[i]; return null; }

  // ---------- listas (aba Listas: uma coluna por lista) ----------
  function linhasListasPadrao() {
    var max = 0, rows = [];
    Object.keys(LISTAS_PADRAO).forEach(function (k) { max = Math.max(max, LISTAS_PADRAO[k].length); });
    for (var i = 0; i < max; i++) {
      var r = {}; Object.keys(LISTAS_PADRAO).forEach(function (k) { r[k] = LISTAS_PADRAO[k][i] || ''; }); rows.push(r);
    }
    return rows;
  }
  function listas(db) {
    var out = {};
    Object.keys(TIPOS_LISTA).forEach(function (k) {
      var vistos = {}, l = [];
      (db.Listas || []).forEach(function (r) { var v = txt(r[k]); if (v && !vistos[norm(v)]) { vistos[norm(v)] = 1; l.push(v); } });
      out[k] = l.length ? l : LISTAS_PADRAO[k].slice();
    });
    return out;
  }
  function addLista(db, tipo, valor) {
    if (!TIPOS_LISTA[tipo]) erro('Lista inválida.');
    valor = txt(valor); if (!valor) erro('Informe o valor.');
    db.Listas = db.Listas || [];
    if (!db.Listas.some(function (r) { return txt(r[tipo]); })) { // coluna vazia usa o padrão: grava o padrão antes
      LISTAS_PADRAO[tipo].forEach(function (v, i) { if (!db.Listas[i]) db.Listas[i] = linhaListaVazia(); db.Listas[i][tipo] = v; });
    }
    if (listas(db)[tipo].some(function (v) { return norm(v) === norm(valor); })) erro('"' + valor + '" já existe na lista de ' + TIPOS_LISTA[tipo] + '.');
    var livre = null;
    for (var i = 0; i < db.Listas.length; i++) if (!txt(db.Listas[i][tipo])) { livre = db.Listas[i]; break; }
    if (livre) livre[tipo] = valor;
    else { var r = linhaListaVazia(); r[tipo] = valor; db.Listas.push(r); }
    sujar(db, 'Listas');
  }
  function removeLista(db, tipo, valor) {
    if (!TIPOS_LISTA[tipo]) erro('Lista inválida.');
    db.Listas = db.Listas || [];
    var vals = listas(db)[tipo].filter(function (v) { return norm(v) !== norm(valor); });
    if (!vals.length) erro('A lista precisa ter ao menos um valor.');
    // reescreve a coluna compactada (sem buracos)
    var n = Math.max(db.Listas.length, vals.length);
    for (var i = 0; i < n; i++) {
      if (!db.Listas[i]) db.Listas[i] = linhaListaVazia();
      db.Listas[i][tipo] = vals[i] || '';
    }
    db.Listas = db.Listas.filter(function (r) { return Object.keys(TIPOS_LISTA).some(function (k) { return txt(r[k]); }); });
    sujar(db, 'Listas');
  }

  // ---------- migração de dados antigos (v2.9: Modalidade / Centro de custo) ----------
  function migrar(db) {
    var mudou = false;
    db.Placas = db.Placas || [];
    (db.Listas || []).forEach(function (r) { if (r.centroCusto !== undefined) { if (!txt(r.modalidade)) r.modalidade = r.centroCusto; delete r.centroCusto; mudou = true; } });
    if (mudou) sujar(db, 'Listas');
    if (String(cfg(db, 'migr_v29', '')) !== '1') {
      // antes: "Centro de custo" guardava o que agora é Modalidade, e a Filial virou o Centro de custo
      db.Solicitacoes.forEach(function (r) {
        if (!txt(r.modalidade)) { r.modalidade = txt(r.centroCusto); r.centroCusto = txt(r.filial) || txt(r.centroCusto); }
      });
      db.Itens_Solicitacao.forEach(function (i) { if (!i.tipo) i.tipo = 'produto'; });
      if ((db.Listas || []).some(function (r) { return txt(r.modalidade); }) && !listas(db).modalidade.some(function (v) { return ehVeiculo(v); })) addLista(db, 'modalidade', MODALIDADE_VEICULOS);
      setCfg(db, 'migr_v29', '1');
      sujar(db, 'Solicitacoes', 'Itens_Solicitacao');
      mudou = true;
    }
    if (String(cfg(db, 'migr_v292', '')) !== '1') {   // v2.9.2: categorias renomeadas
      db.Solicitacoes.forEach(function (r) { if (CAT_ANTIGAS[r.categoria]) r.categoria = CAT_ANTIGAS[r.categoria]; });
      setCfg(db, 'migr_v292', '1'); sujar(db, 'Solicitacoes'); mudou = true;
    }
    return mudou;
  }
  /** Sincroniza as placas lidas da planilha da frota: novas entram, removidas ficam inativas (histórico preservado) */
  function sincronizarPlacas(db, lista, em) {
    em = em || agora();
    var vistas = {}, mudou = false;
    db.Placas = db.Placas || [];
    (lista || []).forEach(function (x) {
      var pl = txt(x.placa).toUpperCase(); if (!pl || vistas[pl]) return; vistas[pl] = 1;
      var ex = db.Placas.filter(function (y) { return txt(y.placa).toUpperCase() === pl; })[0];
      if (!ex) { db.Placas.push({ placa: pl, descricao: txt(x.descricao), ativo: true, atualizadoEm: em, removidaEm: '' }); mudou = true; }
      else if (ex.ativo === false || (txt(x.descricao) && txt(ex.descricao) !== txt(x.descricao))) { ex.ativo = true; ex.removidaEm = ''; if (txt(x.descricao)) ex.descricao = txt(x.descricao); ex.atualizadoEm = em; mudou = true; }
    });
    db.Placas.forEach(function (y) { if (y.ativo !== false && !vistas[txt(y.placa).toUpperCase()]) { y.ativo = false; y.removidaEm = em; mudou = true; } });
    if (mudou) sujar(db, 'Placas');
    return { mudou: mudou, ativas: Object.keys(vistas).length, total: db.Placas.length };
  }

  // ---------- CPF / CNPJ ----------
  function digitos(s) { return String(s || '').replace(/\D/g, ''); }
  function cnpjValido(c) {
    c = digitos(c); if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    var calc = function (n) { var s = 0, p = n - 7; for (var i = 0; i < n; i++) { s += c[i] * p--; if (p < 2) p = 9; } var r = s % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === +c[12] && calc(13) === +c[13];
  }
  function cpfValido(c) {
    c = digitos(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    for (var t = 9; t < 11; t++) { var s = 0; for (var i = 0; i < t; i++) s += c[i] * (t + 1 - i); var d = ((10 * s) % 11) % 10; if (+c[t] !== d) return false; }
    return true;
  }
  function formatarDoc(s) {
    var d = digitos(s);
    if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return txt(s);
  }
  function titulo(s) { return txt(s).toLowerCase().replace(/(^|\s)\S/g, function (m) { return m.toUpperCase(); }).replace(/ (De|Da|Do|Das|Dos|E) /g, function (m) { return m.toLowerCase(); }); }
  function fmtTel(t) {
    t = digitos(t);
    return /^\d{10,11}$/.test(t) ? '(' + t.slice(0, 2) + ') ' + t.slice(2, t.length - 4) + '-' + t.slice(-4) : t;
  }
  /** Converte a resposta da CNPJá (open), BrasilAPI ou ReceitaWS para um formato único */
  function normalizarCnpj(j) {
    if (!j) erro('CNPJ não encontrado.');
    if (j.status === 'ERROR') erro(j.message || 'CNPJ não encontrado.');
    if (j.taxId || j.company) { // CNPJá
      var a = j.address || {}, ie = '';
      var regs = (j.registrations || []).filter(function (r) { return r && r.number; });
      var r1 = regs.filter(function (r) { return r.enabled !== false && (!a.state || r.state === a.state); })[0] || regs[0];
      if (r1) ie = txt(r1.number);
      var ph = (j.phones || [])[0];
      return {
        cnpj: formatarDoc(j.taxId), razaoSocial: txt(j.company && j.company.name), nomeFantasia: txt(j.alias),
        situacao: txt(j.status && j.status.text).toUpperCase(),
        endereco: [a.street, a.number, a.details, a.district].map(txt).filter(Boolean).join(', '),
        cidade: txt(a.city), uf: txt(a.state).toUpperCase(), cep: txt(a.zip),
        telefone: ph ? fmtTel(txt(ph.area) + txt(ph.number)) : '', email: txt(((j.emails || [])[0] || {}).address).toLowerCase(),
        atividade: txt(j.mainActivity && j.mainActivity.text), inscricaoEstadual: ie
      };
    }
    var tel = j.ddd_telefone_1 ? fmtTel(j.ddd_telefone_1) : txt(j.telefone);
    var ativ = j.cnae_fiscal_descricao || (j.atividade_principal && j.atividade_principal[0] && j.atividade_principal[0].text) || '';
    return {
      cnpj: formatarDoc(j.cnpj), razaoSocial: txt(j.razao_social || j.nome), nomeFantasia: txt(j.nome_fantasia || j.fantasia),
      situacao: txt(j.descricao_situacao_cadastral || j.situacao).toUpperCase(),
      endereco: [j.logradouro, j.numero, j.complemento, j.bairro].map(txt).filter(Boolean).join(', '),
      cidade: titulo(j.municipio), uf: txt(j.uf).toUpperCase(), cep: txt(j.cep),
      telefone: tel, email: txt(j.email).toLowerCase(), atividade: txt(ativ), inscricaoEstadual: ''
    };
  }

  // ---------- estado entregue à interface ----------
  function estado(db, u, extra) {
    var itensBy = agrupar(db.Itens_Solicitacao, 'solicitacaoId');
    var histBy = agrupar(db.Historico, 'solicitacaoId');
    var orcBy = agrupar(db.Orcamentos, 'solicitacaoId');
    var reqs = db.Solicitacoes
      .filter(function (r) { return podeVer(u, r); })
      .map(function (r) {
        var o = {}; for (var k in r) o[k] = r[k];
        o.itens = (itensBy[r.id] || []).slice().sort(function (a, b) { return a.seq - b.seq; });
        o.historico = (histBy[r.id] || []).slice().sort(function (a, b) { return String(a.em).localeCompare(String(b.em)); });
        o.orcamentos = (orcBy[r.id] || []).slice();
        return o;
      })
      .sort(function (a, b) { return String(b.criadoEm).localeCompare(String(a.criadoEm)); });
    var precos = (nivelDe(u) < 2 && !fin(u) ? [] : db.Historico_Precos).slice().sort(function (a, b) { return String(b.em).localeCompare(String(a.em)); }).slice(0, 3000);
    return {
      user: publico(u),
      limites: limites(db),
      minOrcamentos: minOrcamentos(db),
      superAdmin: ehSuperAdmin(u),
      acessosPendentes: nivelDe(u) >= 3 ? db.Usuarios.filter(function (x) { return x.status === 'pendente'; }).length : 0,
      fornecedoresPendentes: nivelDe(u) >= 3 ? db.Fornecedores.filter(function (x) { return x.statusCred === 'pendente'; }).length : 0,
      temAssinatura: !!u.assinatura,
      requests: reqs,
      users: nivelDe(u) >= 3 ? db.Usuarios.map(publico) : [],
      listas: listas(db),
      placas: (db.Placas || []).map(function (x) { return { placa: x.placa, descricao: x.descricao, ativo: x.ativo !== false }; }).sort(function (a, b) { return String(a.placa).localeCompare(String(b.placa)); }),
      catalogo: db.Itens.slice().sort(function (a, b) { return String(a.descricao).localeCompare(String(b.descricao)); }),
      fornecedores: db.Fornecedores.slice().sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); }),
      precos: precos,
      extra: extra || {}
    };
  }

  // ---------- operações internas ----------
  function criar(db, u, d, ctx, em) {
    em = em || agora();
    var lim = limites(db);
    var modalidade = txt(d.modalidade), veic = ehVeiculo(modalidade), cat = txt(d.categoria), tipoMan = '';
    if (!modalidade) erro('Informe a modalidade.');
    if (!txt(d.centroCusto)) erro(veic ? 'Informe a placa do veículo (centro de custo).' : 'Informe o centro de custo.');
    var catsOk = categoriasDe(modalidade);
    if (catsOk.indexOf(cat) < 0) erro('Informe a categoria: ' + catsOk.join(', ') + '.');
    if (veic) {
      var pl = (db.Placas || []).filter(function (x) { return norm(x.placa) === norm(d.centroCusto); })[0];
      if (!pl || pl.ativo === false) erro('Placa "' + txt(d.centroCusto) + '" não encontrada entre as placas ativas da frota.');
      tipoMan = txt(d.tipoManutencao);
      if (TIPOS_MANUTENCAO.indexOf(tipoMan) < 0) erro('Informe o tipo de manutenção.');
      if (tipoMan === 'Outros') { if (!txt(d.tipoManutencaoOutro)) erro('Descreva o tipo de manutenção (Outros).'); tipoMan = 'Outros: ' + txt(d.tipoManutencaoOutro); }
    }
    if (!txt(d.justificativa)) erro('Informe o motivo da compra.');
    if (!txt(d.condicaoPagamento)) erro('Informe a condição de pagamento.');
    var itens = (d.itens || []).map(function (i) {
      var serv = i.tipo === 'servico';
      return { itemId: serv ? '' : txt(i.itemId), descricao: txt(i.descricao), unidade: serv ? 'serv' : (txt(i.unidade) || 'un'), qtd: serv ? 1 : Number(i.qtd) || 0, valorUnit: r2(i.valorUnit), tipo: serv ? 'servico' : 'produto', prazo: serv ? txt(i.prazo) : '' };
    }).filter(function (i) { return i.descricao && i.qtd > 0 && (i.tipo === 'servico' ? temServicos(cat) : temProdutos(cat)); });
    if (temProdutos(cat) && !itens.some(function (i) { return i.tipo === 'produto'; })) erro('Inclua ao menos um produto com descrição e quantidade.');
    if (temServicos(cat) && !itens.some(function (i) { return i.tipo === 'servico'; })) erro('Inclua ao menos um serviço com descrição e valor.');
    var frete = r2(d.valorFrete); if (frete < 0) erro('Valor do frete inválido.');
    if (!txt(d.prazoEntrega)) erro('Informe o prazo de entrega.');
    var total = r2(itens.reduce(function (s, i) { return s + i.qtd * i.valorUnit; }, 0) + frete);
    if (total <= 0) erro('O valor total precisa ser maior que zero.');
    var ano = em.slice(0, 4);
    var r = {
      id: ctx.uuid(), numero: 'PC-' + ano + '-' + pad(proximo(db, 'seq_pedido'), 4), criadoEm: em,
      solicitanteId: u.id, solicitanteNome: u.nome, nivelSolicitante: Number(u.nivel),
      filial: veic ? txt(u.filial) : txt(d.centroCusto), centroCusto: veic ? txt(d.centroCusto).toUpperCase() : txt(d.centroCusto), categoria: cat,
      fornecedor: txt(d.fornecedor), urgencia: txt(d.urgencia), dataNecessidade: txt(d.dataNecessidade),
      justificativa: txt(d.justificativa), total: total, nivelNecessario: nivelNecessario(lim, total),
      status: 'pendente', aprovadorId: '', aprovadorNome: '', nivelAprovador: '', decididoEm: '', compradoEm: '', fornecedorFinal: '',
      condicaoPagamento: txt(d.condicaoPagamento), numeroPdf: '', cidade: txt(d.cidade), pdfUrl: '', pdfId: '', orcIncompleto: !!d.orcIncompleto, qtdOrcamentos: Number(d.qtdOrcamentos) || 0,
      valorFrete: frete, prazoEntrega: txt(d.prazoEntrega), departamento: txt(d.departamento) || txt(u.departamento), emailEnviadoEm: '',
      modalidade: modalidade, tipoManutencao: tipoMan,
      manutencaoId: veic ? txt(d.manutencaoId) : '', manutencaoDesc: veic && txt(d.manutencaoId) ? txt(d.manutencaoDesc) : '', manutPdfEm: '', manutPdfUrl: ''
    };
    if (r.orcIncompleto && r.nivelNecessario < 3) r.nivelNecessario = 3;   // sem os orçamentos mínimos: sempre Gerente
    var sf = situacaoFornecedor(db, r.fornecedor);
    if (!sf.ok && r.nivelNecessario < 3) r.nivelNecessario = 3;            // fornecedor não credenciado: sempre Gerente
    db.Solicitacoes.push(r);
    itens.forEach(function (i, k) {
      if (!i.itemId && i.tipo !== 'servico') { var c = itemPorDescricao(db, i.descricao); if (c) i.itemId = c.id; }
      db.Itens_Solicitacao.push({ solicitacaoId: r.id, numero: r.numero, seq: k + 1, itemId: i.itemId, descricao: i.descricao, qtd: i.qtd, unidade: i.unidade, valorUnit: i.valorUnit, subtotal: r2(i.qtd * i.valorUnit), tipo: i.tipo, prazo: i.prazo });
    });
    sujar(db, 'Solicitacoes', 'Itens_Solicitacao');
    hist(db, r, u.nome, 'Solicitação criada', '', em);
    if (sf.ok && !r.orcIncompleto && r.nivelNecessario <= 3 && total <= limiteDoUsuario(lim, u)) {
      r.status = 'aprovado'; r.aprovadorId = u.id; r.aprovadorNome = u.nome; r.nivelAprovador = Number(u.nivel); r.decididoEm = em;
      numerarPedido(db, r, em);
      hist(db, r, u.nome, 'Aprovado dentro da própria alçada — Pedido de Compra Nº ' + r.numeroPdf, '', em);
    } else {
      hist(db, r, 'Sistema', 'Aguardando autorização: ' + NOMES[r.nivelNecessario] + (r.orcIncompleto ? ' (enviada com ' + r.qtdOrcamentos + ' orçamento(s), abaixo do mínimo)' : '') + (sf.ok ? '' : ' — fornecedor ' + sf.motivo), '', em);
    }
    return r;
  }

  function decidir(db, r, u, aprovar, obs, em) {
    if (!podeAprovar(u, r, limites(db))) erro('Você não tem alçada para decidir esta solicitação.');
    if (aprovar) { var sfd = situacaoFornecedor(db, r.fornecedor); if (!sfd.ok) erro('O fornecedor "' + r.fornecedor + '" está ' + sfd.motivo + '. Valide o credenciamento do fornecedor antes de autorizar.'); }
    if (!aprovar && !txt(obs)) erro('Informe o motivo da reprovação.');
    em = em || agora();
    r.status = aprovar ? 'aprovado' : 'reprovado';
    r.aprovadorId = u.id; r.aprovadorNome = u.nome; r.nivelAprovador = Number(u.nivel); r.decididoEm = em;
    if (aprovar) numerarPedido(db, r, em);
    sujar(db, 'Solicitacoes');
    hist(db, r, u.nome, aprovar ? 'Autorizado — Pedido de Compra Nº ' + r.numeroPdf : 'Reprovado', obs, em);
  }
  /** E-mails dos gerentes do departamento (se não houver, todos os gerentes) */
  function gestoresDoDepartamento(db, dep, total) {
    var lim = limites(db);
    var ger = db.Usuarios.filter(function (x) { return Number(x.nivel) === 3 && x.ativo !== false && emailAutorizado(x.email); });
    var podem = total == null ? ger : ger.filter(function (x) { return Number(total) <= limiteGerente(lim, x.departamento); });
    var escolher = function (l) { var dd = l.filter(function (x) { return dep && mesmoDep(x.departamento, dep); }); return dd.length ? dd : l; };
    return escolher(podem.length ? podem : ger).map(function (x) { return x.email; });
  }
  /** Número sequencial do Pedido de Compra (001/2026...) — só na aprovação */
  function numerarPedido(db, r, em) {
    if (r.numeroPdf) return;
    var ano = String(em || agora()).slice(0, 4);
    r.numeroPdf = pad(proximo(db, 'seq_pdf_' + ano), 3) + '/' + ano;
  }

  function comprar(db, r, u, fornecedor, obs, ctx, em) {
    if (r.status !== 'aprovado') erro('Apenas pedidos aprovados podem ser marcados como comprados.');
    em = em || agora();
    var forn = txt(fornecedor) || r.fornecedor;
    r.status = 'comprado'; r.compradoEm = em; r.fornecedorFinal = forn;
    sujar(db, 'Solicitacoes', 'Itens', 'Historico_Precos');
    if (forn && !fornPorNome(db, forn)) {
      db.Fornecedores.push({ id: ctx.uuid(), nome: forn, cnpj: '', contato: '', telefone: '', email: '', cidade: '', categorias: r.categoria, ativo: true, criadoEm: em, statusCred: 'pendente', cadastradoPor: u.nome + ' (compra ' + r.numero + ')', credAnalisadoPor: '', credAnalisadoEm: '', credObs: '' });
      sujar(db, 'Fornecedores');
    }
    db.Itens_Solicitacao.filter(function (i) { return i.solicitacaoId === r.id; }).forEach(function (i) {
      if (i.tipo === 'servico') {   // serviços: só histórico de preço (não entram no cadastro de itens)
        db.Historico_Precos.push({ em: em, itemId: '', codigo: 'SERV', descricao: i.descricao, fornecedor: forn, unidade: 'serv', qtd: 1, valorUnit: i.valorUnit, numero: r.numero, solicitacaoId: r.id });
        return;
      }
      var c = (i.itemId && porId(db.Itens, i.itemId)) || itemPorDescricao(db, i.descricao);
      if (!c) {
        c = { id: ctx.uuid(), codigo: 'IT-' + pad(proximo(db, 'seq_item'), 4), descricao: i.descricao, unidade: i.unidade, categoria: r.categoria, fornecedorPreferido: forn, ultimoPreco: '', ultimaCompra: '', ativo: true, criadoEm: em };
        db.Itens.push(c);
      }
      if (!i.itemId) { i.itemId = c.id; sujar(db, 'Itens_Solicitacao'); }
      c.ultimoPreco = i.valorUnit; c.ultimaCompra = em;
      if (!c.fornecedorPreferido) c.fornecedorPreferido = forn;
      db.Historico_Precos.push({ em: em, itemId: c.id, codigo: c.codigo, descricao: c.descricao, fornecedor: forn, unidade: i.unidade, qtd: i.qtd, valorUnit: i.valorUnit, numero: r.numero, solicitacaoId: r.id });
    });
    hist(db, r, u.nome, 'Compra efetivada' + (forn ? ' — ' + forn : ''), obs, em);
  }

  function exigir(u, nivel) { if (nivelDe(u) < nivel) erro('Seu perfil não permite esta ação.'); }
  var U_ATUAL = null;   // usuário da ação em andamento (verifica acesso à solicitação)
  function getReq(db, id) { var r = porId(db.Solicitacoes, id); if (!r || (U_ATUAL && !podeVer(U_ATUAL, r))) erro('Solicitação não encontrada.'); return r; }

  // ---------- ações públicas (chamadas pela interface) ----------
  function handle(db, action, p, u, ctx) {
    if (fin(u) && !ACOES_CONSULTA[action]) erro('O perfil Financeiro é somente para consulta.');
    p = p || {};
    var extra = {};
    U_ATUAL = u;
    try { return acao(db, action, p, u, ctx, extra); } finally { U_ATUAL = null; }
  }
  function acao(db, action, p, u, ctx, extra) {
    switch (action) {
      case 'state': break;

      case 'createRequest': {
        // Orçamentos obrigatórios (mínimo definido em Configurações; padrão 3)
        var min = minOrcamentos(db);
        var orcs = (p.orcamentos || []).filter(function (o) { return txt(o.nome) || txt(o.arquivoUrl); });
        orcs.forEach(function (o, i) { if (!txt(o.fornecedor)) erro('Informe o fornecedor do orçamento ' + (i + 1) + '.'); });
        var dados = p.data || {};
        dados.orcIncompleto = orcs.length < min; dados.qtdOrcamentos = orcs.length;   // permitido, mas vai para o Gerente
        var r = criar(db, u, dados, ctx);
        extra.criado = { id: r.id, numero: r.numero, status: r.status, nivelNecessario: r.nivelNecessario };
        if (r.status === 'pendente') extra.notificar = gestoresDoDepartamento(db, r.departamento, r.total);
        extra.orcamentosCriados = orcs.map(function (o) {
          var row = { id: ctx.uuid(), solicitacaoId: r.id, numero: r.numero, fornecedor: txt(o.fornecedor), valor: r2(o.valor), arquivoNome: txt(o.nome), arquivoUrl: txt(o.arquivoUrl), enviadoPor: u.nome, em: r.criadoEm };
          db.Orcamentos.push(row);
          return row.id;
        });
        if (orcs.length) { sujar(db, 'Orcamentos'); hist(db, r, u.nome, orcs.length + ' orçamentos anexados', '', r.criadoEm); }
        break;
      }
      case 'decide': decidir(db, getReq(db, p.id), u, !!p.aprovar, p.obs); break;
      case 'cancel': {
        var rc = getReq(db, p.id);
        if (rc.status !== 'pendente' || (rc.solicitanteId !== u.id && Number(u.nivel) < 3)) erro('Não é possível cancelar esta solicitação.');
        rc.status = 'cancelado'; sujar(db, 'Solicitacoes'); hist(db, rc, u.nome, 'Cancelado', p.obs);
        break;
      }
      case 'markPurchased': comprar(db, getReq(db, p.id), u, p.fornecedor, p.obs, ctx); break;

      case 'addOrcamento': {
        var ro = getReq(db, p.solicitacaoId);
        if (ro.solicitanteId !== u.id && Number(u.nivel) < 2) erro('Somente o solicitante ou um aprovador pode anexar orçamentos.');
        if (!txt(p.arquivoUrl)) erro('Arquivo não recebido.');
        db.Orcamentos.push({ id: ctx.uuid(), solicitacaoId: ro.id, numero: ro.numero, fornecedor: txt(p.fornecedor), valor: r2(p.valor), arquivoNome: txt(p.arquivoNome), arquivoUrl: txt(p.arquivoUrl), enviadoPor: u.nome, em: agora() });
        sujar(db, 'Orcamentos');
        hist(db, ro, u.nome, 'Orçamento anexado' + (txt(p.fornecedor) ? ' — ' + txt(p.fornecedor) : ''), '');
        break;
      }
      case 'removeOrcamento': {
        var o = porId(db.Orcamentos, p.id); if (!o) erro('Orçamento não encontrado.'); getReq(db, o.solicitacaoId);
        if (o.enviadoPor !== u.nome && Number(u.nivel) < 2) erro('Sem permissão para remover.');
        db.Orcamentos.splice(db.Orcamentos.indexOf(o), 1); sujar(db, 'Orcamentos');
        var rr = porId(db.Solicitacoes, o.solicitacaoId); if (rr) hist(db, rr, u.nome, 'Orçamento removido — ' + o.arquivoNome, '');
        break;
      }

      case 'saveItem': {
        var d = p.item || {};
        if (!txt(d.descricao)) erro('Informe a descrição do item.');
        var dup = itemPorDescricao(db, d.descricao);
        if (dup && dup.id !== d.id) erro('Já existe um item com esta descrição (' + dup.codigo + ').');
        if (d.id) {
          var it = porId(db.Itens, d.id); if (!it) erro('Item não encontrado.');
          it.descricao = txt(d.descricao); it.unidade = txt(d.unidade) || 'un'; it.categoria = txt(d.categoria); it.fornecedorPreferido = txt(d.fornecedorPreferido);
          extra.salvo = it;
        } else {
          var novo = { id: ctx.uuid(), codigo: 'IT-' + pad(proximo(db, 'seq_item'), 4), descricao: txt(d.descricao), unidade: txt(d.unidade) || 'un', categoria: txt(d.categoria), fornecedorPreferido: txt(d.fornecedorPreferido), ultimoPreco: '', ultimaCompra: '', ativo: true, criadoEm: agora() };
          db.Itens.push(novo); extra.salvo = novo;
        }
        sujar(db, 'Itens');
        break;
      }
      case 'toggleItem': { exigir(u, 2); var ti = porId(db.Itens, p.id); if (ti) { ti.ativo = !(ti.ativo !== false); sujar(db, 'Itens'); } break; }

      case 'saveFornecedor': {
        var f = p.fornecedor || {};
        if (!txt(f.nome)) erro('Informe a razão social do fornecedor.');
        var fd = fornPorNome(db, f.nome);
        if (fd && fd.id !== f.id) erro('Já existe um fornecedor com este nome.');
        var doc = digitos(f.cnpj);
        if (doc) {
          if (doc.length === 14 ? !cnpjValido(doc) : doc.length === 11 ? !cpfValido(doc) : true) erro('CNPJ/CPF inválido. Confira os números.');
          var fdoc = db.Fornecedores.filter(function (x) { return digitos(x.cnpj) === doc && x.id !== f.id; })[0];
          if (fdoc) erro('Este CNPJ/CPF já está cadastrado para "' + fdoc.nome + '".');
        }
        var campos = { nome: txt(f.nome), cnpj: formatarDoc(doc), contato: txt(f.contato), telefone: txt(f.telefone), email: txt(f.email), cidade: txt(f.cidade), categorias: txt(f.categorias),
          nomeFantasia: txt(f.nomeFantasia), endereco: txt(f.endereco), uf: txt(f.uf).toUpperCase(), cep: txt(f.cep), situacao: txt(f.situacao), atividade: txt(f.atividade), inscricaoEstadual: txt(f.inscricaoEstadual) };
        var fx;
        if (f.id) {
          fx = porId(db.Fornecedores, f.id); if (!fx) erro('Fornecedor não encontrado.');
          // Comprador/Supervisor alterando dados cadastrais (exceto contato, telefone, e-mail e categorias): volta para o credenciamento
          var LIVRES = { contato: 1, telefone: 1, email: 1, categorias: 1 };
          var ROT = { nome: 'Razão social', cnpj: 'CNPJ/CPF', cidade: 'Cidade', nomeFantasia: 'Nome fantasia', endereco: 'Endereço', uf: 'UF', cep: 'CEP', situacao: 'Situação na Receita', atividade: 'Atividade', inscricaoEstadual: 'Inscrição estadual' };
          var mud = [];
          for (var k0 in campos) if (!LIVRES[k0] && txt(fx[k0]) !== txt(campos[k0])) mud.push((ROT[k0] || k0) + ': "' + (txt(fx[k0]) || '—') + '" → "' + (txt(campos[k0]) || '—') + '"');
          for (var k in campos) fx[k] = campos[k];
          if (mud.length && nivelDe(u) < 3) {
            var dt = agora().slice(0, 10).split('-').reverse().join('/');
            fx.credAlteracoes = (fx.statusCred === 'pendente' && txt(fx.credAlteracoes) ? txt(fx.credAlteracoes) + '\n' : '') + 'Alterado por ' + u.nome + ' em ' + dt + ': ' + mud.join('; ');
            fx.statusCred = 'pendente';
            extra.msg = 'Alterações salvas. O fornecedor voltou para o credenciamento de um gerente.';
          }
        }
        else {
          fx = campos; campos.id = ctx.uuid(); campos.ativo = true; campos.criadoEm = agora(); campos.cadastradoPor = u.nome;
          var auto = Number(u.nivel) >= 3;   // gerente já credencia; demais aguardam aprovação
          campos.statusCred = auto ? 'aprovado' : 'pendente'; campos.credAnalisadoPor = auto ? u.nome : ''; campos.credAnalisadoEm = auto ? agora() : ''; campos.credObs = '';
          db.Fornecedores.push(campos);
          extra.msg = auto ? 'Fornecedor cadastrado e credenciado.' : 'Fornecedor cadastrado. Aguardando credenciamento por um gerente.';
        }
        extra.salvo = fx;
        sujar(db, 'Fornecedores');
        break;
      }
      case 'descredenciarFornecedor': {   // gestor exclui o cadastro do fornecedor
        exigir(u, 3);
        var fd2 = porId(db.Fornecedores, p.id); if (!fd2) erro('Fornecedor não encontrado.');
        db.Fornecedores.splice(db.Fornecedores.indexOf(fd2), 1);
        sujar(db, 'Fornecedores'); extra.msg = fd2.nome + ' descredenciado e removido do cadastro.';
        break;
      }
      case 'aprovarFornecedor': case 'recusarFornecedor': {
        exigir(u, 3);
        var fc = porId(db.Fornecedores, p.id); if (!fc) erro('Fornecedor não encontrado.');
        var ok = action === 'aprovarFornecedor';
        fc.statusCred = ok ? 'aprovado' : 'recusado'; fc.credAnalisadoPor = u.nome; fc.credAnalisadoEm = agora(); fc.credObs = ok ? '' : txt(p.motivo);
        if (ok) fc.credAlteracoes = '';
        sujar(db, 'Fornecedores'); extra.msg = ok ? fc.nome + ' credenciado.' : 'Credenciamento recusado.';
        break;
      }
      case 'registrarPdf': {
        var rp = getReq(db, p.id);
        if (rp.solicitanteId !== u.id && Number(u.nivel) < 2) erro('Sem permissão.');
        rp.pdfUrl = txt(p.pdfUrl); rp.pdfId = txt(p.pdfId); sujar(db, 'Solicitacoes');
        break;
      }
      case 'atualizarPlacas': exigir(u, 3); break;   // o servidor Google sincroniza antes (Codigo.gs)
      case 'assinaturas': {   // imagens das assinaturas (para montar o PDF)
        var mapa = {};
        (p.ids || []).forEach(function (id) { var x = porId(db.Usuarios, id); if (x && x.assinatura) mapa[id] = x.assinatura; });
        extra.assinaturas = mapa;
        break;
      }
      case 'gerarLinkAssinatura': {
        var ua2 = porId(db.Usuarios, p.id || u.id); if (!ua2) erro('Usuário não encontrado.');
        if (ua2.id !== u.id) exigir(u, 3);
        ua2.tokenAssinatura = ctx.uuid().replace(/-/g, '') + ctx.uuid().replace(/-/g, '').slice(0, 8);
        sujar(db, 'Usuarios'); extra.token = ua2.tokenAssinatura; extra.nome = ua2.nome;
        break;
      }
      case 'salvarMinhaAssinatura': u.assinatura = validarAssinatura(p.png); u.tokenAssinatura = ''; sujar(db, 'Usuarios'); extra.msg = 'Assinatura salva.'; break;
      case 'toggleFornecedor': { exigir(u, 2); var tf = porId(db.Fornecedores, p.id); if (tf) { tf.ativo = !(tf.ativo !== false); sujar(db, 'Fornecedores'); } break; }

      case 'saveUser': {
        exigir(u, 3);
        var x = p.user || {}, email = norm(x.email);
        if (!txt(x.nome) || !email) erro('Nome e e-mail são obrigatórios.');
        if (db.Usuarios.some(function (y) { return norm(y.email) === email && y.id !== x.id; })) erro('Já existe um usuário com este e-mail.');
        var nv = Number(x.nivel); if (!(nv >= 1 && nv <= 3) && nv !== FINANCEIRO) erro('Perfil inválido.');
        if (x.id) {
          var ux = porId(db.Usuarios, x.id); if (!ux) erro('Usuário não encontrado.');
          ux.nome = txt(x.nome); ux.email = email; ux.nivel = nv; ux.filial = txt(x.filial); ux.departamento = txt(x.departamento);
          if (txt(x.senha)) ux.senhaHash = ctx.hash(txt(x.senha));
        } else {
          if (!emailAutorizado(email)) erro('E-mail não autorizado. Use um e-mail @' + DOMINIO_AUTORIZADO + '.');
          if (txt(x.senha).length < 6) erro('Defina uma senha inicial (mín. 6 caracteres).');
          db.Usuarios.push({ id: ctx.uuid(), nome: txt(x.nome), email: email, senhaHash: ctx.hash(txt(x.senha)), nivel: nv, filial: txt(x.filial), ativo: true, criadoEm: agora(), cpf: '', status: 'ativo', aprovadoPor: u.nome, aprovadoEm: agora(), obsAcesso: '', departamento: txt(x.departamento) });
        }
        sujar(db, 'Usuarios');
        break;
      }
      case 'toggleUser': { exigir(u, 3); var tu = porId(db.Usuarios, p.id); if (tu && tu.id !== u.id && tu.status !== 'pendente') { tu.ativo = !(tu.ativo !== false); tu.status = tu.ativo ? 'ativo' : 'inativo'; sujar(db, 'Usuarios'); } break; }
      case 'aprovarAcesso': {
        exigir(u, 3);
        var ua = porId(db.Usuarios, p.id); if (!ua || ua.status !== 'pendente') erro('Cadastro não encontrado ou já analisado.');
        var nva = Number(p.nivel); if (!(nva >= 1 && nva <= 3) && nva !== FINANCEIRO) erro('Escolha o perfil: Comprador, Supervisor, Gerente ou Financeiro.');
        ua.nivel = nva; ua.filial = txt(p.filial) || ua.filial; ua.departamento = txt(p.departamento) || ua.departamento || ''; ua.ativo = true; ua.status = 'ativo';
        ua.aprovadoPor = u.nome; ua.aprovadoEm = agora(); ua.obsAcesso = '';
        sujar(db, 'Usuarios'); extra.msg = ua.nome + ' aprovado como ' + NOMES[nva] + '.';
        break;
      }
      case 'recusarAcesso': {
        exigir(u, 3);
        var ur = porId(db.Usuarios, p.id); if (!ur || ur.status !== 'pendente') erro('Cadastro não encontrado ou já analisado.');
        ur.ativo = false; ur.status = 'recusado'; ur.aprovadoPor = u.nome; ur.aprovadoEm = agora(); ur.obsAcesso = txt(p.motivo);
        sujar(db, 'Usuarios');
        break;
      }
      case 'saveLimites': {
        if (!ehSuperAdmin(u)) erro('Somente o administrador do sistema pode alterar alçadas e regras.');
        var a = Number(p.limites[1]), b = Number(p.limites[2]), c = Number(p.limites[3]);
        if (!(a > 0 && b > a && c > b)) erro('Os limites devem ser crescentes: Comprador < Supervisor < Gerente.');
        setCfg(db, 'limite_1', a); setCfg(db, 'limite_2', b); setCfg(db, 'limite_3', c);
        var ld = p.limitesDep || {};
        Object.keys(ld).forEach(function (dep) {
          var v = ld[dep];
          if (v === '' || v == null) { setCfg(db, 'limite_ger_' + txt(dep), ''); return; }
          v = Number(v);
          if (!(v > b)) erro('O teto do Gerente de ' + dep + ' precisa ser maior que o limite do Supervisor.');
          setCfg(db, 'limite_ger_' + txt(dep), v);
        });
        if (p.minOrcamentos !== undefined && p.minOrcamentos !== '') {
          var mo = Math.floor(Number(p.minOrcamentos));
          if (!(mo >= 0 && mo <= 10)) erro('O mínimo de orçamentos deve ficar entre 0 e 10.');
          setCfg(db, 'min_orcamentos', mo);
        }
        break;
      }
      case 'changePassword': {
        if (u.senhaHash !== ctx.hash(txt(p.atual))) erro('Senha atual incorreta.');
        if (txt(p.nova).length < 6) erro('A nova senha precisa ter ao menos 6 caracteres.');
        u.senhaHash = ctx.hash(txt(p.nova)); sujar(db, 'Usuarios');
        extra.msg = 'Senha alterada.';
        break;
      }
      case 'addLista': if (!podeEditarListas(u)) erro('Seu perfil não pode alterar as listas.'); addLista(db, p.tipo, p.valor); extra.salvo = txt(p.valor); break;
      case 'removeLista': if (!podeEditarListas(u)) erro('Seu perfil não pode alterar as listas.'); removeLista(db, p.tipo, p.valor); break;
      default: erro('Ação desconhecida: ' + action);
    }
    return estado(db, u, extra);
  }

  function login(db, email, senha, ctx) {
    var e = norm(email), h = ctx.hash(txt(senha));
    for (var i = 0; i < db.Usuarios.length; i++) {
      var u = db.Usuarios[i];
      if (norm(u.email) !== e || u.senhaHash !== h) continue;
      if (u.status === 'pendente') erro('Seu cadastro está aguardando aprovação de um gerente.');
      if (u.status === 'recusado') erro('Seu cadastro não foi aprovado. Procure seu gestor.');
      if (u.ativo === false) erro('Usuário inativo. Procure seu gestor.');
      return u;
    }
    return null;
  }

  // ---------- assinatura por link (sem login) ----------
  function validarAssinatura(png) {
    png = txt(png);
    if (!/^data:image\/png;base64,/.test(png)) erro('Assinatura inválida.');
    if (png.length > 45000) erro('A assinatura ficou muito grande. Clique em "Limpar" e assine novamente.');
    return png;
  }
  function usuarioPorToken(db, token) {
    token = txt(token);
    var x = token ? db.Usuarios.filter(function (y) { return y.tokenAssinatura === token; })[0] : null;
    if (!x) erro('Link de assinatura inválido ou já utilizado. Peça um novo link ao gerente.');
    return x;
  }
  function assinaturaInfo(db, token) { var x = usuarioPorToken(db, token); return { nome: x.nome, email: x.email, temAssinatura: !!x.assinatura }; }
  function salvarAssinaturaToken(db, token, png) {
    var x = usuarioPorToken(db, token);
    x.assinatura = validarAssinatura(png); x.tokenAssinatura = ''; sujar(db, 'Usuarios');
    return { nome: x.nome };
  }

  // ---------- primeiro acesso (sem login) ----------
  function verificarEmail(db, email) {
    var e = norm(email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) erro('Digite um e-mail válido.');
    var ex = db.Usuarios.filter(function (x) { return norm(x.email) === e; })[0];
    return { email: e, autorizado: emailAutorizado(e), existe: !!ex, status: ex ? statusUsuario(ex) : '', nomeSugerido: EMAILS_EXTERNOS_AUTORIZADOS[e] || '' };
  }
  function solicitarAcesso(db, p, ctx) {
    var v = verificarEmail(db, p.email);
    if (!v.autorizado) erro('E-mail não autorizado. Use seu e-mail @' + DOMINIO_AUTORIZADO + '.');
    if (v.existe) erro(v.status === 'pendente' ? 'Já existe uma solicitação para este e-mail aguardando aprovação.' : 'Este e-mail já possui cadastro. Use "Entrar".');
    var nome = txt(p.nome).replace(/\s+/g, ' ');
    if (nome.split(' ').length < 2) erro('Informe o nome completo (nome e sobrenome).');
    var cpf = digitos(p.cpf);
    if (!cpfValido(cpf)) erro('CPF inválido. Confira os números.');
    if (db.Usuarios.some(function (x) { return digitos(x.cpf) === cpf; })) erro('Este CPF já está cadastrado.');
    if (txt(p.senha).length < 6) erro('A senha precisa ter ao menos 6 caracteres.');
    if (txt(p.senha) !== txt(p.confirmacao)) erro('A senha e a confirmação não são iguais.');
    var novo = { id: ctx.uuid(), nome: nome, email: v.email, senhaHash: ctx.hash(txt(p.senha)), nivel: 0, filial: '', ativo: false, criadoEm: agora(),
      cpf: formatarDoc(cpf), status: 'pendente', aprovadoPor: '', aprovadoEm: '', obsAcesso: '', departamento: txt(p.departamento) };
    db.Usuarios.push(novo); sujar(db, 'Usuarios');
    return { ok: true, nome: nome, email: v.email, gerentes: db.Usuarios.filter(function (x) { return Number(x.nivel) >= 3 && x.ativo !== false && emailAutorizado(x.email); }).map(function (x) { return x.email; }) };
  }

  // ---------- integração com o painel de manutenção da frota ----------
  var STATUS_MANUTENCAO = { novo: 'Nova', em_andamento: 'Em andamento', concluido: 'Concluída' };   // cancelado não entra
  function resumoManutencao(m) { return [m.data, STATUS_MANUTENCAO[m.status] || m.status, m.tipo, m.descricao].filter(Boolean).join(' · '); }
  /** Demonstração (modo local): solicitações de manutenção de exemplo por placa */
  function manutencoesDemo(placa) {
    var p = txt(placa).toUpperCase(); if (!p) return [];
    var h = 0; for (var i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) % 997;
    return [
      { id: 'demo-' + h + '-a', data: '22/09/2026', status: 'em_andamento', tipo: 'Mecânica', descricao: 'Barulho na suspensão dianteira', classificacao: 'corretiva' },
      { id: 'demo-' + h + '-b', data: '15/09/2026', status: 'novo', tipo: 'Elétrica', descricao: 'Farol baixo queimado', classificacao: '' },
      { id: 'demo-' + h + '-c', data: '02/09/2026', status: 'concluido', tipo: 'Pneus', descricao: 'Troca de 2 pneus traseiros', classificacao: 'pneus' }
    ];
  }

  // ---------- dados iniciais ----------
  var CATALOGO = [
    ['Luva nitrílica (caixa c/ 100)', 'cx', 'EPI', 'Proteção Total EPIs', 42, 60, 10, 60],
    ['Máscara PFF2', 'un', 'EPI', 'Proteção Total EPIs', 3, 5, 200, 800],
    ['Uniforme operacional completo', 'un', 'EPI', 'Proteção Total EPIs', 90, 140, 10, 40],
    ['Coletor perfurocortante 13L', 'un', 'Embalagens e coletores', 'Plastibras Embalagens', 8, 12, 100, 500],
    ['Bombona plástica 200L', 'un', 'Embalagens e coletores', 'Plastibras Embalagens', 180, 250, 4, 30],
    ['Contêiner 1000L', 'un', 'Embalagens e coletores', 'Plastibras Embalagens', 1500, 2100, 1, 6],
    ['Saco infectante branco 100L (pct c/ 100)', 'pct', 'Embalagens e coletores', 'Plastibras Embalagens', 85, 120, 5, 40],
    ['Pneu caminhão 295/80 R22.5', 'un', 'Peças e manutenção', 'Mega Pneus', 2200, 2800, 2, 6],
    ['Revisão e troca de óleo — frota', 'serv', 'Serviços', 'Auto Peças Paulista', 900, 1500, 1, 3],
    ['Diesel S10', 'L', 'Combustível', 'Posto Rodovia 225', 5.8, 6.4, 300, 1500],
    ['Manutenção preventiva autoclave', 'serv', 'Serviços', 'Hidromec Industrial', 7000, 14000, 1, 1],
    ['Calibração de balança rodoviária', 'serv', 'Serviços', 'Tecnocal Serviços', 1200, 3200, 1, 1],
    ['Notebook corporativo', 'un', 'TI', 'Dell Brasil', 4200, 5600, 1, 4],
    ['Papel A4 (caixa c/ 10 resmas)', 'cx', 'Escritório', 'Kalunga', 220, 290, 1, 6],
    ['Fragmentadora industrial de documentos', 'un', 'Equipamentos', 'Hidromec Industrial', 26000, 38000, 1, 1]
  ];
  var FORNECEDORES = [
    ['Proteção Total EPIs', 'Bauru', 'EPI'], ['Plastibras Embalagens', 'Marília', 'Embalagens e coletores'],
    ['Auto Peças Paulista', 'Ourinhos', 'Peças e manutenção; Serviços'], ['Mega Pneus', 'Ourinhos', 'Peças e manutenção'],
    ['Posto Rodovia 225', 'Bernardino de Campos', 'Combustível'], ['Hidromec Industrial', 'Botucatu', 'Serviços; Equipamentos'],
    ['Tecnocal Serviços', 'Assis', 'Serviços'], ['Dell Brasil', 'Eldorado do Sul', 'TI'], ['Kalunga', 'São Paulo', 'Escritório']
  ];
  var PLACAS_DEMO = [['FXT-2A31', 'Caminhão VW Constellation 24.280'], ['GBQ-7H12', 'Caminhão baú Mercedes Accelo 1016'], ['EJR-4C55', 'Fiorino Furgão'], ['DMK-9F02', 'Caminhão Iveco Tector'], ['BRA-2E19', 'Strada Working']];
  var CC_POR_CAT = { 'EPI': 'Segurança do Trabalho', 'Embalagens e coletores': 'Operações - Coleta', 'Peças e manutenção': 'Manutenção de Veículos', 'Combustível': 'Manutenção de Veículos', 'Serviços': 'Tratamento de Resíduos', 'TI': 'TI', 'Escritório': 'Administrativo', 'Equipamentos': 'Tratamento de Resíduos' };

  function seed(ctx, opcoes) {
    opcoes = opcoes || {};
    var db = novoDb(), em = agora();
    var filiais = opcoes.filiais || ['Bernardino de Campos (Matriz)', 'Assis', 'São Manuel', 'Botucatu'];
    setCfg(db, 'limite_1', PADRAO.limites[1]); setCfg(db, 'limite_2', PADRAO.limites[2]); setCfg(db, 'limite_3', PADRAO.limites[3]);
    setCfg(db, 'seq_pedido', 0); setCfg(db, 'seq_item', 0); setCfg(db, 'migr_v29', '1'); setCfg(db, 'migr_v292', '1');
    if (opcoes.demo) PLACAS_DEMO.forEach(function (x) { db.Placas.push({ placa: x[0], descricao: x[1], ativo: true, atualizadoEm: em, removidaEm: '' }); });
    var senha = ctx.hash('1234');
    db.Usuarios = [
      { id: ctx.uuid(), nome: 'Ana Souza', email: 'comprador@cheiroverde.com.br', senhaHash: senha, nivel: 1, filial: filiais[0], departamento: 'Logística', ativo: true, criadoEm: em },
      { id: ctx.uuid(), nome: 'Bruno Lima', email: 'comprador2@cheiroverde.com.br', senhaHash: senha, nivel: 1, filial: filiais[1], departamento: 'Operacional', ativo: true, criadoEm: em },
      { id: ctx.uuid(), nome: 'Carla Mendes', email: 'supervisor@cheiroverde.com.br', senhaHash: senha, nivel: 2, filial: filiais[0], departamento: 'Administrativo', ativo: true, criadoEm: em },
      { id: ctx.uuid(), nome: 'Diego Rocha', email: 'gerente@cheiroverde.com.br', senhaHash: senha, nivel: 3, filial: filiais[0], departamento: 'Logística', ativo: true, criadoEm: em },
      { id: ctx.uuid(), nome: 'Elisa Martins', email: 'gerente2@cheiroverde.com.br', senhaHash: senha, nivel: 3, filial: filiais[0], departamento: 'Operacional', ativo: true, criadoEm: em },
      { id: ctx.uuid(), nome: 'Fábio Nunes', email: 'financeiro@cheiroverde.com.br', senhaHash: senha, nivel: 5, filial: filiais[0], departamento: 'Administrativo', ativo: true, criadoEm: em }
    ];
    db.Listas = linhasListasPadrao();
    FORNECEDORES.forEach(function (f) { db.Fornecedores.push({ id: ctx.uuid(), nome: f[0], cnpj: '', contato: '', telefone: '', email: '', cidade: f[1], categorias: f[2], ativo: true, criadoEm: em, statusCred: 'aprovado', cadastradoPor: 'Sistema', credAnalisadoPor: 'Sistema', credAnalisadoEm: em, credObs: '' }); });
    CATALOGO.forEach(function (c) { db.Itens.push({ id: ctx.uuid(), codigo: 'IT-' + pad(proximo(db, 'seq_item'), 4), descricao: c[0], unidade: c[1], categoria: c[2], fornecedorPreferido: c[3], ultimoPreco: '', ultimaCompra: '', ativo: true, criadoEm: em }); });
    if (opcoes.demo) {
      demo(db, ctx);
      db.Usuarios.push({ id: ctx.uuid(), nome: 'João Pereira da Silva', email: 'joao.pereira@cheiroverdeambiental.com.br', senhaHash: ctx.hash('123456'), nivel: 0, filial: '', ativo: false, criadoEm: em, cpf: '111.444.777-35', status: 'pendente', aprovadoPor: '', aprovadoEm: '', obsAcesso: '' });
    }
    db._dirty = null;
    return db;
  }

  function demo(db, ctx) {
    var a = 20260923;
    function rnd() { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    function entre(x, y) { return x + rnd() * (y - x); }
    var U = db.Usuarios, DAY = 86400000, now = Date.now();
    var planos = [];
    for (var i = 0; i < 30; i++) planos.push(now - Math.floor(entre(0, 175)) * DAY - Math.floor(entre(0, 10)) * 3600000);
    planos.sort();
    planos.forEach(function (ms) {
      var criador = [U[0], U[0], U[1], U[1], U[2]][Math.floor(rnd() * 5)];
      var c = CATALOGO[Math.floor(rnd() * CATALOGO.length)];
      var item = itemPorDescricao(db, c[0]);
      var serv = c[1] === 'serv';
      var itens = [serv ? { tipo: 'servico', descricao: c[0], valorUnit: r2(entre(c[4], c[5])), prazo: '5 dias úteis' } : { itemId: item.id, descricao: c[0], unidade: c[1], qtd: Math.round(entre(c[6], c[7])), valorUnit: r2(entre(c[4], c[5])) }];
      var em = new Date(ms).toISOString();
      var mod = CC_POR_CAT[c[2]] || 'Operações - Coleta', veic = ehVeiculo(mod) || /frota/i.test(c[0]);
      if (veic) mod = MODALIDADE_VEICULOS;
      var r = criar(db, criador, {
        modalidade: mod, centroCusto: veic ? PLACAS_DEMO[Math.floor(rnd() * PLACAS_DEMO.length)][0] : criador.filial, categoria: serv ? CAT_SERVICOS : (veic ? CAT_PRODUTOS : ({ 'EPI': 'EPI e Uniformes', 'Embalagens e coletores': 'Embalagens e Coletores', 'TI': 'Informática e Tecnologia', 'Escritório': 'Materiais de Escritório', 'Equipamentos': 'Equipamentos e Ferramentas' }[c[2]] || 'Outras Compras')),
        tipoManutencao: veic ? (c[2] === 'Combustível' ? 'Outros' : /pneu/i.test(c[0]) ? 'Pneus' : 'Manutenção Preventiva') : '', tipoManutencaoOutro: 'Abastecimento', fornecedor: c[3], condicaoPagamento: ['PIX', 'Boleto 28 dias', 'Boleto 30/60/90 dias'][Math.floor(rnd() * 3)], cidade: String(criador.filial).replace(/ \(.*\)/, '') + '/SP',
        urgencia: '', dataNecessidade: '', prazoEntrega: ['5 dias úteis', '10 dias', 'Imediato', '15 dias'][Math.floor(rnd() * 4)], valorFrete: rnd() < 0.4 ? r2(entre(30, 180)) : 0,
        justificativa: 'Reposição para continuidade da operação.', itens: itens
      }, ctx, em);
      var idade = (now - ms) / DAY;
      if (r.status === 'pendente' && r.nivelNecessario <= 3 && idade > 4) {
        var apr = U.filter(function (x) { return podeAprovar(x, r, limites(db)); })[0];
        if (!apr) return;
        var ok = rnd() > 0.18;
        decidir(db, r, apr, ok, ok ? '' : 'Solicitar mais 2 orçamentos.', new Date(ms + entre(2, 70) * 3600000).toISOString());
      }
      if (r.status === 'aprovado' && idade > 12 && rnd() < 0.75) {
        comprar(db, r, criador, c[3], '', ctx, new Date(new Date(r.decididoEm).getTime() + entre(1, 5) * DAY).toISOString());
      }
    });
  }

  return {
    TABELAS: TABELAS, NUMEROS: NUMEROS, DATAS: DATAS, BOOLEANOS: BOOLEANOS, TEXTOS: TEXTOS, NOMES: NOMES, TIPOS_LISTA: TIPOS_LISTA, FINANCEIRO: FINANCEIRO,
    linhasListasPadrao: linhasListasPadrao, listas: listas, cnpjValido: cnpjValido, cpfValido: cpfValido, digitos: digitos, formatarDoc: formatarDoc, normalizarCnpj: normalizarCnpj,
    novoDb: novoDb, seed: seed, situacaoFornecedor: situacaoFornecedor, registrarHist: hist, manutencoesDemo: manutencoesDemo, STATUS_MANUTENCAO: STATUS_MANUTENCAO, resumoManutencao: resumoManutencao, login: login, verificarEmail: verificarEmail, assinaturaInfo: assinaturaInfo, salvarAssinaturaToken: salvarAssinaturaToken, solicitarAcesso: solicitarAcesso, emailAutorizado: emailAutorizado, ehSuperAdmin: ehSuperAdmin, DOMINIO_AUTORIZADO: DOMINIO_AUTORIZADO, handle: handle, estado: estado,
    limites: limites, nivelNecessario: nivelNecessario, podeAprovar: podeAprovar, podeVer: podeVer, limiteDoUsuario: limiteDoUsuario, limiteGerente: limiteGerente, maiorTetoGerente: maiorTetoGerente,
    migrar: migrar, sincronizarPlacas: sincronizarPlacas, ehVeiculo: ehVeiculo, TIPOS_COMPRA: TIPOS_COMPRA, TIPOS_MANUTENCAO: TIPOS_MANUTENCAO, MODALIDADE_VEICULOS: MODALIDADE_VEICULOS,
    categoriasDe: categoriasDe, podeEditarListas: podeEditarListas, CAT_PRODUTOS: CAT_PRODUTOS, CAT_SERVICOS: CAT_SERVICOS, CAT_AMBOS: CAT_AMBOS, CAT_CONSUMIVEIS: CAT_CONSUMIVEIS, rotuloProdutos: rotuloProdutos, temProdutos: temProdutos, temServicos: temServicos, norm: norm, r2: r2
  };
})();
if (typeof window !== 'undefined') window.CVEngine = CVEngine;
