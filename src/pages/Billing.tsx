import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { usePlanPermissions } from '@/lib/permissions';
import { createCheckoutSession, redirectToCheckout, createPortalSession } from '@/lib/stripe';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Check,
  Loader2,
  AlertCircle,
  CreditCard,
  Calendar,
  Zap,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

const Billing = () => {
  const navigate = useNavigate();
  const { subscription, plans, usage, loading, error, usageStats, remainingTrialDays } =
    useSubscription();
  const [upgrading, setUpgrading] = useState(false);
  const [managingBilling, setManagingBilling] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando informações de billing...</p>
        </div>
      </div>
    );
  }

  if (error || !subscription || !usageStats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Erro ao carregar informações de billing'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleUpgrade = async (planType: 'PRO' | 'ENTERPRISE') => {
    setUpgrading(true);
    try {
      const result = await createCheckoutSession(
        subscription.user_id,
        planType,
        'monthly'
      );

      if ('sessionId' in result) {
        await redirectToCheckout(result.sessionId);
      } else {
        alert(`Erro: ${result.error}`);
      }
    } catch (err) {
      alert(`Erro ao processar upgrade: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUpgrading(false);
    }
  };

  const handleManageBilling = async () => {
    setManagingBilling(true);
    try {
      const result = await createPortalSession(subscription.user_id);

      if ('url' in result) {
        window.open(result.url, '_blank');
      } else {
        alert(`Erro: ${result.error}`);
      }
    } catch (err) {
      alert(`Erro ao abrir portal de billing: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setManagingBilling(false);
    }
  };

  const isTrialing = subscription.status === 'TRIAL';
  const currentPlan = usageStats.plan;
  const permissions = usePlanPermissions(currentPlan, plans);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Plano e Faturamento</h1>
          <p className="text-muted-foreground">
            Gerencie sua assinatura, plano e método de pagamento
          </p>
        </div>

        {/* Trial Warning */}
        {isTrialing && remainingTrialDays !== null && remainingTrialDays <= 7 && (
          <Alert className="bg-warning/10 border-warning/30">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              Seu período de teste expira em {remainingTrialDays} dias. Faça upgrade agora para
              continuar usando a plataforma.
            </AlertDescription>
          </Alert>
        )}

        {/* Current Plan Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  {currentPlan.displayName}
                </CardTitle>
                <CardDescription>{currentPlan.description}</CardDescription>
              </div>
              <Badge variant={isTrialing ? 'secondary' : 'default'}>
                {subscription.status === 'ACTIVE' ? 'Ativo' : 'Teste Grátis'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan Price */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Preço do plano</p>
              <p className="text-3xl font-bold">
                {currentPlan.price === 0 ? (
                  'Grátis'
                ) : (
                  <>
                    ${(currentPlan.price / 100).toFixed(2)}{' '}
                    <span className="text-base text-muted-foreground">
                      / {currentPlan.billingCycle === 'monthly' ? 'mês' : 'ano'}
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Billing Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Período Atual
                </p>
                <p className="font-medium">
                  {new Date(subscription.current_period_start).toLocaleDateString('pt-BR')} -{' '}
                  {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
                </p>
              </div>

              {isTrialing && remainingTrialDays !== null && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Dias restantes no teste</p>
                  <p className="text-2xl font-bold text-primary">{remainingTrialDays}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Renovação automática</p>
                <Badge variant={subscription.auto_renew ? 'default' : 'outline'}>
                  {subscription.auto_renew ? 'Ativada' : 'Desativada'}
                </Badge>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              {currentPlan.name !== 'ENTERPRISE' && (
                <Button onClick={handleManageBilling} variant="outline" disabled={managingBilling}>
                  {managingBilling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Gerenciar Faturamento
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Stats */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Uso do Plano</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Connected Accounts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Contas Conectadas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-bold">
                  {usageStats.currentUsage?.connected_accounts_used || 0} /{' '}
                  {currentPlan.limits.maxConnectedAccounts}
                </p>
                <Progress
                  value={Math.min(usageStats.usagePercentages.accounts, 100)}
                  className="h-2"
                />
              </CardContent>
            </Card>

            {/* Trading Bots */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Bots de Trading</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-bold">
                  {usageStats.currentUsage?.trading_bots_created || 0} /{' '}
                  {currentPlan.limits.maxTradingBots}
                </p>
                <Progress
                  value={Math.min(usageStats.usagePercentages.bots, 100)}
                  className="h-2"
                />
              </CardContent>
            </Card>

            {/* Backtests */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Backtests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-bold">
                  {usageStats.currentUsage?.backtests_run || 0} /{' '}
                  {currentPlan.limits.maxBacktests}
                </p>
                <Progress
                  value={Math.min(usageStats.usagePercentages.backtests, 100)}
                  className="h-2"
                />
              </CardContent>
            </Card>

            {/* API Calls */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Chamadas de API</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-bold">
                  {usageStats.currentUsage?.api_calls_made || 0} /{' '}
                  {currentPlan.limits.apiCallsPerDay}
                </p>
                <Progress
                  value={Math.min(usageStats.usagePercentages.apiCalls, 100)}
                  className="h-2"
                />
              </CardContent>
            </Card>

            {/* Storage */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Armazenamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-bold">
                  {Math.round((usageStats.currentUsage?.storage_used_mb || 0) / 1024)} /{' '}
                  {currentPlan.limits.storageGb} GB
                </p>
                <Progress
                  value={Math.min(usageStats.usagePercentages.storage, 100)}
                  className="h-2"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Plans Comparison */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Planos Disponíveis</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrentPlan = plan.name === currentPlan.name;
              const permissions_local = usePlanPermissions(plan, plans);

              return (
                <Card
                  key={plan.id}
                  className={`relative overflow-hidden transition-all ${
                    isCurrentPlan ? 'ring-2 ring-primary' : ''
                  } ${plan.isPopular ? 'md:scale-105' : ''}`}
                >
                  {plan.isPopular && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold rounded-bl">
                      POPULAR
                    </div>
                  )}

                  <CardHeader>
                    <CardTitle>{plan.displayName}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Price */}
                    <div>
                      <p className="text-3xl font-bold">
                        {plan.price === 0 ? 'Grátis' : `$${(plan.price / 100).toFixed(2)}`}
                      </p>
                      {plan.price > 0 && (
                        <p className="text-sm text-muted-foreground">
                          por {plan.billingCycle === 'monthly' ? 'mês' : 'ano'}
                        </p>
                      )}
                    </div>

                    {/* Features */}
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-muted-foreground">Limites</p>
                        <ul className="space-y-2">
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-500" />
                            <span>
                              {plan.limits.maxConnectedAccounts} conta(s) conectada(s)
                            </span>
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-500" />
                            <span>{plan.limits.maxTradingBots} bot(s) de trading</span>
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-500" />
                            <span>
                              {plan.limits.maxBacktests} backtest(s) / mês
                            </span>
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-500" />
                            <span>{plan.limits.apiCallsPerDay.toLocaleString()} API calls/dia</span>
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-500" />
                            <span>{plan.limits.storageGb} GB armazenamento</span>
                          </li>
                        </ul>
                      </div>

                      {plan.limits.customReportsAllowed && (
                        <div>
                          <Check className="w-4 h-4 text-green-500 inline mr-2" />
                          <span className="text-sm">Relatórios customizados</span>
                        </div>
                      )}

                      {plan.limits.whitelabelAllowed && (
                        <div>
                          <Check className="w-4 h-4 text-green-500 inline mr-2" />
                          <span className="text-sm">Whitelabel</span>
                        </div>
                      )}
                    </div>

                    {/* CTA Button */}
                    {isCurrentPlan ? (
                      <Button variant="outline" disabled className="w-full">
                        Plano Atual
                      </Button>
                    ) : plan.name === 'FREE' ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate('/')}
                      >
                        Voltar ao Dashboard
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleUpgrade(plan.name as 'PRO' | 'ENTERPRISE')}
                        disabled={upgrading}
                      >
                        {upgrading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processando...
                          </>
                        ) : (
                          <>
                            Fazer Upgrade
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* FAQ */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Perguntas Frequentes</h2>
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Posso cancelar a qualquer momento?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Sim, você pode cancelar sua assinatura a qualquer momento. Não há compromisso
                  de longo prazo.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  O que acontece com meus dados ao cancelar?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Seus dados são mantidos por 30 dias. Você pode reativar sua conta durante
                  este período.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Como faço upgrade ou downgrade?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Você pode alterar seu plano a qualquer momento. As alterações de preço serão
                  refletidas no seu próximo ciclo de faturamento.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Billing;
