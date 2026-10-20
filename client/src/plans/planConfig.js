// planConfig.js
// ARQUIVO DE AJUSTE (o único dos arquivos de "selo de plano" que é específico do produto): aqui ficam as ligações com este app.
// Os demais (PlanBadge, PlanUpsellModal, PlanPreview, planPreview, planStrings) são cópias do kit do Rex, iguais em todos os CRMs.
// Os planos, preços, o plano mínimo de cada recurso e o que cada plano acrescenta vêm do SERVIDOR (/api/billing/status,
// /api/public/plans; server/src/planConfig.js: FEATURE_MIN_PLAN). Aqui só ficam: textos dos recursos, quais itens de menu têm
// selo e os nomes de exibição dos planos.
import { BASE } from "../api.js";

export const API_URL = BASE; // endereço da API deste app (o cabeçalho X-Preview-Plan só vai para ele)
export const APP_NAME = "Anvil"; // aparece na faixa "Você está vendo o … como o plano …"
export const PREVIEW_STORAGE_KEY = "anvil_preview_plan"; // chave do localStorage (única por produto)
export const CURRENCY = "USD"; // moeda dos preços do catálogo (código ISO)

// Nomes de exibição dos planos (as chaves são as do servidor: o plano de entrada se chama "basico" e aparece como Essential).
// Ordem dos idiomas: [en, pt, es].
export const PLAN_NAMES = {
  basico: ["Essential", "Essencial", "Esencial"],
  essencial: ["Professional", "Profissional", "Profesional"],
  completo: ["Complete", "Completo", "Completo"],
};

// Itens de menu (rota) -> recurso do servidor (chave de FEATURE_MIN_PLAN em server/src/planConfig.js).
export const NAV_GATES = {
  "/rfqs": "rfqs",
  "/work-orders": "work_orders",
  "/bill-of-materials": "bill_of_materials",
  "/calendar": "production_calendar",
  "/costing": "job_costing",
  "/quality-inspections": "quality_inspections",
  "/inventory": "inventory",
  "/shortages": "mrp",
  "/purchase-orders": "purchase_orders",
  "/shipments": "shipments",
  "/automations": "automations",
  "/whatsapp": "whatsapp",
  "/reports": "reports",
};

