export async function createCheckoutSession(userId: string, planType: string, billingCycle: string) {
  return { error: 'O sistema de pagamentos está em modo de demonstração.' };
}

export async function redirectToCheckout(sessionId: string) {
  console.log('Redirecting to checkout session:', sessionId);
}

export async function createPortalSession(userId: string) {
  return { error: 'O portal de faturamento está em modo de demonstração.' };
}
