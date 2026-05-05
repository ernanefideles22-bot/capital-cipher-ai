// Subscription and SaaS related types

export type PlanType = 'FREE' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'TRIAL';
export type BillingCycle = 'monthly' | 'annual';

export interface Plan {
  id: string;
  name: PlanType;
  displayName: string;
  description: string;
  price: number; // in cents
  currency: 'USD' | 'BRL';
  billingCycle: BillingCycle;
  features: PlanFeature[];
  limits: PlanLimits;
  stripePriceId?: string;
  stripeProductId?: string;
  isPopular?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanFeature {
  name: string;
  description: string;
  included: boolean;
  limit?: string; // e.g., "Até 5 contas"
}

export interface PlanLimits {
  maxConnectedAccounts: number; // Quantas contas Bybit podem conectar
  maxTradingBots: number;
  maxBacktests: number; // Per month
  apiCallsPerDay: number;
  storageGb: number;
  supportLevel: 'community' | 'email' | 'priority'; // Support type
  customReportsAllowed: boolean;
  whitelabelAllowed: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt?: Date;
  trialStartedAt?: Date;
  trialEndsAt?: Date;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Usage {
  id: string;
  userId: string;
  month: Date; // First day of the month
  connectedAccountsUsed: number;
  tradingBotsCreated: number;
  backtestsRun: number;
  apiCallsMade: number;
  storageUsedMb: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  userId: string;
  subscriptionId: string;
  stripeInvoiceId?: string;
  amount: number; // in cents
  currency: 'USD' | 'BRL';
  status: 'DRAFT' | 'SENT' | 'PAID' | 'FAILED' | 'REFUNDED';
  invoiceDate: Date;
  dueDate: Date;
  paidDate?: Date;
  pdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  type: 'card' | 'bank_transfer';
  brand?: string; // 'visa', 'mastercard', etc
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingDetails {
  userId: string;
  stripeCustomerId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  vatNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

export interface UserUsageStats {
  subscription: Subscription;
  plan: Plan;
  currentUsage: Usage;
  usagePercentages: {
    accounts: number;
    bots: number;
    backtests: number;
    apiCalls: number;
    storage: number;
  };
  remainingTrialDays?: number;
  isNearLimit: boolean;
  warningMessage?: string;
}