// Texto de cada recurso com selo: nome curto + 1–2 frases do que faz. Ordem dos idiomas: [en, pt, es].
// Para um recurso novo: acrescente a chave igual à de FEATURE_MIN_PLAN no servidor.
export const GATE_TEXT = {
  rfqs: {
    name: ["RFQs", "Pedidos de cotação (RFQ)", "Solicitudes de cotización (RFQ)"],
    what: ["Log each request for quote from a customer, track it to the quote and see which ones you won.", "Registre cada pedido de cotação de um cliente, acompanhe até o orçamento e veja quais você ganhou.", "Registre cada solicitud de cotización de un cliente, sígala hasta la cotización y vea cuáles ganó."],
  },
  work_orders: {
    name: ["Work orders", "Ordens de produção", "Órdenes de trabajo"],
    what: ["Release jobs to the shop floor with the part, quantity and due date, and follow each one to done.", "Libere os trabalhos para o chão de fábrica com a peça, a quantidade e o prazo, e acompanhe cada um até o fim.", "Libere trabajos a planta con la pieza, la cantidad y la fecha, y siga cada uno hasta terminarlo."],
  },
  bill_of_materials: {
    name: ["Bill of materials", "Lista de materiais (BOM)", "Lista de materiales (BOM)"],
    what: ["Define what goes into each part: materials, quantities and steps, ready to cost and to build.", "Defina o que entra em cada peça: materiais, quantidades e etapas, pronto para custear e produzir.", "Defina lo que lleva cada pieza: materiales, cantidades y pasos, listo para costear y producir."],
  },
  production_calendar: {
    name: ["Production calendar", "Calendário de produção", "Calendario de producción"],
    what: ["See every job on a calendar by machine and day, so overloads show up before they hurt.", "Veja cada trabalho num calendário por máquina e dia, e perceba a sobrecarga antes de ela atrapalhar.", "Vea cada trabajo en un calendario por máquina y día, y detecte la sobrecarga antes de que perjudique."],
  },
  job_costing: {
    name: ["Job costing", "Custo por trabalho", "Costo por trabajo"],
    what: ["Compare what a job was quoted at with what it really cost, and see the margin job by job.", "Compare quanto o trabalho foi orçado com o quanto realmente custou, e veja a margem trabalho a trabalho.", "Compare lo cotizado con lo que realmente costó cada trabajo y vea el margen trabajo por trabajo."],
  },
  quality_inspections: {
    name: ["Quality inspections", "Inspeções de qualidade", "Inspecciones de calidad"],
    what: ["Record inspections against a job, with pass or fail and notes, and keep the history for audits.", "Registre inspeções de cada trabalho, com aprovado ou reprovado e observações, e guarde o histórico para auditorias.", "Registre inspecciones de cada trabajo, con aprobado o rechazado y notas, y guarde el historial para auditorías."],
  },
  inventory: {
    name: ["Inventory", "Estoque", "Inventario"],
    what: ["Track materials and parts by lot, with barcodes, and always know what is on the shelf.", "Controle materiais e peças por lote, com código de barras, e saiba sempre o que há na prateleira.", "Controle materiales y piezas por lote, con códigos de barras, y sepa siempre lo que hay en el estante."],
  },
  mrp: {
    name: ["Shortages and buying", "Faltas e compras", "Faltantes y compras"],
    what: ["See what is missing for the jobs you have, and turn the shortage into a purchase order in one click.", "Veja o que falta para os trabalhos que você tem e transforme a falta em pedido de compra com um clique.", "Vea lo que falta para los trabajos que tiene y convierta el faltante en una orden de compra con un clic."],
  },
  purchase_orders: {
    name: ["Purchase orders", "Pedidos de compra", "Órdenes de compra"],
    what: ["Send orders to your suppliers and see what is on the way and what arrived.", "Envie pedidos aos fornecedores e veja o que está a caminho e o que já chegou.", "Envíe pedidos a sus proveedores y vea lo que va en camino y lo que ya llegó."],
  },
  shipments: {
    name: ["Shipments", "Remessas", "Envíos"],
    what: ["Record what ships, with carrier and tracking, so the customer always knows where the parts are.", "Registre o que sai, com transportadora e rastreio, para o cliente saber onde estão as peças.", "Registre lo que se envía, con transportista y seguimiento, para que el cliente sepa dónde están las piezas."],
  },
  reports: {
    name: ["Reports", "Relatórios", "Informes"],
    what: ["Quotes, jobs, on-time delivery and cost numbers, ready to look at or export.", "Números de orçamentos, trabalhos, entrega no prazo e custos, prontos para ver ou exportar.", "Números de cotizaciones, trabajos, entrega a tiempo y costos, listos para ver o exportar."],
  },
  automations: {
    name: ["Automations", "Automações", "Automatizaciones"],
    what: ["Tasks and messages that happen by themselves when a quote or job changes stage.", "Tarefas e mensagens que acontecem sozinhas quando um orçamento ou trabalho muda de etapa.", "Tareas y mensajes que ocurren solos cuando una cotización o trabajo cambia de etapa."],
  },
  whatsapp: {
    name: ["WhatsApp", "WhatsApp", "WhatsApp"],
    what: ["Talk to customers and suppliers on WhatsApp from inside Anvil, with your own WhatsApp Business account.", "Fale com clientes e fornecedores pelo WhatsApp dentro do Anvil, com a sua conta WhatsApp Business.", "Hable con clientes y proveedores por WhatsApp desde Anvil, con su propia cuenta de WhatsApp Business."],
  },
};
