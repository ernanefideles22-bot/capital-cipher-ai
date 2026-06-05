import { useState } from 'react';
import type { Plan, Subscription, Usage, UserUsageStats } from '@/types/subscription';

const mockPlan: Plan = {
  id: 'plan_pro',
  name: 'PRO',
  displayName: 'Plano Pro',
  description: 'Acesso completo ao bot e recursos de IA.',
  price: 4900,
  currency: 'USD',
  billingCycle: 'monthly',
  features: [],
  limits: {
    maxConnectedAccounts: 3,
    maxTradingBots: 5,
    maxBacktests: 100,
    apiCallsPerDay: 10000,
    storageGb: 10,
    supportLevel: 'priority',
    customReportsAllowed: true,
    whitelabelAllowed: false,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPlans: Plan[] = [
  {
    id: 'plan_free',
    name: 'FREE',
    displayName: 'Plano Gratuito',
    description: 'Recursos básicos para simulação.',
    price: 0,
    currency: 'USD',
    billingCycle: 'monthly',
    features: [],
    limits: {
      maxConnectedAccounts: 1,
      maxTradingBots: 1,
      maxBacktests: 5,
      apiCallsPerDay: 1000,
      storageGb: 1,
      supportLevel: 'community',
      customReportsAllowed: false,
      whitelabelAllowed: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  mockPlan,
  {
    id: 'plan_enterprise',
    name: 'ENTERPRISE',
    displayName: 'Plano Enterprise',
    description: 'Para fundos e grandes operações.',
    price: 19900,
    currency: 'USD',
    billingCycle: 'monthly',
    features: [],
    limits: {
      maxConnectedAccounts: 10,
      maxTradingBots: 20,
      maxBacktests: 1000,
      apiCallsPerDay: 100000,
      storageGb: 50,
      supportLevel: 'priority',
      customReportsAllowed: true,
      whitelabelAllowed: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

const mockSubscription: Subscription = {
  id: 'sub_123',
  userId: 'user_123',
  planId: 'plan_pro',
  planType: 'PRO',
  status: 'ACTIVE',
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
  autoRenew: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUsage: Usage = {
  id: 'usage_123',
  userId: 'user_123',
  month: new Date(),
  connectedAccountsUsed: 1,
  tradingBotsCreated: 2,
  backtestsRun: 15,
  apiCallsMade: 450,
  storageUsedMb: 512,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUsageStats: UserUsageStats = {
  subscription: mockSubscription,
  plan: mockPlan,
  currentUsage: mockUsage,
  usagePercentages: {
    accounts: 33.3,
    bots: 40,
    backtests: 15,
    apiCalls: 4.5,
    storage: 5,
  },
  isNearLimit: false,
};

export function useSubscription() {
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  return {
    subscription: mockSubscription,
    plans: mockPlans,
    usage: mockUsage,
    loading,
    error,
    usageStats: mockUsageStats,
    remainingTrialDays: null,
  };
}
