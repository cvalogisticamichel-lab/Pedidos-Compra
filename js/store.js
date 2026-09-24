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
      if (this.db) return this.db;
      try { this.db = JSON.parse(ls.get(K_DB)); } catch (e) { this.db = null; }
      if (!this.db || !this.db.Usuarios) { this.db = E.seed(this.ctx, { demo: true, filiais: C.filiais }); this.save(); }
      if (!this.db.Listas) { this.db.Listas = E.linhasListasPadrao(); this.save(); } // dados salvos na versão anterior
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
      const u = db.Usuarios.find(x => x.id === p.token && x.ativo !== false);
      if (!u) { const e = new Error('Sessão expirada. Entre novamente.'); e.sessao = false; throw e; }
      let a = action;
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

  async function call(action, p) {
    p = Object.assign({}, p || {}, { token });
    const j = MODO === 'google' ? await remoto(action, p) : await local.call(action, p);
    if (j.state) st = j.state;
    return j;
  }

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
      try { await call('state'); return st.user; }
      catch (e) { if (e.sessao === false) { token = null; ls.del(K_TOKEN); return null; } throw e; }
    },
    async login(email, senha) {
      const j = await call('login', { email, senha });
      token = j.token; ls.set(K_TOKEN, token);
      return st.user;
    },
    logout() {
      if (MODO === 'google' && token) remoto('logout', { token }).catch(() => {});
      token = null; st = null; ls.del(K_TOKEN);
    },
    user: () => (st ? st.user : null),
    extra: () => (st ? st.extra || {} : {}),
    refresh: () => call('state'),
    act: (action, payload) => call(action, payload),
    async upload(solicitacaoId, file, fornecedor, valor) {
      if (!file) throw new Error('Selecione o arquivo do orçamento.');
      const base64 = await lerArquivo(file);
      return call('uploadOrcamento', { solicitacaoId, fornecedor, valor, nome: file.name, mime: file.type, base64 });
    },

    // leitura (síncrona, a partir do último estado)
    limites: () => st.limites,
    limiteDoNivel: n => Number(st.limites[n]) || 0,
    nomeNivel: n => (n >= 4 ? C.instanciaSuperior : (C.niveis[n] ? C.niveis[n].nome : '—')),
    nivelNecessario: total => E.nivelNecessario(st.limites, total),
    podeAprovar: (u, r) => E.podeAprovar(u, r),
    calcTotal: itens => E.r2((itens || []).reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.valorUnit) || 0), 0)),
    listRequests: () => st.requests.slice(),
    getRequest: id => st.requests.find(r => r.id === id) || null,
    listUsers: () => st.users.slice(),
    listas: () => (st && st.listas) || { filial: C.filiais, centroCusto: C.centrosCusto, categoria: C.categorias, unidade: C.unidadesMedida },
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
      return csv(st.requests, ['numero', 'criadoEm', 'status', 'solicitanteNome', 'nivelSolicitante', 'filial', 'centroCusto', 'categoria', 'fornecedor', 'fornecedorFinal', 'urgencia', 'total', 'nivelNecessario', 'aprovadorNome', 'nivelAprovador', 'decididoEm', 'compradoEm']);
    },
    exportPrecosCSV() { return csv(st.precos, ['em', 'codigo', 'descricao', 'fornecedor', 'unidade', 'qtd', 'valorUnit', 'numero']); },
    exportJSON() { return JSON.stringify({ exportadoEm: new Date().toISOString(), empresa: C.empresa, solicitacoes: st.requests, itens: st.catalogo, fornecedores: st.fornecedores, precos: st.precos }, null, 2); },
    resetDemo() { local.reset(); this.logout(); }
  };
})();
