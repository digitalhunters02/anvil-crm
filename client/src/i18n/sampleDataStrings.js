// sampleDataStrings.js
// PARA QUE SERVE: os textos do cartão "Dados de exemplo" (Configurações, só para o dono) em inglês, português e espanhol.
// Cada chave: [en, pt, es]. É ligado ao dicionário de login/conta (auth/strings.js) por mergeSampleDataStrings, no mesmo estilo de
// trialStrings.js e photoImportStrings.js. As chaves "err.*" aparecem nas mensagens de erro vindas do servidor (friendlyError).
const S = {
  "sample.title": ["Sample data", "Dados de exemplo", "Datos de ejemplo"],
  "sample.sub": [
    "Fictional records so every screen has something to show. Everything is marked as sample and can be removed without touching your real data.",
    "Registros fictícios para que toda tela tenha o que mostrar. Tudo fica marcado como exemplo e pode ser removido sem tocar nos seus dados reais.",
    "Registros ficticios para que cada pantalla tenga algo que mostrar. Todo queda marcado como ejemplo y se puede quitar sin tocar tus datos reales.",
  ],
  "sample.stateNone": ["No sample data is loaded.", "Nenhum dado de exemplo carregado.", "No hay datos de ejemplo cargados."],
  "sample.stateLoaded": ["Sample data is loaded: {n} records.", "Dados de exemplo carregados: {n} registros.", "Datos de ejemplo cargados: {n} registros."],
  "sample.stateBlocked": [
    "This installation already has real data (customers, quotes, orders or stock), so sample data can't be loaded. It is never mixed with real data.",
    "Esta instalação já tem dados reais (clientes, orçamentos, ordens ou estoque), então os exemplos não podem ser carregados. Eles nunca se misturam com dados reais.",
    "Esta instalación ya tiene datos reales (clientes, presupuestos, órdenes o inventario), por eso no se pueden cargar los ejemplos. Nunca se mezclan con datos reales.",
  ],
  "sample.stateError": ["Could not check the sample data. Try again.", "Não foi possível verificar os dados de exemplo. Tente de novo.", "No se pudo comprobar los datos de ejemplo. Inténtalo de nuevo."],
  "sample.trialNote": [
    "Free-trial visitors see what is in this installation, so loading the sample data gives them a full demo.",
    "Quem faz o teste grátis vê o que está nesta instalação, então carregar os exemplos mostra um demo completo.",
    "Quien hace la prueba gratis ve lo que hay en esta instalación, así que cargar los ejemplos muestra una demo completa.",
  ],
  "sample.load": ["Load sample data", "Carregar dados de exemplo", "Cargar datos de ejemplo"],
  "sample.loading": ["Loading…", "Carregando…", "Cargando…"],
  "sample.remove": ["Remove sample data", "Remover dados de exemplo", "Quitar datos de ejemplo"],
  "sample.removing": ["Removing…", "Removendo…", "Quitando…"],
  "sample.removeTitle": ["Remove sample data?", "Remover os dados de exemplo?", "¿Quitar los datos de ejemplo?"],
  "sample.removeBody": [
    "Only the records marked as sample are deleted. Your real customers, orders and stock are not touched.",
    "Só os registros marcados como exemplo são apagados. Seus clientes, ordens e estoque reais não são tocados.",
    "Solo se borran los registros marcados como ejemplo. Tus clientes, órdenes e inventario reales no se tocan.",
  ],
  "sample.removeConfirm": ["Yes, remove", "Sim, remover", "Sí, quitar"],
  "sample.cancel": ["Cancel", "Cancelar", "Cancelar"],
  "sample.loadedOk": ["Sample data loaded: {n} records.", "Dados de exemplo carregados: {n} registros.", "Datos de ejemplo cargados: {n} registros."],
  "sample.alreadyOk": ["Sample data was already loaded. Nothing was added.", "Os dados de exemplo já estavam carregados. Nada foi adicionado.", "Los datos de ejemplo ya estaban cargados. No se añadió nada."],
  "sample.removedOk": ["Sample data removed: {n} records.", "Dados de exemplo removidos: {n} registros.", "Datos de ejemplo quitados: {n} registros."],
  "sample.removedNone": ["There was no sample data to remove.", "Não havia dados de exemplo para remover.", "No había datos de ejemplo que quitar."],
  "sample.removedKept": [
    "{k} sample records were kept because your real records still use them.",
    "{k} registros de exemplo foram mantidos porque registros reais seus ainda os usam.",
    "Se mantuvieron {k} registros de ejemplo porque tus registros reales todavía los usan.",
  ],
  "sample.t.customers": ["Customers", "Clientes", "Clientes"],
  "sample.t.rfqs": ["RFQs", "Cotações (RFQ)", "Cotizaciones (RFQ)"],
  "sample.t.quotes": ["Quotes", "Orçamentos", "Presupuestos"],
  "sample.t.work_orders": ["Work orders", "Ordens de serviço", "Órdenes de trabajo"],
  "sample.t.purchase_orders": ["Purchase orders", "Pedidos de compra", "Órdenes de compra"],
  "sample.t.invoices": ["Invoices", "Faturas", "Facturas"],
  "sample.t.suppliers": ["Suppliers", "Fornecedores", "Proveedores"],
  "sample.t.inventory_items": ["Inventory items", "Itens de estoque", "Artículos de inventario"],
  "err.sample_has_real_data": [
    "This installation already has real data, so sample data was not loaded.",
    "Esta instalação já tem dados reais, então os dados de exemplo não foram carregados.",
    "Esta instalación ya tiene datos reales, por eso no se cargaron los datos de ejemplo.",
  ],
};

export function mergeSampleDataStrings(TR) {
  const idx = { en: 0, pt: 1, es: 2 };
  for (const [key, vals] of Object.entries(S)) {
    for (const lang of Object.keys(idx)) TR[lang][key] = vals[idx[lang]];
  }
  return TR;
}
