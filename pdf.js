/* ==========================================================
   PDF DO PEDIDO DE COMPRA — Cheiro Verde Ambiental
   Gera o documento (A4) com logo, dados do fornecedor, itens,
   condição de pagamento, cidade, data da aprovação e assinaturas.
   Bibliotecas (jsPDF + AutoTable) ficam na raiz do site e só são
   carregadas quando um PDF é gerado.
   ========================================================== */
window.CVPdf = (function () {
  const VERDE = [0, 147, 52], VERDE_ESC = [15, 61, 34], CINZA = [110, 122, 115], LINHA = [223, 231, 226];
  let libs = null, logoPng = null;

  function carregarScript(src) {
    return new Promise((ok, falha) => {
      const s = document.createElement('script'); s.src = src; s.onload = ok;
      s.onerror = () => falha(new Error('Não foi possível carregar o gerador de PDF.'));
      document.head.appendChild(s);
    });
  }
  async function carregarLibs() {
    if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable) return;
    if (!libs) libs = carregarScript('jspdf.umd.min.js').then(() => carregarScript('jspdf.plugin.autotable.min.js'));
    await libs;
  }
  /** Converte a logo vetorial em PNG de alta resolução */
  function logo() {
    if (logoPng) return Promise.resolve(logoPng);
    return new Promise(ok => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = 1496; c.height = 412;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        logoPng = c.toDataURL('image/png'); ok(logoPng);
      };
      img.onerror = () => ok(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.CV_MARCA.logo(false));
    });
  }
  const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataBR = iso => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
  const dataHoraBR = iso => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const t = v => (v == null || v === '' ? '—' : String(v));

  /**
   * r: solicitação; f: fornecedor (cadastro) ou null; ass: {userId: pngDataUrl}
   * nomeNivel: função para o nome do perfil. Retorna Blob (application/pdf).
   */
  async function gerar(r, f, ass, nomeNivel) {
    await carregarLibs();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 14;
    const png = await logo();
    const pedido = ['aprovado', 'comprado'].includes(r.status) && !!r.numeroPdf;   // após autorização vira Pedido numerado

    // ---------- cabeçalho ----------
    if (png) doc.addImage(png, 'PNG', M, 10, 60, 16.5, 'logo-cv', 'FAST');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...VERDE_ESC);
    doc.text(pedido ? 'PEDIDO DE COMPRA' : 'ESPELHO DA SOLICITAÇÃO', W - M, 16, { align: 'right' });
    doc.setFontSize(14); doc.setTextColor(...(pedido ? VERDE : [180, 106, 0]));
    doc.text(pedido ? 'Nº ' + r.numeroPdf : r.numero, W - M, 23, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
    doc.text(pedido ? 'Ref. interna ' + r.numero : 'Documento de conferência — não é pedido de compra', W - M, 28, { align: 'right' });
    doc.setDrawColor(...VERDE); doc.setLineWidth(0.8); doc.line(M, 32, W - M, 32);

    const secao = (titulo, y) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...VERDE);
      doc.text(titulo.toUpperCase(), M, y);
      doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.line(M, y + 1.5, W - M, y + 1.5);
      return y + 3.5;
    };
    const tabelaInfo = (y, linhas) => {
      doc.autoTable({
        startY: y, theme: 'plain', margin: { left: M, right: M },
        styles: { fontSize: 9, cellPadding: { top: 1.2, bottom: 1.2, left: 1, right: 2 }, textColor: [29, 42, 34] },
        columnStyles: { 0: { fontStyle: 'bold', textColor: CINZA, cellWidth: 34 }, 2: { fontStyle: 'bold', textColor: CINZA, cellWidth: 34 } },
        body: linhas
      });
      return doc.lastAutoTable.finalY;
    };

    // ---------- dados gerais ----------
    const statusTxt = { pendente: 'Aguardando autorização', aprovado: 'Aprovado', comprado: 'Aprovado / Comprado', reprovado: 'Reprovado', cancelado: 'Cancelado' }[r.status] || r.status;
    let y = secao('Dados da solicitação', 39);
    const veic = /manuten[cç][aã]o de ve[ií]culos/i.test(String(r.modalidade || ''));
    y = tabelaInfo(y, [
      ['Data da solicitação', dataHoraBR(r.criadoEm), 'Cidade', t(r.cidade)],
      ['Departamento', t(r.departamento), 'Modalidade', t(r.modalidade)],
      [veic ? 'Centro de custo (placa)' : 'Centro de custo', t(r.centroCusto), 'Categoria', t(r.categoria)]]
      .concat(veic ? [['Tipo de manutenção', t(r.tipoManutencao), 'Prazo de entrega', t(r.prazoEntrega)], ['Situação', { content: statusTxt, colSpan: 3 }]].concat(r.manutencaoDesc ? [['Manutenção vinculada', { content: t(r.manutencaoDesc), colSpan: 3 }]] : []) : [['Prazo de entrega', t(r.prazoEntrega), 'Situação', statusTxt]])
      .concat([
      ['Solicitante', t(r.solicitanteNome), 'Data da aprovação', ['aprovado', 'comprado'].includes(r.status) ? dataBR(r.decididoEm) : '—']
    ]));

    // ---------- fornecedor ----------
    y = secao('Fornecedor', y + 6);
    const nomeF = r.fornecedorFinal || r.fornecedor;
    const endF = f ? [f.endereco, [f.cidade, f.uf].filter(Boolean).join('/'), f.cep ? 'CEP ' + f.cep : ''].filter(Boolean).join(' · ') : '';
    y = tabelaInfo(y, [
      ['Razão social', t(f ? f.nome : nomeF), 'CNPJ / CPF', t(f && f.cnpj)],
      ['Nome fantasia', t(f && f.nomeFantasia), 'Inscr. estadual', t(f && f.inscricaoEstadual)],
      ['Endereço', { content: t(endF), colSpan: 3 }],
      ['Contato', t(f && [f.contato, f.telefone, f.email].filter(Boolean).join(' · ')), 'Cond. pagamento', t(r.condicaoPagamento)]
    ]);

    // ---------- motivo ----------
    y = secao('Motivo da compra', y + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(29, 42, 34);
    const linhasMotivo = doc.splitTextToSize(t(r.justificativa), W - 2 * M);
    doc.text(linhasMotivo, M + 1, y + 3.5);
    y += 3.5 + linhasMotivo.length * 4.2;

    // ---------- itens ----------
    const prods = (r.itens || []).filter(i => i.tipo !== 'servico'), servs = (r.itens || []).filter(i => i.tipo === 'servico');
    const rodape = n => (Number(r.valorFrete) > 0 ? [[{ content: 'FRETE', colSpan: n, styles: { halign: 'right', fontSize: 9 } }, { content: brl(r.valorFrete), styles: { halign: 'right', fontSize: 9 } }]] : [])
      .concat([[{ content: 'VALOR TOTAL', colSpan: n, styles: { halign: 'right' } }, { content: brl(r.total), styles: { halign: 'right' } }]]);
    const estilo = {
      margin: { left: M, right: M }, theme: 'striped',
      headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 2 },
      footStyles: { fillColor: [230, 244, 234], textColor: VERDE_ESC, fontStyle: 'bold', fontSize: 10 },
      alternateRowStyles: { fillColor: [247, 251, 248] }
    };
    if (prods.length) {
      y = secao(/consum/i.test(r.categoria || '') ? 'Consumíveis' : /pe[cç]as/i.test(r.categoria || '') ? 'Peças' : 'Itens', y + 4);
      doc.autoTable(Object.assign({}, estilo, {
        startY: y,
        columnStyles: { 0: { cellWidth: 9, halign: 'center' }, 2: { halign: 'right', cellWidth: 18 }, 3: { cellWidth: 14 }, 4: { halign: 'right', cellWidth: 28 }, 5: { halign: 'right', cellWidth: 30 } },
        head: [['#', 'Descrição', 'Qtd', 'Unid.', 'Valor unit.', 'Subtotal']],
        body: prods.map((i, k) => [k + 1, i.descricao, String(i.qtd).replace('.', ','), i.unidade, brl(i.valorUnit), brl(i.qtd * i.valorUnit)]),
        foot: servs.length ? [] : rodape(5)
      }));
      y = doc.lastAutoTable.finalY;
    }
    if (servs.length) {
      y = secao('Serviços', y + (prods.length ? 6 : 4));
      doc.autoTable(Object.assign({}, estilo, {
        startY: y,
        columnStyles: { 0: { cellWidth: 9, halign: 'center' }, 2: { cellWidth: 36 }, 3: { halign: 'right', cellWidth: 30 }, 4: { halign: 'right', cellWidth: 30 } },
        head: [['#', 'Descrição do serviço', 'Prazo', 'Valor', 'Subtotal']],
        body: servs.map((i, k) => [k + 1, i.descricao, i.prazo || '—', brl(i.valorUnit), brl(i.valorUnit)]),
        foot: rodape(4)
      }));
      y = doc.lastAutoTable.finalY;
    }

    // ---------- orçamentos ----------
    const orcs = (r.orcamentos || []).filter(o => o.fornecedor);
    if (!orcs.length && r.orcIncompleto) { y = secao('Orçamentos: nenhum anexado — requer autorização do Gerente', y + 7); }
    if (orcs.length) {
      y = secao('Orçamentos considerados' + (r.orcIncompleto ? ' (' + orcs.length + ' — abaixo do mínimo, requer autorização do Gerente)' : ''), y + 7);
      const vals = orcs.filter(o => Number(o.valor) > 0);
      const menor = vals.length ? vals.reduce((a, b) => (Number(b.valor) < Number(a.valor) ? b : a)) : null;
      doc.autoTable({
        startY: y, margin: { left: M, right: M }, theme: 'plain',
        styles: { fontSize: 8.5, cellPadding: 1.2 }, columnStyles: { 1: { halign: 'right', cellWidth: 34 }, 2: { cellWidth: 30, textColor: VERDE, fontStyle: 'bold' } },
        body: orcs.map(o => [o.fornecedor, Number(o.valor) ? brl(o.valor) : '—', o === menor && orcs.length > 1 ? 'menor valor' : ''])
      });
      y = doc.lastAutoTable.finalY;
    }

    // ---------- assinaturas ----------
    if (y > 222) { doc.addPage(); y = 20; }
    y = Math.max(y + 12, 228);
    const caixa = (x, titulo, uid, nome, subt) => {
      const w = (W - 2 * M - 12) / 2;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
      doc.text(titulo.toUpperCase(), x, y);
      const img = uid && ass && ass[uid];
      if (img) { try { doc.addImage(img, 'PNG', x + 4, y + 2, w - 8, 20, undefined, 'FAST'); } catch (e) { /* ignora */ } }
      doc.setDrawColor(90, 100, 95); doc.setLineWidth(0.3); doc.line(x, y + 24, x + w, y + 24);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(29, 42, 34);
      doc.text(t(nome), x + w / 2, y + 29, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
      doc.text(subt, x + w / 2, y + 33.5, { align: 'center' });
    };
    const colW = (W - 2 * M - 12) / 2;
    caixa(M, 'Solicitado por', r.solicitanteId, r.solicitanteNome, 'Em ' + dataBR(r.criadoEm) + (r.cidade ? ' · ' + r.cidade : ''));
    if (['aprovado', 'comprado'].includes(r.status)) caixa(M + colW + 12, 'Aprovado por', r.aprovadorId, r.aprovadorNome, (nomeNivel(r.nivelAprovador) || '') + ' · Aprovado em ' + dataBR(r.decididoEm));
    else if (r.status === 'reprovado') caixa(M + colW + 12, 'Reprovado por', r.aprovadorId, r.aprovadorNome, 'Em ' + dataBR(r.decididoEm));
    else caixa(M + colW + 12, 'Autorização', null, 'Aguardando autorização', 'Alçada: ' + (nomeNivel(r.nivelNecessario) || ''));

    // ---------- aviso do espelho (somente antes da autorização) ----------
    if (!pedido) {
      const aviso = '* ESTE DOCUMENTO NÃO POSSUI FINALIDADE FISCAL. ELE NÃO AUTORIZA A REALIZAÇÃO DE UMA COMPRA. SERVE APENAS PARA TRÂMITES INTERNOS DA EMPRESA.';
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(29, 42, 34);
      const lin = doc.splitTextToSize(aviso, W - 2 * M - 8);
      const ya = 268, h = 5 + lin.length * 4;
      doc.setDrawColor(180, 106, 0); doc.setFillColor(255, 248, 235); doc.setLineWidth(0.4);
      doc.roundedRect(M, ya, W - 2 * M, h, 1.5, 1.5, 'FD');
      doc.text(lin, W / 2, ya + 5.2, { align: 'center' });
    }

    // ---------- marca d'água e rodapé ----------
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      if (!pedido) {
        doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.08 }));
        doc.setFont('helvetica', 'bold'); doc.setFontSize(r.status === 'pendente' ? 30 : 60); doc.setTextColor(r.status === 'reprovado' ? 192 : 180, r.status === 'reprovado' ? 57 : 106, r.status === 'reprovado' ? 43 : 0);
        doc.text(r.status === 'reprovado' ? 'REPROVADO' : r.status === 'cancelado' ? 'CANCELADO' : 'ESPELHO · AGUARDANDO AUTORIZAÇÃO', W / 2 - 8, 185, { align: 'center', angle: 32 });
        doc.restoreGraphicsState();
      }
      doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.line(M, 284, W - M, 284);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
      doc.text('Cheiro Verde Ambiental · ' + (pedido ? 'Pedido de Compra Nº ' + r.numeroPdf : 'Espelho da solicitação ' + r.numero) + ' · gerado em ' + dataHoraBR(new Date().toISOString()), M, 288.5);
      doc.text('Página ' + i + ' de ' + n, W - M, 288.5, { align: 'right' });
    }
    return doc.output('blob');
  }

  function baixar(blob, nome) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const nomeArquivo = r => (['aprovado', 'comprado'].includes(r.status) && r.numeroPdf ? 'Pedido de Compra ' + r.numeroPdf.replace('/', '-') : 'Espelho da Solicitacao ' + r.numero) + '.pdf';

  return { gerar, baixar, nomeArquivo, carregarLibs };
})();
