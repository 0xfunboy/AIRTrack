export const TRADES_REFRESH_EVENT = 'airtrack:refresh-trades';

export function emitTradesRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(TRADES_REFRESH_EVENT));
  }
}
