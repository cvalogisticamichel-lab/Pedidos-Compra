/* ==========================================================
   CAMADA DE DADOS
   - Modo "google": se CV_CONFIG.apiUrl estiver preenchida, todos os dados
     ficam na Planilha Google e os orçamentos no Google Drive.
   - Modo "local": sem apiUrl, roda como demonstração no navegador.
   As regras de negócio ficam em js/engine.js (as mesmas do servidor).
   ========================================================== */
(function () {
  const C = window.CV_CONFIG;
  const E = window.CVEngine;
  const MODO = C.apiUrl ? 'google' : 'local';
  const K_DB = 'cv_compras_v2';
  const K_TOKEN = 'cv_compras_token_' + MODO;
  let st = null;      // último estado recebido
  let token = null;

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  // ---------------- backend local (demonstração) ----------------
  const local = {
    db: null,
    ctx: {
      uuid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10),
      hash: s => { let h = 0x811c9dc5; const t = 'cv|' + s; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return 'l' + h.toString(16); }
    },
    load() {
      this.db = null; // relê sempre (outras abas podem ter alterado)
      try { this.db = JSON.parse(ls.get(K_DB)); } catch (e) { this.db = null; }
      if (!this.db || !this.db.Usuarios) { this.db = E.seed(this.ctx, { demo: true, filiais: C.filiais }); this.save(); }
      if (!this.db.Listas) { this.db.Listas = E.linhasListasPadrao(); this.save(); } // dados salvos na versão anterior
      if (E.migrar(this.db)) this.save();
      return this.db;
    },
    save() {
      this.db._dirty = null;
      if (!ls.set(K_DB, JSON.stringify(this.db))) { this.db = null; throw new Error('Espaço do navegador esgotado (modo demonstração). Remova anexos ou configure o Google.'); }
    },
    async call(action, p) {
      const db = this.load();
      if (action === 'login') {
        const u = E.login(db, p.email, p.senha, this.ctx);
        if (!u) throw new Error('E-mail ou senha inválidos.');
        return { token: u.id, state: Object.assign(E.estado(db, u), { extra: { modo: 'local' } }) };
      }
      if (action === 'logout') return { ok: true };
      if (action === 'verificarEmail') return { dados: E.verificarEmail(db, p.email) };
      if (action === 'assinaturaInfo') return { dados: E.assinaturaInfo(db, p.tk) };
      if (action === 'salvarAssinatura') {
        try { const r = E.salvarAssinaturaToken(db, p.tk, p.png); this.save(); return { dados: r }; }
        catch (e) { this.db = null; throw e; }
      }
      if (action === 'solicitarAcesso') {
        try { const r = E.solicitarAcesso(db, p, this.ctx); this.save(); return { dados: { nome: r.nome, email: r.email } }; }
        catch (e) { this.db = null; throw e; }
      }
      const u = db.Usuarios.find(x => x.id === p.token && x.ativo !== false);
      if (!u) { const e = new Error('Sessão expirada. Entre novamente.'); e.sessao = false; throw e; }
      let a = action;
      if (a === 'salvarPdf') a = 'state'; // demonstração: o PDF é baixado, não fica guardado
      if (a === 'createRequest' && p.orcamentos) { // demonstração: guarda só arquivos pequenos
        p = Object.assign({}, p, { orcamentos: p.orcamentos.map(o => ({ fornecedor: o.fornecedor, valor: o.valor, nome: o.nome, arquivoUrl: o.base64 && o.base64.length < 400000 ? 'data:' + (o.mime || 'application/octet-stream') + ';base64,' + o.base64 : '' })) });
      }
      if (a === 'uploadOrcamento') {
        if (p.base64.length > 2.8e6) throw new Error('No modo demonstração o limite é 2 MB por arquivo.');
        p = Object.assign({}, p, { arquivoUrl: 'data:' + (p.mime || 'application/octet-stream') + ';base64,' + p.base64, arquivoNome: p.nome });
        a = 'addOrcamento';
      }
      try {
        const s = E.handle(db, a, p, u, this.ctx);
        s.extra.modo = 'local';
        if (a !== 'state') this.save();
        return { state: s };
      } catch (e) { this.db = null; throw e; }  // descarta alterações parciais
    },
    reset() { this.db = null; ls.del(K_DB); }
  };

  // ---------------- backend Google (Apps Script) ----------------
  async function remoto(action, p) {
    let res;
    try {
      res = await fetch(C.apiUrl, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita pré-verificação CORS
        body: JSON.stringify(Object.assign({ action }, p))
      });
    } catch (e) { throw new Error('Sem conexão com o servidor Google. Verifique a internet e a URL da API.'); }
    let j;
    try { j = await res.json(); } catch (e) { throw new Error('Resposta inválida do servidor. Confira a URL da API e se a implantação está com acesso "Qualquer pessoa".'); }
    if (!j.ok) { const e = new Error(j.erro || 'Erro no servidor.'); if (j.sessao === false) e.sessao = false; throw e; }
    return j;
  }

  // ---------- cópia local do último estado (abre o site na hora) ----------
  const K_SNAP = 'cv_compras_snap_' + MODO;
  let snapTimer = null;
  function guardarSnapshot() {
    if (MODO !== 'google' || !st) return;
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => { try { const t = JSON.stringify(st); if (t.length < 2.5e6) ls.set(K_SNAP, t); } catch (e) { /* sem espaço */ } }, 300);
  }

  async function call(action, p) {
    p = Object.assign({}, p || {}, { token });
    const j = MODO === 'google' ? await remoto(action, p) : await local.call(action, p);
    if (j.state) { st = j.state; guardarSnapshot(); }
    return j;
  }

  /** Fotos grandes de orçamento são reduzidas antes do envio (bem mais rápido) */
  async function otimizarArquivo(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 700 * 1024 || !window.createImageBitmap) return file;
    try {
      const bmp = await createImageBitmap(file);
      const esc = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * esc); c.height = Math.round(bmp.height * esc);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.82));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (e) { return file; }
  }
  const cacheAss = {};

  function lerArquivo(file) {
    return new Promise((ok, falha) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result).split(',')[1] || '');
      fr.onerror = () => falha(new Error('Não foi possível ler o arquivo.'));
      fr.readAsDataURL(file);
    });
  }

  function statsPreco(itemId, descricao) {
    if (!st) return null;
    const n = E.norm(descricao);
    const l = st.precos.filter(p => (itemId && p.itemId === itemId) || (n && E.norm(p.descricao) === n));
    if (!l.length) return null;
    const vals = l.map(p => Number(p.valorUnit) || 0);
    return {
      n: l.length, ultimo: vals[0], ultimoForn: l[0].fornecedor, ultimaData: l[0].em,
      media: vals.reduce((s, v) => s + v, 0) / vals.length, min: Math.min(...vals), max: Math.max(...vals), lista: l
    };
  }

  function csv(rows, cols) {
    const q = v => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + [cols.join(';')].concat(rows.map(r => cols.map(c => typeof r[c] === 'number' ? String(r[c]).replace('.', ',') : q(r[c])).join(';'))).join('\n');
  }

  window.CVStore = {
    modo: MODO,
    async init() {
      token = ls.get(K_TOKEN);
      if (!token) return null;
      // abre na hora com a última cópia; os dados atualizados chegam em seguida
      if (MODO === 'google') {
        try { const snap = JSON.parse(ls.get(K_SNAP) || 'null'); if (snap && snap.user) { st = snap; this.atualizando = call('state'); return st.user; } } catch (e) { /* ignora */ }
      }
      try { await call('state'); return st.user; }
      catch (e) { if (e.sessao === false) { token = null; ls.del(K_TOKEN); return null; } throw e; }
    },
    atualizando: null,
    async login(email, senha) {
      const j = await call('login', { email, senha });
      token = j.token; ls.set(K_TOKEN, token);
      return st.user;
    },
    logout() {
      if (MODO === 'google' && token) remoto('logout', { token }).catch(() => {});
      token = null; st = null; ls.del(K_TOKEN); ls.del(K_SNAP);
      Object.keys(cacheAss).forEach(k => delete cacheAss[k]);
    },
    user: () => (st ? st.user : null),
    superAdmin: () => !!(st && st.superAdmin),
    fornecedoresPendentes: () => (st ? Number(st.fornecedoresPendentes) || 0 : 0),
    temAssinatura: () => !!(st && st.temAssinatura),
    async assinaturaInfo(token) { const j = await call('assinaturaInfo', { tk: token }); return j.dados; },
    async salvarAssinatura(token, png) { const j = await call('salvarAssinatura', { tk: token, png }); return j.dados; },
    async assinaturas(ids) {
      const faltam = ids.filter(id => !(id in cacheAss));
      if (faltam.length) {
        const j = await call('assinaturas', { ids: faltam });
        const m = (j.state && j.state.extra && j.state.extra.assinaturas) || {};
        faltam.forEach(id => { cacheAss[id] = m[id] || null; });
      }
      const out = {}; ids.forEach(id => { if (cacheAss[id]) out[id] = cacheAss[id]; }); return out;
    },
    esquecerAssinaturas() { Object.keys(cacheAss).forEach(k => delete cacheAss[k]); },
    /** Cidade de quem está solicitando (geolocalização do navegador) */
    cidadeAtual() {
      if (this._cidade) return this._cidade;
      this._cidade = new Promise((ok, falha) => {
        if (!navigator.geolocation) return falha(new Error('Este navegador não informa a localização.'));
        navigator.geolocation.getCurrentPosition(async pos => {
          const { latitude: la, longitude: lo } = pos.coords;
          try {
            const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${la}&longitude=${lo}&localityLanguage=pt`);
            const j = await r.json();
            const c = j.city || j.locality, uf = String(j.principalSubdivisionCode || '').replace(/^BR-/, '');
            if (c) return ok(uf ? c + '/' + uf : c);
          } catch (e) { /* tenta a próxima */ }
          try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${la}&lon=${lo}&accept-language=pt-BR`);
            const a = (await r.json()).address || {};
            const c = a.city || a.town || a.village || a.municipality, uf = String(a['ISO3166-2-lvl4'] || '').replace(/^BR-/, '');
            if (c) return ok(uf ? c + '/' + uf : c);
          } catch (e) { /* sem internet */ }
          falha(new Error('Não foi possível identificar a cidade.'));
        }, err => falha(new Error(err.code === 1 ? 'Localização não autorizada no navegador.' : 'Não foi possível obter a localização.')),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 30 * 60 * 1000 });
      });
      this._cidade.catch(() => { this._cidade = null; });
      return this._cidade;
    },
    async salvarPdf(id, blob) {
      if (MODO !== 'google') return null;
      const base64 = await lerArquivo(blob);
      return call('salvarPdf', { id, base64 });
    },
    acessosPendentes: () => (st ? Number(st.acessosPendentes) || 0 : 0),
    emailAutorizado: E.emailAutorizado,
    dominio: E.DOMINIO_AUTORIZADO,
    async verificarEmail(email) { const j = await call('verificarEmail', { email }); return j.dados; },
    async solicitarAcesso(dados) { const j = await call('solicitarAcesso', dados); return j.dados; },
    extra: () => (st ? st.extra || {} : {}),
    refresh: () => call('state'),
    act: (action, payload) => call(action, payload),
    /** Cria a solicitação enviando junto os arquivos de orçamento */
    async criarSolicitacao(data, orcs) {
      const MB = 1024 * 1024; let total = 0;
      const lista = [];
      for (const o0 of orcs) {
        const o = Object.assign({}, o0, { file: await otimizarArquivo(o0.file) });
        if (o.file.size > 10 * MB) throw new Error(`O arquivo "${o.file.name}" passa de 10 MB.`);
        total += o.file.size;
        lista.push({ fornecedor: o.fornecedor, valor: o.valor, nome: o.file.name, mime: o.file.type, base64: await lerArquivo(o.file) });
      }
      if (total > 30 * MB) throw new Error('Os orçamentos somam mais de 30 MB. Reduza o tamanho dos arquivos (ex.: PDF em vez de foto).');
      return call('createRequest', { data, orcamentos: lista });
    },
    minOrcamentos: () => (st && st.minOrcamentos != null ? Number(st.minOrcamentos) : 3),
    async upload(solicitacaoId, file, fornecedor, valor) {
      if (!file) throw new Error('Selecione o arquivo do orçamento.');
      file = await otimizarArquivo(file);
      const base64 = await lerArquivo(file);
      return call('uploadOrcamento', { solicitacaoId, fornecedor, valor, nome: file.name, mime: file.type, base64 });
    },

    // leitura (síncrona, a partir do último estado)
    limites: () => st.limites,
    limiteDoNivel: n => Number(st.limites[n]) || 0,
    nomeNivel: n => (Number(n) === 5 ? 'Financeiro' : n >= 4 ? C.instanciaSuperior : (C.niveis[n] ? C.niveis[n].nome : '—')),
    nivelNecessario: total => E.nivelNecessario(st.limites, total),
    podeAprovar: (u, r) => E.podeAprovar(u, r, st.limites),
    limiteDoUsuario: u => E.limiteDoUsuario(st.limites, u),
    limiteGerente: dep => E.limiteGerente(st.limites, dep),
    maiorTetoGerente: () => E.maiorTetoGerente(st.limites),
    placas: () => ((st && st.placas) || []).slice(),
    ehVeiculo: E.ehVeiculo, TIPOS_COMPRA: E.TIPOS_COMPRA, TIPOS_MANUTENCAO: E.TIPOS_MANUTENCAO, temProdutos: E.temProdutos, temServicos: E.temServicos, CAT_SERVICOS: E.CAT_SERVICOS, CAT_AMBOS: E.CAT_AMBOS, rotuloProdutos: E.rotuloProdutos,
    calcTotal: itens => E.r2((itens || []).reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.valorUnit) || 0), 0)),
    listRequests: () => st.requests.slice(),
    getRequest: id => st.requests.find(r => r.id === id) || null,
    listUsers: () => st.users.slice(),
    listas: () => (st && st.listas && st.listas.modalidade && st.listas) || { filial: C.filiais, modalidade: C.centrosCusto.concat(['Manutenção de Veículos']), categoria: C.categorias, unidade: C.unidadesMedida, departamento: C.departamentos || ['Logística', 'Administrativo', 'Comercial', 'Operacional'] },
    digitos: E.digitos, cnpjValido: E.cnpjValido, cpfValido: E.cpfValido,
    /** Consulta CNPJ: BrasilAPI direto do navegador; se falhar, via servidor Google (BrasilAPI/ReceitaWS). */
    async consultaCnpj(cnpj) {
      const d = E.digitos(cnpj);
      if (!E.cnpjValido(d)) throw new Error('CNPJ inválido.');
      let ultimo = 'Não foi possível consultar a Receita agora. Preencha os dados manualmente.';
      // 1) Modo Google: o servidor consulta (CNPJá com Inscrição Estadual → BrasilAPI → ReceitaWS)
      if (MODO === 'google' && token) {
        try { const j = await remoto('consultaCnpj', { token, cnpj: d }); return j.dados; }
        catch (e) { if (/não encontrado/i.test(e.message)) throw e; ultimo = e.message || ultimo; }
      }
      // 2) Direto do navegador
      const fontes = ['https://open.cnpja.com/office/' + d, 'https://brasilapi.com.br/api/cnpj/v1/' + d];
      for (const url of fontes) {
        try {
          const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
          const r = await fetch(url, { signal: ctrl.signal });
          clearTimeout(t);
          if (r.status === 404) { ultimo = 'CNPJ não encontrado na Receita Federal.'; continue; }
          if (!r.ok) continue;
          return E.normalizarCnpj(await r.json());
        } catch (e) { /* tenta a próxima fonte */ }
      }
      throw new Error(ultimo);
    },
    catalogo: () => st.catalogo.slice(),
    fornecedores: () => st.fornecedores.slice(),
    precos: () => st.precos.slice(),
    statsPreco,
    norm: E.norm,

    exportCSV() {
      return csv(st.requests, ['numero', 'criadoEm', 'status', 'solicitanteNome', 'nivelSolicitante', 'departamento', 'modalidade', 'centroCusto', 'tipoManutencao', 'categoria', 'fornecedor', 'fornecedorFinal', 'prazoEntrega', 'valorFrete', 'total', 'nivelNecessario', 'aprovadorNome', 'nivelAprovador', 'decididoEm', 'compradoEm', 'numeroPdf', 'emailEnviadoEm']);
    },
    exportPrecosCSV() { return csv(st.precos, ['em', 'codigo', 'descricao', 'fornecedor', 'unidade', 'qtd', 'valorUnit', 'numero']); },
    exportJSON() { return JSON.stringify({ exportadoEm: new Date().toISOString(), empresa: C.empresa, solicitacoes: st.requests, itens: st.catalogo, fornecedores: st.fornecedores, precos: st.precos }, null, 2); },
    resetDemo() { local.reset(); this.logout(); }
  };
})();
