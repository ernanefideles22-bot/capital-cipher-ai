import type { Plan } from '@/types/subscription';

export function usePlanPermissions(plan: Plan, plans: Plan[]) {
  return {
    canConnectAccounts: true,
    canCreateBots: true,
    canRunBacktests: true,
  };
}
