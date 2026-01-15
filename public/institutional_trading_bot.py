#!/usr/bin/env python3
"""
==============================================================================
INSTITUTIONAL AI TRADING BOT - BYBIT INTEGRATION
==============================================================================
Bot de trading com IA focado em:
- Leitura de movimentos institucionais
- Maximização de lucro com risco controlado
- Operação 24/7 em Spot e Futures

Autor: AI Trading Systems
Versão: 1.0.0
==============================================================================
"""

import os
import sys
import json
import time
import hmac
import hashlib
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum
from collections import deque
import threading
from abc import ABC, abstractmethod

# Third-party imports (instalar via pip)
try:
    import requests
    import numpy as np
    import pandas as pd
    from websocket import WebSocketApp
except ImportError as e:
    print(f"Erro: Dependência não encontrada - {e}")
    print("\nInstale as dependências com:")
    print("pip install requests numpy pandas websocket-client")
    sys.exit(1)


# ==============================================================================
# CONFIGURAÇÃO E LOGGING
# ==============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-7s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('trading_bot.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


# ==============================================================================
# ENUMS E TIPOS
# ==============================================================================

class TradeSide(Enum):
    LONG = "Buy"
    SHORT = "Sell"

class TradeStatus(Enum):
    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"

class StrategyType(Enum):
    SCALP = "scalp"
    DAYTRADE = "daytrade"
    SWING = "swing"

class MarketMode(Enum):
    SPOT = "spot"
    FUTURES = "linear"

class BotStatus(Enum):
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"


# ==============================================================================
# CONFIGURAÇÃO DO BOT
# ==============================================================================

@dataclass
class BotConfig:
    """Configurações principais do bot."""
    
    # API Bybit
    api_key: str = ""
    api_secret: str = ""
    testnet: bool = True  # True = Paper Trade, False = Real
    
    # Mercado
    market_mode: MarketMode = MarketMode.FUTURES
    symbols: List[str] = field(default_factory=lambda: ["BTCUSDT", "ETHUSDT", "SOLUSDT"])
    
    # Alavancagem e Risco
    leverage: int = 5
    risk_per_trade: float = 2.0  # % do capital por trade
    max_drawdown: float = 10.0  # % máximo de drawdown
    max_concurrent_trades: int = 3
    
    # Take Profit / Stop Loss
    tp_ratio: float = 2.0  # Risk:Reward ratio
    partial_tp_percent: float = 50.0  # % do trade para TP parcial
    trailing_stop: bool = True
    
    # Timeframes
    tf_entry: str = "15"  # 15 minutos
    tf_trend: str = "240"  # 4 horas
    
    # Limites de segurança
    max_daily_trades: int = 20
    max_daily_loss: float = 5.0  # % do capital
    cooldown_after_loss: int = 300  # segundos após sequência de perdas
    consecutive_losses_pause: int = 3
    
    @classmethod
    def from_env(cls) -> 'BotConfig':
        """Carrega configuração de variáveis de ambiente."""
        return cls(
            api_key=os.getenv("BYBIT_API_KEY", ""),
            api_secret=os.getenv("BYBIT_API_SECRET", ""),
            testnet=os.getenv("BYBIT_TESTNET", "true").lower() == "true",
            leverage=int(os.getenv("BOT_LEVERAGE", "5")),
            risk_per_trade=float(os.getenv("BOT_RISK_PER_TRADE", "2.0")),
            max_drawdown=float(os.getenv("BOT_MAX_DRAWDOWN", "10.0")),
        )


# ==============================================================================
# CLIENTE BYBIT API
# ==============================================================================

