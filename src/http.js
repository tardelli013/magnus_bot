const logger = require('./logger');

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, opts = {}) {
  const timeoutMs = Number(process.env.HTTP_TIMEOUT_MS || 15000);
  const maxAttempts = 3;
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      logger.debug(`fetch attempt ${attempt}/${maxAttempts}: ${url}`);
      const res = await fetch(url, {
        ...opts,
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          ...(opts.headers || {}),
        },
      });
      clearTimeout(timer);

      if (res.status >= 400 && res.status < 500) {
        throw new Error(`HTTP ${res.status} (não-retryable): ${url}`);
      }
      if (res.status >= 500) {
        throw new Error(`HTTP ${res.status}: ${url}`);
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${url}`);
      }
      return await res.text();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const retryable = !/4\d\d \(não-retryable\)/.test(err.message);
      if (!retryable || attempt === maxAttempts) {
        throw err;
      }
      const backoff = 1000 * 2 ** (attempt - 1);
      logger.warn(`fetch falhou (${err.message}), retry em ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

module.exports = { fetchWithRetry };
