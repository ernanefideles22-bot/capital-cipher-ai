import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const read = (path: string) => readFileSync(resolve(repositoryRoot, path), 'utf8');

describe('legacy live-trading freeze', () => {
  it('keeps exchange and AI Edge Functions as tombstones', () => {
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

    expect(exchangeHook).not.toMatch(/supabase\.functions\.invoke|VITE_ENABLE_REAL_TRADING/);
    expect(tradingAiHook).not.toMatch(/supabase\.functions\.invoke|trading-ai/);
    expect(autonomousBot).not.toMatch(/\.placeOrder\(|\.setLeverage\(/);
    expect(accountHook).toContain('isRealMode: false');
  });

  it('requires JWT verification and excludes the public mainnet bot', () => {
    const config = read('supabase/config.toml');
    const jwtSettings = config.match(/verify_jwt\s*=\s*(true|false)/g) ?? [];

    expect(jwtSettings.length).toBeGreaterThan(0);
    expect(jwtSettings.every((setting) => setting.endsWith('true'))).toBe(true);
    expect(existsSync(resolve(repositoryRoot, 'public/institutional_trading_bot.py'))).toBe(false);
  });
});
