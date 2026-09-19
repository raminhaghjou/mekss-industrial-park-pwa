-- Live crypto quotes (Tether / Bitcoin / Ethereum) from TGJU + exchange sources
ALTER TYPE "MarketRateKey" ADD VALUE IF NOT EXISTS 'USDT';
ALTER TYPE "MarketRateKey" ADD VALUE IF NOT EXISTS 'BTC';
ALTER TYPE "MarketRateKey" ADD VALUE IF NOT EXISTS 'ETH';
