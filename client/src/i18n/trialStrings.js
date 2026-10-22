// Textos do teste grátis de 3 dias (login, faixa, contato). Cada chave: [en, pt, es].
// Ligado ao dicionário de login/conta (auth/strings.js) por mergeTrialStrings, no mesmo estilo de photoImportStrings.js.
const S = {
  "trial.cta": ["Free 3-day trial", "Teste grátis de 3 dias", "Prueba gratis de 3 días"],
  "trial.title": ["Try Anvil free for 3 days", "Teste o Anvil grátis por 3 dias", "Prueba Anvil gratis por 3 días"],
  "trial.intro": ["Explore the app with sample data. No credit card needed.", "Explore o app com dados de exemplo. Sem cartão de crédito.", "Explora la app con datos de ejemplo. Sin tarjeta de crédito."],
  "trial.name": ["Your name", "Seu nome", "Tu nombre"],
  "trial.email": ["Email", "E-mail", "Correo"],
  "trial.submit": ["Start free trial", "Começar teste grátis", "Empezar prueba gratis"],
  "trial.submitting": ["Starting…", "Iniciando…", "Iniciando…"],
  "trial.back": ["Back to sign in", "Voltar ao login", "Volver al inicio de sesión"],
  "trial.ended": ["Your free trial has ended. Contact Impact Digital to subscribe.", "Seu teste grátis terminou. Fale com a Impact Digital para assinar.", "Tu prueba gratis terminó. Habla con Impact Digital para suscribirte."],
  "trial.banner": ["Free trial: ends {when}", "Teste grátis: termina em {when}", "Prueba gratis: termina el {when}"],
  "trial.subscribe": ["Subscribe", "Assinar", "Suscribirme"],
  "trial.contactTitle": ["Talk to Impact Digital", "Fale com a Impact Digital", "Habla con Impact Digital"],
  "trial.contactBody": ["Plans and billing are handled by Impact Digital. Send us an email and we will set up your subscription.", "Planos e cobrança são feitos pela Impact Digital. Mande um e-mail e preparamos a sua assinatura.", "Los planes y el cobro los gestiona Impact Digital. Escríbenos un correo y preparamos tu suscripción."],
  "trial.contactButton": ["Email {email}", "Enviar e-mail para {email}", "Escribir a {email}"],
  "trial.contactSubject": ["Anvil subscription", "Assinatura do Anvil", "Suscripción a Anvil"],
  "trial.close": ["Close", "Fechar", "Cerrar"],
  "trial.accountNote": ["This is a free-trial login, so it has no password to change. It works on sample data and ends automatically.", "Este é um login de teste grátis, então não tem senha para trocar. Ele usa dados de exemplo e termina sozinho.", "Este es un acceso de prueba gratis, por eso no tiene contraseña que cambiar. Usa datos de ejemplo y termina solo."],
  "err.demo_blocked": ["Not available in the free trial.", "Não disponível no teste grátis.", "No disponible en la prueba gratis."],
  "err.trial_expired": ["Your free trial has ended. Contact Impact Digital to subscribe.", "Seu teste grátis terminou. Fale com a Impact Digital para assinar.", "Tu prueba gratis terminó. Habla con Impact Digital para suscribirte."],
};

export function mergeTrialStrings(TR) {
  const idx = { en: 0, pt: 1, es: 2 };
  for (const [key, vals] of Object.entries(S)) {
    for (const lang of Object.keys(idx)) TR[lang][key] = vals[idx[lang]];
  }
  return TR;
}
