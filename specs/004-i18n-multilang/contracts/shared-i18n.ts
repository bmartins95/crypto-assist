/**
 * Contracts for shared/src/i18n/
 *
 * These types define the public API of the i18n shared module.
 * Implementations must satisfy these shapes exactly.
 */

export type Locale =
  | 'pt-BR'
  | 'en-US'
  | 'es-ES'
  | 'fr-FR'
  | 'de-DE'
  | 'zh-CN'
  | 'ja-JP'
  | 'ar-SA'
  | 'hi-IN'
  | 'ru-RU';

export interface UIText {
  tabs_wallet: string;
  tabs_profit: string;
  tabs_history: string;
  chart_byAsset: string;
  chart_overTime: string;
  chart_value: string;
  wallet_emptyState: string;
  wallet_groupBy_asset: string;
  wallet_groupBy_platform: string;
  wallet_groupBy_both: string;
  wallet_col_asset: string;
  wallet_col_platform: string;
  wallet_col_qty: string;
  wallet_col_avgPrice: string;
  wallet_col_currentPrice: string;
  wallet_col_value: string;
  wallet_col_pnl: string;
  wallet_col_pnlPct: string;
  wallet_col_exitPrice: string;
  profit_emptyState: string;
  profit_invested: string;
  profit_currentValue: string;
  profit_pnl: string;
  profit_realized: string;
  history_emptyState: string;
  history_col_date: string;
  history_col_asset: string;
  history_col_type: string;
  history_col_qty: string;
  history_col_price: string;
  history_col_fee: string;
  history_col_total: string;
  history_col_platform: string;
  history_opType_buy: string;
  history_opType_sell: string;
  history_form_addOp: string;
  history_form_editOp: string;
  history_form_date: string;
  history_form_asset: string;
  history_form_type: string;
  history_form_qty: string;
  history_form_price: string;
  history_form_fee: string;
  history_form_total: string;
  history_form_platform: string;
  history_form_save: string;
  history_form_cancel: string;
  history_form_delete: string;
  history_form_trade: string;
  trade_form_title: string;
  trade_form_from: string;
  trade_form_to: string;
  trade_form_qty: string;
  trade_form_price: string;
  trade_form_fee: string;
  trade_form_save: string;
  trade_form_cancel: string;
  settings_title: string;
  settings_language: string;
  nav_settings: string;
  nav_logout: string;
  auth_authenticating: string;
  auth_failed: string;
  common_loading: string;
  common_empty: string;
  common_error: string;
  common_save: string;
  common_cancel: string;
  common_delete: string;
}

/** Runtime registry: one UIText object per supported locale */
export type LocaleRegistry = Record<Locale, UIText>;

/** Returns the UIText for the requested locale, falling back to pt-BR */
export type GetLocale = (code: Locale) => UIText;

/** Updated fmt() signature — locale and currency are optional for backwards compat */
export type Fmt = (v: number, locale?: Locale, currency?: string) => string;
