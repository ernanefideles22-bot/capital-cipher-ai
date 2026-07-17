import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const read = (path: string) => readFileSync(resolve(repositoryRoot, path), 'utf8');

describe('legacy live-trading freeze', () => {
  it('keeps every legacy Edge Function as a secret-free tombstone', () => {
    const frozenFunctions = [
      'bybit-api',
      'elevenlabs-tts',
      'market-analysis',
      'multi-pair-analysis',
      'neural-training',
      'trading-ai',
    ];
    for (const functionName of frozenFunctions) {
      const source = read(`supabase/functions/${functionName}/index.ts`);
      expect(source).toMatch(/LEGACY_(?:FUNCTION|EXCHANGE_ACCESS|TRADING)_FROZEN/);
      expect(source).not.toMatch(
        /SUPABASE_SERVICE_ROLE_KEY|BYBIT_API|LOVABLE_API_KEY|ELEVENLABS_API_KEY|createClient|fetch\(/,
      );
    }

    const bybitFunction = read('supabase/functions/bybit-api/index.ts');
    const tradingAiFunction = read('supabase/functions/trading-ai/index.ts');

    expect(bybitFunction).toContain('LEGACY_EXCHANGE_ACCESS_FROZEN');
    expect(tradingAiFunction).toContain('LEGACY_TRADING_FROZEN');
    expect(bybitFunction).not.toMatch(/api(-testnet)?\.bybit\.com|\/v5\/order\//);
    expect(tradingAiFunction).not.toMatch(/api(-testnet)?\.bybit\.com|\/v5\/order\//);
  });

  it('keeps frontend execution paths disconnected', () => {
    const exchangeHook = read('src/hooks/useBybitAPI.ts');
    const tradingAiHook = read('src/hooks/useTradingAI.ts');
    const autonomousBot = read('src/hooks/useAutonomousBot.ts');
    const accountHook = read('src/hooks/useBybitAccount.ts');
    const configHook = read('src/hooks/useBotConfig.ts');
    const configPanel = read('src/components/trading/ConfigPanel.tsx');
    const tradingTypes = read('src/types/trading.ts');

    expect(exchangeHook).not.toMatch(/supabase\.functions\.invoke|VITE_ENABLE_REAL_TRADING/);
    expect(tradingAiHook).not.toMatch(/supabase\.functions\.invoke|trading-ai/);
    expect(autonomousBot).not.toMatch(/\.placeOrder\(|\.setLeverage\(/);
    expect(autonomousBot).not.toContain('sendRealOrders');
    expect(accountHook).toContain('isRealMode: false');
    expect(configHook).not.toMatch(/['"]live['"]/);
    expect(configPanel).not.toMatch(/Modo Real|['"]live['"]/);
    expect(tradingTypes).toContain("mode: 'paper'");
    expect(tradingTypes).not.toMatch(/['"]live['"]/);
  });

  it('requires JWT, hardened RLS, and excludes the public mainnet bot', () => {
    const config = read('supabase/config.toml');
    const jwtSettings = config.match(/verify_jwt\s*=\s*(true|false)/g) ?? [];
    const rlsMigration = read('supabase/migrations/20260717000000_harden_legacy_rls.sql');

    expect(jwtSettings).toHaveLength(6);
    expect(jwtSettings.every((setting) => setting.endsWith('true'))).toBe(true);
    expect(rlsMigration).toContain('profiles_bot_config_paper_only');
    expect(rlsMigration).toContain('DROP POLICY IF EXISTS "Users can delete their own trades"');
    expect(rlsMigration.match(/FORCE ROW LEVEL SECURITY/g)).toHaveLength(7);
    expect(rlsMigration.match(/WITH CHECK \(\(SELECT auth\.uid\(\)\) = user_id\)/g)).toHaveLength(5);
    expect(existsSync(resolve(repositoryRoot, 'public/institutional_trading_bot.py'))).toBe(false);
  });
});
