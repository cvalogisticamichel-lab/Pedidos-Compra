/* ==========================================================
   CONFIGURAÇÃO GERAL — Cheiro Verde Ambiental | Pedidos de Compra
   Edite este arquivo para ajustar níveis, limites, filiais etc.
   Os limites também podem ser alterados pela tela "Configurações"
   (usuário Gerente). O valor salvo na tela tem prioridade.
   ========================================================== */
window.CV_CONFIG = {
  empresa: 'Cheiro Verde Ambiental',
  sistema: 'Pedidos de Compra',
  versao: '2.12.0',
  apiMinima: '2.12.0',   // versão mínima do Apps Script (Código.gs) que este site exige

  // ========= INTEGRAÇÃO GOOGLE (Planilha + Drive) =========
  // Cole aqui a URL do App da Web do Google Apps Script (termina em /exec).
  // Deixe vazio ('') para usar o modo demonstração (dados só no navegador).
  // Veja o passo a passo em GUIA-GOOGLE.txt
  apiUrl: 'https://script.google.com/macros/s/AKfycbwByaWimsDi3T-4wiw7FPOFh1MqikQHSFl27uVngA7KmLbiBD2yZHyhIaDKVxoDMY2jPQ/exec',

  // Nomes dos níveis. Os LIMITES (R$) ficam na aba Config da planilha
  // e são alterados na tela Configurações (Gerente). Valores abaixo = referência inicial.
  niveis: {
    1: { nome: 'Comprador',  limite: 2000 },
    2: { nome: 'Supervisor', limite: 10000 },
    3: { nome: 'Gerente',    limite: 50000 },
    5: { nome: 'Financeiro', limite: 0 }   // somente consulta
  },
  departamentos: ['Logística', 'Administrativo', 'Comercial', 'Operacional'],
  // Acima do limite do Gerente, o pedido fica aguardando esta instância:
  instanciaSuperior: 'Diretoria',

  // Filiais, centros de custo, categorias e unidades agora vêm da aba "Listas"
  // da planilha (ou da tela Configurações). Os valores abaixo são usados só
  // como reserva, caso a lista não carregue.
  filiais: ['Bernardino de Campos (Matriz)', 'Assis', 'São Manuel', 'Botucatu'],

  centrosCusto: [
    'Operações - Coleta',
    'Frota e Manutenção',
    'Tratamento de Resíduos',
    'Segurança do Trabalho',
    'Administrativo',
    'TI',
    'Comercial'
  ],

  categorias: [
    'EPI',
    'Materiais de consumo',
    'Embalagens e coletores',
    'Peças e manutenção',
    'Combustível',
    'Equipamentos',
    'Serviços',
    'TI',
    'Escritório'
  ],

  unidadesMedida: ['un', 'cx', 'pct', 'kg', 'L', 'm', 'serv', 'h']

};