class BybitClient:
    """Cliente para API Bybit v5."""
    
    MAINNET_URL = "https://api.bybit.com"
    TESTNET_URL = "https://api-testnet.bybit.com"
    
    def __init__(self, config: BotConfig):
        self.config = config
        self.base_url = self.TESTNET_URL if config.testnet else self.MAINNET_URL
        self.session = requests.Session()
        
    def _generate_signature(self, params: Dict[str, Any], timestamp: int) -> str:
        """Gera assinatura HMAC para autenticação."""
        param_str = str(timestamp) + self.config.api_key + "5000"
        if params:
            param_str += "&".join([f"{k}={v}" for k, v in sorted(params.items())])
        
        return hmac.new(
            self.config.api_secret.encode('utf-8'),
            param_str.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
    
    def _request(self, method: str, endpoint: str, params: Dict = None, signed: bool = False) -> Dict:
        """Faz requisição à API."""
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if signed:
            timestamp = int(time.time() * 1000)
            signature = self._generate_signature(params or {}, timestamp)
            headers.update({
                "X-BAPI-API-KEY": self.config.api_key,
                "X-BAPI-SIGN": signature,
                "X-BAPI-TIMESTAMP": str(timestamp),
                "X-BAPI-RECV-WINDOW": "5000"
            })
        
        try:
            if method == "GET":
                response = self.session.get(url, params=params, headers=headers, timeout=10)
            else:
                response = self.session.post(url, json=params, headers=headers, timeout=10)
            
            response.raise_for_status()
            data = response.json()
            
            if data.get("retCode") != 0:
                logger.error(f"API Error: {data.get('retMsg')}")
                return {}
            
            return data.get("result", {})
            
        except Exception as e:
            logger.error(f"Request error: {e}")
            return {}
    
    def get_ticker(self, symbol: str) -> Optional[Dict]:
        """Obtém ticker atual."""
        result = self._request("GET", "/v5/market/tickers", {
            "category": self.config.market_mode.value,
            "symbol": symbol
        })
        if result and result.get("list"):
            return result["list"][0]
        return None
    
    def get_klines(self, symbol: str, interval: str, limit: int = 200) -> pd.DataFrame:
        """Obtém candlesticks históricos."""
        result = self._request("GET", "/v5/market/kline", {
            "category": self.config.market_mode.value,
            "symbol": symbol,
            "interval": interval,
            "limit": limit
        })
        
        if not result or not result.get("list"):
            return pd.DataFrame()
        
        df = pd.DataFrame(result["list"], columns=[
            "timestamp", "open", "high", "low", "close", "volume", "turnover"
        ])
        
        df["timestamp"] = pd.to_datetime(df["timestamp"].astype(int), unit="ms")
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = df[col].astype(float)
        
        return df.iloc[::-1].reset_index(drop=True)
    
    def get_orderbook(self, symbol: str, limit: int = 50) -> Dict:
        """Obtém orderbook."""
        return self._request("GET", "/v5/market/orderbook", {
            "category": self.config.market_mode.value,
            "symbol": symbol,
            "limit": limit
        })
    
    def get_balance(self) -> float:
        """Obtém saldo disponível."""
        result = self._request("GET", "/v5/account/wallet-balance", {
            "accountType": "UNIFIED"
        }, signed=True)
        
        if result and result.get("list"):
            for coin in result["list"][0].get("coin", []):
                if coin["coin"] == "USDT":
                    return float(coin.get("availableToWithdraw", 0))
        return 0.0
    
    def place_order(
        self, 
        symbol: str, 
        side: TradeSide, 
        qty: float,
        price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None
    ) -> Optional[str]:
        """Coloca ordem no mercado."""
        params = {
            "category": self.config.market_mode.value,
            "symbol": symbol,
            "side": side.value,
            "orderType": "Market" if price is None else "Limit",
            "qty": str(qty),
            "timeInForce": "GTC"
        }
        
        if price:
            params["price"] = str(price)
        if stop_loss:
            params["stopLoss"] = str(stop_loss)
        if take_profit:
            params["takeProfit"] = str(take_profit)
        
        result = self._request("POST", "/v5/order/create", params, signed=True)
        
        if result:
            order_id = result.get("orderId")
            logger.info(f"Ordem criada: {order_id} | {side.value} {symbol} @ {qty}")
            return order_id
        return None
    
    def set_leverage(self, symbol: str, leverage: int) -> bool:
        """Define alavancagem para o símbolo."""
        result = self._request("POST", "/v5/position/set-leverage", {
            "category": self.config.market_mode.value,
            "symbol": symbol,
            "buyLeverage": str(leverage),
            "sellLeverage": str(leverage)
        }, signed=True)
        return bool(result)
    
    def get_positions(self) -> List[Dict]:
        """Obtém posições abertas."""
        result = self._request("GET", "/v5/position/list", {
            "category": self.config.market_mode.value,
            "settleCoin": "USDT"
        }, signed=True)
        
        if result and result.get("list"):
            return [p for p in result["list"] if float(p.get("size", 0)) > 0]
        return []
    
    def close_position(self, symbol: str, side: TradeSide) -> bool:
        """Fecha posição existente."""
        close_side = TradeSide.SHORT if side == TradeSide.LONG else TradeSide.LONG
        positions = self.get_positions()
        
        for pos in positions:
            if pos["symbol"] == symbol:
                qty = float(pos["size"])
                self.place_order(symbol, close_side, qty)
                return True
        return False


# ==============================================================================
# ANÁLISE TÉCNICA E INSTITUCIONAL
# ==============================================================================

class InstitutionalAnalyzer:
    """Analisador de movimentos institucionais."""
    
    def __init__(self):
        self.volume_ma_period = 20
        self.atr_period = 14
        
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calcula indicadores técnicos."""
        if df.empty or len(df) < 50:
            return df
        
        # EMAs
        df["ema_9"] = df["close"].ewm(span=9, adjust=False).mean()
        df["ema_21"] = df["close"].ewm(span=21, adjust=False).mean()
        df["ema_50"] = df["close"].ewm(span=50, adjust=False).mean()
        
        # ATR (Average True Range)
        high_low = df["high"] - df["low"]
        high_close = abs(df["high"] - df["close"].shift())
        low_close = abs(df["low"] - df["close"].shift())
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        df["atr"] = tr.rolling(window=self.atr_period).mean()
        
        # Volume Analysis
        df["volume_ma"] = df["volume"].rolling(window=self.volume_ma_period).mean()
        df["volume_ratio"] = df["volume"] / df["volume_ma"]
        
        # Delta Volume (proxy para fluxo institucional)
        df["delta"] = (df["close"] - df["open"]) * df["volume"]
        df["cumulative_delta"] = df["delta"].cumsum()
        
        # RSI
        delta = df["close"].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df["rsi"] = 100 - (100 / (1 + rs))
        
        # VWAP
        df["vwap"] = (df["volume"] * (df["high"] + df["low"] + df["close"]) / 3).cumsum() / df["volume"].cumsum()
        
        return df
    
    def detect_accumulation(self, df: pd.DataFrame) -> Tuple[bool, float]:
        """Detecta padrão de acumulação institucional."""
        if len(df) < 20:
            return False, 0.0
        
        recent = df.tail(10)
        
        # Critérios de acumulação:
        # 1. Volume crescente em candles de alta
        # 2. Preço em range estreito
        # 3. Delta cumulativo positivo
        
        price_range = (recent["high"].max() - recent["low"].min()) / recent["close"].mean()
        is_consolidating = price_range < 0.03  # Range < 3%
        
        bullish_volume = recent[recent["close"] > recent["open"]]["volume"].sum()
        bearish_volume = recent[recent["close"] < recent["open"]]["volume"].sum()
        volume_bias = bullish_volume / (bearish_volume + 1)
        
        delta_trend = recent["cumulative_delta"].iloc[-1] > recent["cumulative_delta"].iloc[0]
        
        confidence = 0.0
        if is_consolidating:
            confidence += 30
        if volume_bias > 1.2:
            confidence += 35
        if delta_trend:
            confidence += 35
        
        return confidence >= 70, confidence
    
    def detect_distribution(self, df: pd.DataFrame) -> Tuple[bool, float]:
        """Detecta padrão de distribuição institucional."""
        if len(df) < 20:
            return False, 0.0
        
        recent = df.tail(10)
        
        # Inverso da acumulação
        bearish_volume = recent[recent["close"] < recent["open"]]["volume"].sum()
        bullish_volume = recent[recent["close"] > recent["open"]]["volume"].sum()
        volume_bias = bearish_volume / (bullish_volume + 1)
        
        delta_trend = recent["cumulative_delta"].iloc[-1] < recent["cumulative_delta"].iloc[0]
        
        # Topos com volume alto seguidos de queda
        high_volume_tops = (recent["volume_ratio"] > 1.5) & (recent["close"] < recent["open"])
        
        confidence = 0.0
        if volume_bias > 1.2:
            confidence += 35
        if delta_trend:
            confidence += 35
        if high_volume_tops.sum() >= 2:
            confidence += 30
        
        return confidence >= 70, confidence
    
    def detect_volume_cluster(self, df: pd.DataFrame) -> List[float]:
        """Identifica níveis de preço com alto volume (suportes/resistências)."""
        if len(df) < 50:
            return []
        
        # Agrupa volume por faixas de preço
        price_range = df["close"].max() - df["close"].min()
        bin_size = price_range / 20
        
        df["price_bin"] = ((df["close"] - df["close"].min()) / bin_size).astype(int)
        volume_profile = df.groupby("price_bin")["volume"].sum()
        
        # Identifica os 3 maiores clusters
        top_bins = volume_profile.nlargest(3).index.tolist()
        
        cluster_prices = []
        for bin_idx in top_bins:
            price = df["close"].min() + (bin_idx + 0.5) * bin_size
            cluster_prices.append(price)
        
        return cluster_prices
    
    def detect_liquidity_grab(self, df: pd.DataFrame) -> Tuple[bool, str]:
        """Detecta falso rompimento (liquidity grab)."""
        if len(df) < 20:
            return False, ""
        
        recent = df.tail(5)
        prev = df.tail(20).head(15)
        
        prev_high = prev["high"].max()
        prev_low = prev["low"].min()
        
        # Rompimento de alta que fecha abaixo
        for i in range(len(recent)):
            candle = recent.iloc[i]
            if candle["high"] > prev_high and candle["close"] < prev_high:
                return True, "bearish_grab"
        
        # Rompimento de baixa que fecha acima
        for i in range(len(recent)):
            candle = recent.iloc[i]
            if candle["low"] < prev_low and candle["close"] > prev_low:
                return True, "bullish_grab"
        
        return False, ""
    
    def calculate_institutional_flow(self, df: pd.DataFrame) -> float:
        """Calcula fluxo institucional (-100 a +100)."""
        if len(df) < 20:
            return 0.0
        
        recent = df.tail(20)
        
        # Delta cumulativo normalizado
        delta_change = recent["cumulative_delta"].iloc[-1] - recent["cumulative_delta"].iloc[0]
        avg_volume = recent["volume"].mean()
        
        flow = (delta_change / (avg_volume * 20)) * 100
        return max(-100, min(100, flow))
    
    def get_trend_strength(self, df: pd.DataFrame) -> float:
        """Calcula força da tendência (0 a 100)."""
        if len(df) < 50:
            return 50.0
        
        close = df["close"].iloc[-1]
        ema_9 = df["ema_9"].iloc[-1]
        ema_21 = df["ema_21"].iloc[-1]
        ema_50 = df["ema_50"].iloc[-1]
        
        # Alinhamento das EMAs
        bullish_alignment = ema_9 > ema_21 > ema_50
        bearish_alignment = ema_9 < ema_21 < ema_50
        
        if bullish_alignment:
            strength = 70 + min(30, ((close - ema_50) / ema_50) * 1000)
        elif bearish_alignment:
            strength = 30 - min(30, ((ema_50 - close) / ema_50) * 1000)
        else:
            strength = 50
        
        return max(0, min(100, strength))


# ==============================================================================
# ESTRATÉGIAS DE TRADING
# ==============================================================================

class BaseStrategy(ABC):
    """Classe base para estratégias."""
    
    def __init__(self, name: str, weight: float = 1.0):
        self.name = name
        self.weight = weight
        self.wins = 0
        self.losses = 0
        
    @abstractmethod
    def analyze(self, df_entry: pd.DataFrame, df_trend: pd.DataFrame, analyzer: InstitutionalAnalyzer) -> Optional[Dict]:
        """Analisa e retorna sinal de trade."""
        pass
    
    @property
    def win_rate(self) -> float:
        total = self.wins + self.losses
        return (self.wins / total * 100) if total > 0 else 50.0
    
    def update_stats(self, won: bool):
        if won:
            self.wins += 1
        else:
            self.losses += 1


class ScalpStrategy(BaseStrategy):
    """Estratégia de scalp - alta frequência, risco controlado."""
    
    def __init__(self):
        super().__init__("SCALP", weight=1.0)
        
    def analyze(self, df_entry: pd.DataFrame, df_trend: pd.DataFrame, analyzer: InstitutionalAnalyzer) -> Optional[Dict]:
        if len(df_entry) < 50:
            return None
        
        close = df_entry["close"].iloc[-1]
        ema_9 = df_entry["ema_9"].iloc[-1]
        ema_21 = df_entry["ema_21"].iloc[-1]
        rsi = df_entry["rsi"].iloc[-1]
        volume_ratio = df_entry["volume_ratio"].iloc[-1]
        atr = df_entry["atr"].iloc[-1]
        
        # Condições para LONG scalp
        if (close > ema_9 > ema_21 and 
            30 < rsi < 70 and 
            volume_ratio > 1.2):
            
            return {
                "side": TradeSide.LONG,
                "strategy": StrategyType.SCALP,
                "entry": close,
                "stop_loss": close - (atr * 1.5),
                "take_profit": close + (atr * 2),
                "confidence": min(85, 50 + volume_ratio * 15 + (70 - abs(50 - rsi)) * 0.5),
                "reasoning": f"Scalp LONG: EMA alinhada, RSI {rsi:.1f}, Vol {volume_ratio:.2f}x"
            }
        
        # Condições para SHORT scalp
        if (close < ema_9 < ema_21 and 
            30 < rsi < 70 and 
            volume_ratio > 1.2):
            
            return {
                "side": TradeSide.SHORT,
                "strategy": StrategyType.SCALP,
                "entry": close,
                "stop_loss": close + (atr * 1.5),
                "take_profit": close - (atr * 2),
                "confidence": min(85, 50 + volume_ratio * 15 + (70 - abs(50 - rsi)) * 0.5),
                "reasoning": f"Scalp SHORT: EMA invertida, RSI {rsi:.1f}, Vol {volume_ratio:.2f}x"
            }
        
        return None


class DayTradeStrategy(BaseStrategy):
    """Estratégia de day trade - continuação e reversão."""
    
    def __init__(self):
        super().__init__("DAYTRADE", weight=1.2)
        
    def analyze(self, df_entry: pd.DataFrame, df_trend: pd.DataFrame, analyzer: InstitutionalAnalyzer) -> Optional[Dict]:
        if len(df_entry) < 50 or len(df_trend) < 20:
            return None
        
        # Dados do timeframe de entrada
        close = df_entry["close"].iloc[-1]
        atr = df_entry["atr"].iloc[-1]
        
        # Direção do timeframe maior
        trend_ema_50 = df_trend["ema_50"].iloc[-1] if "ema_50" in df_trend.columns else close
        trend_direction = "bullish" if close > trend_ema_50 else "bearish"
        
        # Análise institucional
        inst_flow = analyzer.calculate_institutional_flow(df_entry)
        is_accumulating, acc_conf = analyzer.detect_accumulation(df_entry)
        is_distributing, dist_conf = analyzer.detect_distribution(df_entry)
        
        # Volume clusters para suporte/resistência
        clusters = analyzer.detect_volume_cluster(df_entry)
        
        # Sinal de continuação bullish
        if trend_direction == "bullish" and is_accumulating and inst_flow > 20:
            # Encontra suporte mais próximo
            support = min([c for c in clusters if c < close], default=close - atr * 2)
            
            return {
                "side": TradeSide.LONG,
                "strategy": StrategyType.DAYTRADE,
                "entry": close,
                "stop_loss": support - (atr * 0.5),
                "take_profit": close + (atr * 4),
                "confidence": min(90, acc_conf + inst_flow * 0.3),
                "reasoning": f"DayTrade LONG: Acúmulo {acc_conf:.0f}%, Fluxo +{inst_flow:.0f}"
            }
        
        # Sinal de continuação bearish
        if trend_direction == "bearish" and is_distributing and inst_flow < -20:
            resistance = max([c for c in clusters if c > close], default=close + atr * 2)
            
            return {
                "side": TradeSide.SHORT,
                "strategy": StrategyType.DAYTRADE,
                "entry": close,
                "stop_loss": resistance + (atr * 0.5),
                "take_profit": close - (atr * 4),
                "confidence": min(90, dist_conf + abs(inst_flow) * 0.3),
                "reasoning": f"DayTrade SHORT: Distribuição {dist_conf:.0f}%, Fluxo {inst_flow:.0f}"
            }
        
        return None


class SwingStrategy(BaseStrategy):
    """Estratégia de swing trade - baseada em fluxo institucional."""
    
    def __init__(self):
        super().__init__("SWING", weight=1.5)
        
    def analyze(self, df_entry: pd.DataFrame, df_trend: pd.DataFrame, analyzer: InstitutionalAnalyzer) -> Optional[Dict]:
        if len(df_trend) < 50:
            return None
        
        close = df_trend["close"].iloc[-1]
        atr = df_trend["atr"].iloc[-1] if "atr" in df_trend.columns else close * 0.02
        
        # Detecta liquidity grab
        is_grab, grab_type = analyzer.detect_liquidity_grab(df_trend)
        
        # Força da tendência no timeframe maior
        trend_strength = analyzer.get_trend_strength(df_trend)
        inst_flow = analyzer.calculate_institutional_flow(df_trend)
        
        # Swing após liquidity grab bullish (falso rompimento de baixa)
        if is_grab and grab_type == "bullish_grab" and inst_flow > 0:
            return {
                "side": TradeSide.LONG,
                "strategy": StrategyType.SWING,
                "entry": close,
                "stop_loss": df_trend["low"].tail(10).min() - (atr * 0.5),
                "take_profit": close + (atr * 6),
                "confidence": min(95, 60 + abs(inst_flow) * 0.35),
                "reasoning": f"Swing LONG: Liquidity grab detectado, reversão esperada"
            }
        
        # Swing após liquidity grab bearish
        if is_grab and grab_type == "bearish_grab" and inst_flow < 0:
            return {
                "side": TradeSide.SHORT,
                "strategy": StrategyType.SWING,
                "entry": close,
                "stop_loss": df_trend["high"].tail(10).max() + (atr * 0.5),
                "take_profit": close - (atr * 6),
                "confidence": min(95, 60 + abs(inst_flow) * 0.35),
                "reasoning": f"Swing SHORT: Liquidity grab bearish, reversão esperada"
            }
        
        return None


# ==============================================================================
# GESTÃO DE RISCO
# ==============================================================================

@dataclass
class RiskManager:
    """Gerenciador de risco inviolável."""
    
    config: BotConfig
    initial_capital: float = 0.0
    current_capital: float = 0.0
    daily_pnl: float = 0.0
    daily_trades: int = 0
    consecutive_losses: int = 0
    last_loss_time: Optional[datetime] = None
    is_paused: bool = False
    pause_reason: str = ""
    
    def reset_daily(self):
        """Reset métricas diárias."""
        self.daily_pnl = 0.0
        self.daily_trades = 0
        logger.info("Métricas diárias resetadas")
    
    def can_trade(self) -> Tuple[bool, str]:
        """Verifica se pode abrir novos trades."""
        
        # Verifica se está pausado
        if self.is_paused:
            return False, self.pause_reason
        
        # Verifica drawdown máximo
        if self.initial_capital > 0:
            drawdown = ((self.initial_capital - self.current_capital) / self.initial_capital) * 100
            if drawdown >= self.config.max_drawdown:
                self.pause("Drawdown máximo atingido")
                return False, "Drawdown máximo atingido"
        
        # Verifica loss diário
        if self.initial_capital > 0:
            daily_loss_pct = (self.daily_pnl / self.initial_capital) * 100
            if daily_loss_pct <= -self.config.max_daily_loss:
                self.pause("Loss diário máximo atingido")
                return False, "Loss diário máximo atingido"
        
        # Verifica máximo de trades diários
        if self.daily_trades >= self.config.max_daily_trades:
            return False, "Limite de trades diários atingido"
        
        # Verifica cooldown após perdas consecutivas
        if self.consecutive_losses >= self.config.consecutive_losses_pause:
            if self.last_loss_time:
                elapsed = (datetime.now() - self.last_loss_time).total_seconds()
                if elapsed < self.config.cooldown_after_loss:
                    remaining = int(self.config.cooldown_after_loss - elapsed)
                    return False, f"Cooldown ativo: {remaining}s restantes"
                else:
                    self.consecutive_losses = 0
        
        return True, "OK"
    
    def calculate_position_size(self, entry: float, stop_loss: float) -> float:
        """Calcula tamanho da posição baseado no risco."""
        if self.current_capital <= 0:
            return 0.0
        
        risk_amount = self.current_capital * (self.config.risk_per_trade / 100)
        price_diff = abs(entry - stop_loss)
        
        if price_diff == 0:
            return 0.0
        
        position_size = risk_amount / price_diff
        
        # Aplica alavancagem
        position_size *= self.config.leverage
        
        # Limita ao capital disponível
        max_position = self.current_capital * self.config.leverage / entry
        
        return min(position_size, max_position)
    
    def register_trade_result(self, pnl: float):
        """Registra resultado de trade."""
        self.daily_pnl += pnl
        self.current_capital += pnl
        self.daily_trades += 1
        
        if pnl < 0:
            self.consecutive_losses += 1
            self.last_loss_time = datetime.now()
            logger.warning(f"Loss registrado: ${pnl:.2f} | Consecutivos: {self.consecutive_losses}")
        else:
            self.consecutive_losses = 0
            logger.info(f"Profit registrado: +${pnl:.2f}")
    
    def pause(self, reason: str):
        """Pausa o bot por motivo de risco."""
        self.is_paused = True
        self.pause_reason = reason
        logger.critical(f"BOT PAUSADO: {reason}")
    
    def resume(self):
        """Retoma operações."""
        self.is_paused = False
        self.pause_reason = ""
        logger.info("Bot retomado")


# ==============================================================================
# IA EVOLUTIVA
# ==============================================================================

class AIEngine:
    """Motor de IA evolutiva para otimização de estratégias."""
    
    def __init__(self):
        self.trade_history: List[Dict] = []
        self.strategy_weights: Dict[str, float] = {
            "SCALP": 1.0,
            "DAYTRADE": 1.2,
            "SWING": 1.5
        }
        self.volatility_factor: float = 1.0
        self.learning_rate: float = 0.1
        
    def record_trade(self, trade: Dict):
        """Registra trade para aprendizado."""
        self.trade_history.append(trade)
        
        # Mantém apenas últimos 1000 trades
        if len(self.trade_history) > 1000:
            self.trade_history = self.trade_history[-1000:]
    
    def update_weights(self):
        """Atualiza pesos das estratégias baseado em performance."""
        if len(self.trade_history) < 50:
            return
        
        recent = self.trade_history[-50:]
        
        for strategy_name in self.strategy_weights.keys():
            strategy_trades = [t for t in recent if t.get("strategy") == strategy_name]
            
            if len(strategy_trades) >= 5:
                wins = sum(1 for t in strategy_trades if t.get("pnl", 0) > 0)
                win_rate = wins / len(strategy_trades)
                
                # Ajusta peso baseado em win rate
                target_weight = 0.5 + win_rate  # 0.5 a 1.5
                current_weight = self.strategy_weights[strategy_name]
                
                # Aplica ajuste gradual
                new_weight = current_weight + (target_weight - current_weight) * self.learning_rate
                self.strategy_weights[strategy_name] = max(0.3, min(2.0, new_weight))
                
                logger.info(f"Peso {strategy_name} ajustado: {current_weight:.2f} -> {new_weight:.2f}")
    
    def adjust_for_volatility(self, atr_ratio: float):
        """Ajusta agressividade baseado em volatilidade."""
        # atr_ratio = ATR atual / ATR médio
        if atr_ratio > 1.5:
            # Alta volatilidade - reduz exposição
            self.volatility_factor = 0.7
        elif atr_ratio < 0.7:
            # Baixa volatilidade - pode aumentar exposição
            self.volatility_factor = 1.2
        else:
            self.volatility_factor = 1.0
    
    def get_strategy_weight(self, strategy: StrategyType) -> float:
        """Retorna peso ajustado da estratégia."""
        base_weight = self.strategy_weights.get(strategy.name, 1.0)
        return base_weight * self.volatility_factor
    
    def should_take_trade(self, signal: Dict) -> bool:
        """Decide se deve executar o trade baseado em confiança e pesos."""
        confidence = signal.get("confidence", 0)
        strategy = signal.get("strategy", StrategyType.SCALP)
        weight = self.get_strategy_weight(strategy)
        
        # Threshold dinâmico
        threshold = 65 / weight  # Menor threshold para estratégias de alto peso
        
        return confidence >= threshold


# ==============================================================================
# BOT PRINCIPAL
# ==============================================================================

class InstitutionalTradingBot:
    """Bot principal de trading institucional."""
    
    def __init__(self, config: BotConfig):
        self.config = config
        self.client = BybitClient(config)
        self.analyzer = InstitutionalAnalyzer()
        self.risk_manager = RiskManager(config=config)
        self.ai_engine = AIEngine()
        
        # Estratégias
        self.strategies = [
            ScalpStrategy(),
            DayTradeStrategy(),
            SwingStrategy()
        ]
        
        self.status = BotStatus.STOPPED
        self.running = False
        self._main_thread: Optional[threading.Thread] = None
        
    def initialize(self) -> bool:
        """Inicializa o bot."""
        logger.info("=" * 60)
        logger.info("INSTITUTIONAL AI TRADING BOT - INICIALIZANDO")
        logger.info("=" * 60)
        
        # Valida credenciais
        if not self.config.api_key or not self.config.api_secret:
            logger.error("API Key ou Secret não configurados!")
            logger.info("Configure as variáveis de ambiente:")
            logger.info("  export BYBIT_API_KEY='sua_api_key'")
            logger.info("  export BYBIT_API_SECRET='seu_api_secret'")
            return False
        
        # Obtém saldo
        balance = self.client.get_balance()
        if balance <= 0:
            logger.warning(f"Saldo não disponível ou zero. Modo: {'Testnet' if self.config.testnet else 'Mainnet'}")
        else:
            logger.info(f"Saldo disponível: ${balance:,.2f} USDT")
        
        self.risk_manager.initial_capital = balance
        self.risk_manager.current_capital = balance
        
        # Configura alavancagem
        for symbol in self.config.symbols:
            if self.client.set_leverage(symbol, self.config.leverage):
                logger.info(f"Alavancagem {symbol}: {self.config.leverage}x")
        
        logger.info(f"Modo: {'PAPER TRADE (Testnet)' if self.config.testnet else 'LIVE TRADING'}")
        logger.info(f"Símbolos: {', '.join(self.config.symbols)}")
        logger.info(f"Risco por trade: {self.config.risk_per_trade}%")
        logger.info(f"Drawdown máximo: {self.config.max_drawdown}%")
        
        return True
    
    def analyze_symbol(self, symbol: str) -> Optional[Dict]:
        """Analisa um símbolo e retorna melhor sinal."""
        # Obtém dados
        df_entry = self.client.get_klines(symbol, self.config.tf_entry, 200)
        df_trend = self.client.get_klines(symbol, self.config.tf_trend, 100)
        
        if df_entry.empty or df_trend.empty:
            return None
        
        # Calcula indicadores
        df_entry = self.analyzer.calculate_indicators(df_entry)
        df_trend = self.analyzer.calculate_indicators(df_trend)
        
        # Coleta sinais de todas estratégias
        signals = []
        for strategy in self.strategies:
            signal = strategy.analyze(df_entry, df_trend, self.analyzer)
            if signal:
                signal["symbol"] = symbol
                signal["weight"] = self.ai_engine.get_strategy_weight(signal["strategy"])
                signals.append(signal)
        
        if not signals:
            return None
        
        # Ordena por confiança ponderada pelo peso da estratégia
        signals.sort(key=lambda x: x["confidence"] * x["weight"], reverse=True)
        
        best_signal = signals[0]
        
        # IA decide se deve executar
        if self.ai_engine.should_take_trade(best_signal):
            return best_signal
        
        return None
    
    def execute_trade(self, signal: Dict) -> bool:
        """Executa um trade baseado no sinal."""
        symbol = signal["symbol"]
        side = signal["side"]
        entry = signal["entry"]
        stop_loss = signal["stop_loss"]
        take_profit = signal["take_profit"]
        strategy = signal["strategy"]
        
        # Calcula tamanho da posição
        position_size = self.risk_manager.calculate_position_size(entry, stop_loss)
        
        if position_size <= 0:
            logger.warning(f"Tamanho de posição inválido para {symbol}")
            return False
        
        # Ajusta precisão (Bybit requer precisão específica)
        if "BTC" in symbol:
            position_size = round(position_size, 3)
        elif "ETH" in symbol:
            position_size = round(position_size, 2)
        else:
            position_size = round(position_size, 1)
        
        logger.info("-" * 40)
        logger.info(f"EXECUTANDO TRADE: {symbol}")
        logger.info(f"  Lado: {side.name}")
        logger.info(f"  Estratégia: {strategy.name}")
        logger.info(f"  Entrada: ${entry:,.2f}")
        logger.info(f"  Stop Loss: ${stop_loss:,.2f}")
        logger.info(f"  Take Profit: ${take_profit:,.2f}")
        logger.info(f"  Tamanho: {position_size}")
        logger.info(f"  Razão: {signal['reasoning']}")
        logger.info(f"  Confiança: {signal['confidence']:.1f}%")
        logger.info("-" * 40)
        
        # Executa ordem
        order_id = self.client.place_order(
            symbol=symbol,
            side=side,
            qty=position_size,
            stop_loss=stop_loss,
            take_profit=take_profit
        )
        
        if order_id:
            # Registra para IA
            self.ai_engine.record_trade({
                "symbol": symbol,
                "side": side.name,
                "strategy": strategy.name,
                "entry": entry,
                "stop_loss": stop_loss,
                "take_profit": take_profit,
                "size": position_size,
                "confidence": signal["confidence"],
                "timestamp": datetime.now().isoformat()
            })
            return True
        
        return False
    
    def run_cycle(self):
        """Executa um ciclo de análise."""
        # Verifica se pode operar
        can_trade, reason = self.risk_manager.can_trade()
        if not can_trade:
            logger.debug(f"Não pode operar: {reason}")
            return
        
        # Verifica posições abertas
        positions = self.client.get_positions()
        if len(positions) >= self.config.max_concurrent_trades:
            logger.debug(f"Máximo de posições atingido: {len(positions)}")
            return
        
        # Analisa cada símbolo
        for symbol in self.config.symbols:
            # Pula se já tem posição no símbolo
            if any(p["symbol"] == symbol for p in positions):
                continue
            
            signal = self.analyze_symbol(symbol)
            
            if signal:
                logger.info(f"Sinal detectado em {symbol}: {signal['side'].name} ({signal['strategy'].name})")
                
                if self.execute_trade(signal):
                    break  # Um trade por ciclo
        
        # Atualiza pesos da IA periodicamente
        if len(self.ai_engine.trade_history) % 10 == 0:
            self.ai_engine.update_weights()
    
    def start(self):
        """Inicia o bot."""
        if not self.initialize():
            return
        
        self.running = True
        self.status = BotStatus.RUNNING
        
        logger.info("\n" + "=" * 60)
        logger.info("BOT INICIADO - Monitorando mercado...")
        logger.info("=" * 60 + "\n")
        
        cycle_interval = 60  # segundos entre ciclos
        last_daily_reset = datetime.now().date()
        
        while self.running:
            try:
                # Reset diário
                if datetime.now().date() != last_daily_reset:
                    self.risk_manager.reset_daily()
                    last_daily_reset = datetime.now().date()
                
                # Executa ciclo
                if self.status == BotStatus.RUNNING:
                    self.run_cycle()
                
                time.sleep(cycle_interval)
                
            except KeyboardInterrupt:
                logger.info("\nInterrupção solicitada...")
                break
            except Exception as e:
                logger.error(f"Erro no ciclo: {e}")
                time.sleep(10)
        
        self.stop()
    
    def stop(self):
        """Para o bot."""
        self.running = False
        self.status = BotStatus.STOPPED
        logger.info("Bot parado com sucesso")
    
    def pause(self):
        """Pausa o bot."""
        self.status = BotStatus.PAUSED
        logger.info("Bot pausado")
    
    def resume(self):
        """Retoma o bot."""
        self.status = BotStatus.RUNNING
        self.risk_manager.resume()
        logger.info("Bot retomado")


# ==============================================================================
# PONTO DE ENTRADA
# ==============================================================================

def main():
    """Função principal."""
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║         INSTITUTIONAL AI TRADING BOT - BYBIT                 ║
    ║                                                              ║
    ║  • Leitura de movimentos institucionais                     ║
    ║  • Estratégias: Scalp, DayTrade, Swing                      ║
    ║  • Gestão de risco inviolável                               ║
    ║  • IA evolutiva                                             ║
    ╚══════════════════════════════════════════════════════════════╝
    """)
    
    # Carrega configuração
    config = BotConfig.from_env()
    
    # Cria e inicia bot
    bot = InstitutionalTradingBot(config)
    
    try:
        bot.start()
    except Exception as e:
        logger.critical(f"Erro fatal: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
