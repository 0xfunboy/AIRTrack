/// <reference types="vite/client" />

/**
 * Tipi per le variabili ambiente lato client.
 * Le rendiamo TUTTE opzionali per evitare errori di typing se non settate.
 * NB: Solo le chiavi prefissate con VITE_ saranno esposte al client da Vite.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;

  readonly VITE_API_ENDPOINT_URL?: string;
  readonly VITE_X_SCREEN_NAME?: string;
  readonly VITE_X_AUTH_TOKEN?: string;
  readonly VITE_X_CT0?: string;
  readonly VITE_X_GUEST_ID?: string;
  readonly VITE_X_POLL_MS?: string;
  readonly VITE_USE_PUPPETEER?: string;
  readonly VITE_X_COOKIES_PATH?: string;
  readonly VITE_ENTRY_TOL_PCT?: string;

  readonly VITE_COINGECKO_API_KEY?: string;
  readonly VITE_DEXTOOLS_API_KEY?: string;
  readonly VITE_CRYPTOCOMPARE_API_KEY?: string;
  readonly VITE_COINMARKETCAP_API_KEYS?: string;
  readonly VITE_CODEX_API_KEY?: string;

  readonly VITE_PORT?: string;
  readonly VITE_WS_PORT?: string;
  readonly VITE_LOG_LEVEL?: string;
  readonly VITE_PRICE_MISMATCH_PCT?: string;
  readonly VITE_QUOTE_PREF?: string;
  readonly VITE_API_SECRET_TOKEN?: string;
  readonly VITE_DEFAULT_TIMEFRAME?: string;
  readonly VITE_MAX_PRICE_AGE_MS?: string;
  readonly VITE_LOG_LEVEL_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
