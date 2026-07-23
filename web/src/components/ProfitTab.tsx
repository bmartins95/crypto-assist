'use client';

import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import type { Locale, UIText } from '@crypto-assist/shared';
import { ChartType, Op, OpClosure, Prices } from '@/lib/types';
import { fmtPct, fmtDate } from '@/lib/format';
import { computeTimeline, computeProfitByAsset, computeAssetPeriodSeries, TimelinePoint } from '@/lib/portfolio';
import { api } from '@/lib/api/client';
import { useLocale } from '@/context/LocaleContext';
import { useBalance } from '@/context/BalanceContext';
import { useCurrency } from '@/context/CurrencyContext';
import { assetColor } from '@/lib/assetColor';
import ContentHeader from '@/components/ContentHeader';
import MetricCard from '@/components/MetricCard';
import TimeframeSelector, { Timeframe } from '@/components/TimeframeSelector';
import AssetCompareControl, { CompareAssetOption } from '@/components/AssetCompareControl';
import AssetsOverTimeList, { AssetListItem } from '@/components/AssetsOverTimeList';
import AssetDetailChart, { AssetDetailData } from '@/components/AssetDetailChart';

const TIMEFRAME_STORAGE_KEY = 'profit_timeframe';
const VALID_TIMEFRAMES: Timeframe[] = ['1d', '1w', '1m', '1y', 'all'];
const TIMEFRAME_DAYS_BACK: Record<Exclude<Timeframe, 'all'>, number> = { '1d': 1, '1w': 7, '1m': 30, '1y': 365 };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function earliestOpDate(ops: Op[]): string {
  return ops.reduce((min, o) => (o.date && o.date < min ? o.date : min), ops[0]?.date ?? todayISO());
}

function readStoredTimeframe(): Timeframe {
  const stored = localStorage.getItem(TIMEFRAME_STORAGE_KEY);
  return (VALID_TIMEFRAMES as string[]).includes(stored ?? '') ? (stored as Timeframe) : '1m';
}

function rangeForTimeframe(timeframe: Timeframe, ops: Op[]): { from: string; to: string } {
  const to = todayISO();
  if (timeframe === 'all') return { from: earliestOpDate(ops), to };
  return { from: addDaysISO(to, -TIMEFRAME_DAYS_BACK[timeframe]), to };
}

const COMPARE_STORAGE_PREFIX = 'profit_compare_asset_';
type CompareChart = 'over-time' | 'value';

function readStoredCompare(chart: CompareChart): string | null {
  return localStorage.getItem(COMPARE_STORAGE_PREFIX + chart) || null;
}

function signed(v: number, formatted: string): string {
  return (v >= 0 ? '+' : '') + formatted;
}

function buildProfitTooltipHtml(point: TimelinePoint, locale: Locale, t: UIText, fmtMoney: (v: number) => string): string {
  const weekday = new Date(`${point.date}T00:00:00`).toLocaleDateString(locale, { weekday: 'short' });
  return `
    <div class="tt-header"><span class="tt-date">${fmtDate(point.date, locale)}</span><span class="tt-weekday">${weekday}</span></div>
    <div class="tt-cumulative ${point.pnl >= 0 ? 'pos' : 'neg'}">${signed(point.pnl, fmtMoney(point.pnl))}</div>
    <div class="tt-delta ${point.dayDeltaAbs >= 0 ? 'pos' : 'neg'}">${signed(point.dayDeltaAbs, fmtMoney(point.dayDeltaAbs))} ${t.profit_tooltip_noDia} · ${fmtPct(point.dayDeltaPct)}</div>
    <div class="tt-divider"></div>
    <div class="tt-row"><span>${t.profit_tooltip_realized}</span><span>${fmtMoney(point.realizedPnl)}</span></div>
    <div class="tt-row"><span>${t.profit_unrealized}</span><span class="${point.unrealizedPnl >= 0 ? 'pos' : 'neg'}">${signed(point.unrealizedPnl, fmtMoney(point.unrealizedPnl))}</span></div>
    <div class="tt-row"><span>${t.profit_tooltip_opsCount}</span><span>${point.opsCount}</span></div>
  `;
}

function buildValueTooltipHtml(point: TimelinePoint, prevPoint: TimelinePoint | undefined, locale: Locale, t: UIText, fmtMoney: (v: number) => string): string {
  const unrealizedAbs = point.unrealizedPnl;
  const unrealizedPct = point.invested > 0 ? (unrealizedAbs / point.invested) * 100 : 0;
  const dayVariationAbs = prevPoint ? point.currentValue - prevPoint.currentValue : 0;
  return `
    <div class="tt-header"><span class="tt-date">${fmtDate(point.date, locale)}</span></div>
    <div class="tt-row"><span class="tt-swatch tt-swatch-current"></span><span>${t.profit_currentValue}</span><span class="tt-value">${fmtMoney(point.currentValue)}</span></div>
    <div class="tt-row"><span class="tt-swatch tt-swatch-invested"></span><span>${t.profit_invested}</span><span class="tt-value tt-muted">${fmtMoney(point.invested)}</span></div>
    <div class="tt-result ${unrealizedAbs >= 0 ? 'pos' : 'neg'}">
      <div class="tt-result-row"><span>${t.profit_tooltip_unrealizedResult}</span><span>${fmtPct(unrealizedPct)}</span></div>
      <div class="tt-result-abs">${signed(unrealizedAbs, fmtMoney(unrealizedAbs))}</div>
    </div>
    <div class="tt-row tt-dayvar"><span>${t.profit_tooltip_dayVariation}</span><span class="${dayVariationAbs >= 0 ? 'pos' : 'neg'}">${signed(dayVariationAbs, fmtMoney(dayVariationAbs))}</span></div>
  `;
}

interface TooltipExternalContext {
  chart: { canvas: HTMLCanvasElement };
  tooltip: { opacity: number; dataPoints?: { dataIndex: number }[]; caretX: number; caretY: number };
}

interface Props {
  ops: Op[];
  closures: OpClosure[];
  prices: Prices;
  activeChart: ChartType;
  onChartSwitch: (t: ChartType) => void;
  statusMsg: string;
  onFetchPrices: () => void;
}

export default function ProfitTab({ ops, closures, prices, activeChart, onChartSwitch, statusMsg, onFetchPrices }: Props) {
  const { locale, t } = useLocale();
  const { hidden } = useBalance();
  const { currency, ratesStatus, fmtMoney } = useCurrency();
  const mask = (v: string): string => (hidden ? '••••••' : v);
  const ratesMsg = ratesStatus === 'unavailable' ? t.currency_rates_unavailable
    : ratesStatus === 'stale' ? t.currency_rates_stale : '';
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const [historicalPrices, setHistoricalPrices] = useState<Record<string, Record<string, number>>>({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [timeframe, setTimeframeState] = useState<Timeframe>(() => readStoredTimeframe());
  const [compareAsset, setCompareAssetState] = useState<Record<CompareChart, string | null>>(() => ({
    'over-time': readStoredCompare('over-time'),
    value: readStoredCompare('value'),
  }));
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [detailAsset, setDetailAsset] = useState<string | null>(null);
  const overTimeTooltipRef = useRef<HTMLDivElement>(null);
  const valueTooltipRef = useRef<HTMLDivElement>(null);
  const isTimeBased = activeChart === 'over-time' || activeChart === 'value';
  const { from: rangeFrom, to: rangeTo } = rangeForTimeframe(timeframe, ops);
  const coinIds = Array.from(new Set(ops.map(o => o.coinId).filter(Boolean)));

  function setTimeframe(next: Timeframe): void {
    localStorage.setItem(TIMEFRAME_STORAGE_KEY, next);
    setTimeframeState(next);
  }

  function setCompareAsset(chart: CompareChart, coinId: string | null): void {
    if (coinId) localStorage.setItem(COMPARE_STORAGE_PREFIX + chart, coinId);
    else localStorage.removeItem(COMPARE_STORAGE_PREFIX + chart);
    setCompareAssetState(prev => ({ ...prev, [chart]: coinId }));
  }

  useEffect(() => {
    if (!isTimeBased || !coinIds.length) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError('');
    api.getPriceHistory(coinIds, rangeFrom, rangeTo)
      .then(data => { if (!cancelled) setHistoricalPrices(data); })
      .catch(() => { if (!cancelled) { setHistoricalPrices({}); setHistoryError(t.common_error); } })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [isTimeBased, coinIds.join(','), rangeFrom, rangeTo, t]);

  const timeline = isTimeBased ? computeTimeline(ops, historicalPrices, rangeFrom, rangeTo, closures) : [];
  const timeframeEmpty = isTimeBased && timeline.length < 2;

  const profitByAsset = computeProfitByAsset(ops, prices, closures);
  const totalRealized = profitByAsset.reduce((s, p) => s + p.realizedPnl, 0);
  const withPrice = profitByAsset.filter(p => p.hasPrice);
  const totalUnrealized = withPrice.reduce((s, p) => s + p.unrealizedPnl, 0);
  const openWithPrice = profitByAsset.filter(p => p.hasOpenPosition && p.hasPrice);
  const best = openWithPrice.length ? openWithPrice.reduce((a, b) => (b.unrealizedPct > a.unrealizedPct ? b : a)) : null;
  const worst = openWithPrice.length ? openWithPrice.reduce((a, b) => (b.unrealizedPct < a.unrealizedPct ? b : a)) : null;
  const openPositions = profitByAsset.filter(p => p.hasOpenPosition);
  const totalInvestedOpen = openPositions.reduce((s, p) => s + p.investedOpen, 0);
  const noPriceData = !profitByAsset.some(p => p.hasPrice);

  const heldCoinIds = openPositions.map(p => p.coinId);
  const assetSeries = computeAssetPeriodSeries(ops, historicalPrices, prices, rangeFrom, rangeTo, closures);
  const assetSeriesById = new Map(assetSeries.map(a => [a.coinId, a]));
  const compareOptions: CompareAssetOption[] = openPositions.map(p => ({
    coinId: p.coinId, symbol: p.symbol, color: assetColor(p.coinId, heldCoinIds),
  }));
  const listItems: AssetListItem[] = openPositions.map(p => {
    const s = assetSeriesById.get(p.coinId);
    return {
      coinId: p.coinId, symbol: p.symbol, name: p.name,
      price: s?.price ?? 0, pctChange: s?.pctChange ?? 0, series: s?.series ?? [],
      color: assetColor(p.coinId, heldCoinIds),
      allocationPct: totalInvestedOpen > 0 ? (p.investedOpen / totalInvestedOpen) * 100 : 0,
    };
  });
  const compareChart: CompareChart | null = activeChart === 'over-time' || activeChart === 'value' ? activeChart : null;
  const activeCompareCoinId = compareChart ? compareAsset[compareChart] : null;
  // A persisted coinId for a position that's since been fully closed is left in storage (it may
  // reappear if the user re-opens that position) but must not render as "selected" against a
  // control that no longer lists it as an option.
  const effectiveCompareValue = activeCompareCoinId && assetSeriesById.has(activeCompareCoinId) ? activeCompareCoinId : null;
  const activeCompareSeries = effectiveCompareValue ? assetSeriesById.get(effectiveCompareValue) : undefined;
  const hasCompareOverlay = !!(activeCompareSeries && activeCompareSeries.series.length === timeline.length && timeline.length > 0);
  const hoveredPoint = hoveredDate ? timeline.find(tp => tp.date === hoveredDate) : undefined;
  const dayContribution: Record<string, string> | undefined = hoveredPoint
    ? Object.fromEntries(hoveredPoint.assetContribution.map(c => [c.coinId, signed(c.deltaAbs, fmtMoney(c.deltaAbs))]))
    : undefined;
  const detailAssetData: AssetDetailData | null = detailAsset ? (() => {
    const s = assetSeriesById.get(detailAsset);
    const p = openPositions.find(a => a.coinId === detailAsset);
    if (!s || !p) return null;
    return { coinId: p.coinId, symbol: p.symbol, name: p.name, price: s.price, pctChange: s.pctChange, series: s.series, color: assetColor(p.coinId, heldCoinIds) };
  })() : null;

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    if (activeChart === 'by-asset' && profitByAsset.length) {
      chartInstance.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: profitByAsset.map(p => p.symbol),
          datasets: [{
            label: t.profit_pnl,
            data: profitByAsset.map(p => parseFloat((p.realizedPnl + p.unrealizedPnl).toFixed(2))),
            backgroundColor: profitByAsset.map(p => (p.realizedPnl + p.unrealizedPnl >= 0 ? '#1D9E75' : '#E24B4A')),
            borderRadius: 6, borderSkipped: false,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtMoney(c.raw as number) }, padding: 10 } },
          scales: {
            y: { ticks: { callback: v => fmtMoney(v as number), font: { size: 11 } }, grid: { color: 'rgba(128,128,128,0.08)' }, border: { display: false } },
            x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 12 } } },
          },
        },
      });
    } else if (activeChart === 'over-time' && !timeframeEmpty && !noPriceData) {
      const overlay = hasCompareOverlay && activeCompareSeries ? activeCompareSeries : null;
      const overlayColor = overlay ? assetColor(overlay.coinId, heldCoinIds) : '';
      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: timeline.map(tp => fmtDate(tp.date, locale)),
          datasets: [
            { label: t.profit_pnl, data: timeline.map(tp => parseFloat(tp.pnl.toFixed(2))), borderColor: '#534AB7', backgroundColor: 'rgba(83,74,183,0.1)', fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6 },
            ...(overlay ? [{ label: `${overlay.symbol} ${t.profit_comparePeriodSuffix}`, data: overlay.series, borderColor: overlayColor, borderDash: [5, 4], yAxisID: 'y1', fill: false, tension: 0.3, pointRadius: 0, pointHoverRadius: 4 }] : []),
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: !!overlay },
            tooltip: {
              enabled: false,
              external: (context: TooltipExternalContext) => {
                const el = overTimeTooltipRef.current;
                if (!el) return;
                const { tooltip } = context;
                if (tooltip.opacity === 0) { el.style.opacity = '0'; setHoveredDate(null); return; }
                const dataIndex = tooltip.dataPoints?.[0]?.dataIndex;
                const point = dataIndex !== undefined ? timeline[dataIndex] : undefined;
                if (!point) return;
                el.innerHTML = buildProfitTooltipHtml(point, locale, t, fmtMoney);
                el.style.opacity = '1';
                el.style.left = `${tooltip.caretX}px`;
                el.style.top = `${tooltip.caretY}px`;
                setHoveredDate(point.date);
              },
            },
          },
          scales: {
            y: { ticks: { callback: v => fmtMoney(v as number), font: { size: 11 } }, grid: { color: 'rgba(128,128,128,0.08)' }, border: { display: false } },
            ...(overlay ? { y1: { position: 'right' as const, ticks: { callback: v => fmtPct(v as number), color: overlayColor, font: { size: 11 } }, grid: { display: false }, border: { display: false } } } : {}),
            x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 8 } },
          },
        },
      });
    } else if (activeChart === 'value' && !timeframeEmpty && !noPriceData) {
      const overlay = hasCompareOverlay && activeCompareSeries ? activeCompareSeries : null;
      const overlayColor = overlay ? assetColor(overlay.coinId, heldCoinIds) : '';
      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: timeline.map(tp => fmtDate(tp.date, locale)),
          datasets: [
            { label: t.profit_currentValue, data: timeline.map(tp => parseFloat(tp.currentValue.toFixed(2))), borderColor: '#1D9E75', backgroundColor: 'rgba(29,158,117,0.1)', fill: true, tension: 0.3, pointRadius: 4 },
            { label: t.profit_invested, data: timeline.map(tp => parseFloat(tp.invested.toFixed(2))), borderColor: '#534AB7', backgroundColor: 'rgba(83,74,183,0.05)', fill: true, tension: 0.3, pointRadius: 4, borderDash: [5, 3] },
            ...(overlay ? [{ label: `${overlay.symbol} ${t.profit_comparePeriodSuffix}`, data: overlay.series, borderColor: overlayColor, borderDash: [5, 4], yAxisID: 'y1', fill: false, tension: 0.3, pointRadius: 0, pointHoverRadius: 4 }] : []),
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top', labels: { font: { size: 12 }, boxWidth: 12 } },
            tooltip: {
              enabled: false,
              external: (context: TooltipExternalContext) => {
                const el = valueTooltipRef.current;
                if (!el) return;
                const { tooltip } = context;
                if (tooltip.opacity === 0) { el.style.opacity = '0'; setHoveredDate(null); return; }
                const dataIndex = tooltip.dataPoints?.[0]?.dataIndex;
                const point = dataIndex !== undefined ? timeline[dataIndex] : undefined;
                if (!point) return;
                el.innerHTML = buildValueTooltipHtml(point, dataIndex !== undefined ? timeline[dataIndex - 1] : undefined, locale, t, fmtMoney);
                el.style.opacity = '1';
                el.style.left = `${tooltip.caretX}px`;
                el.style.top = `${tooltip.caretY}px`;
                setHoveredDate(point.date);
              },
            },
          },
          scales: {
            y: { ticks: { callback: v => fmtMoney(v as number), font: { size: 11 } }, grid: { color: 'rgba(128,128,128,0.08)' }, border: { display: false } },
            ...(overlay ? { y1: { position: 'right' as const, ticks: { callback: v => fmtPct(v as number), color: overlayColor, font: { size: 11 } }, grid: { display: false }, border: { display: false } } } : {}),
            x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 8 } },
          },
        },
      });
    }

    return () => { if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; } };
  }, [ops, prices, timeline, timeframeEmpty, isTimeBased, activeChart, locale, t, profitByAsset, noPriceData, hasCompareOverlay, activeCompareSeries, heldCoinIds.join(',')]);

  const noDataOverlay = (
    <div className="empty-state" style={{ position: 'absolute', inset: 0 }}>
      <span style={{ fontSize: 13 }}>{t.profit_emptyState}</span>
    </div>
  );

  return (
    <div id="tab-lucro" className="section active">
      <ContentHeader title={t.nav_profit} subtitle={`${t.profit_subtitle} · ${currency}`}>
        {ratesMsg && <span className="ts neg">{ratesMsg}</span>}
        <span className="ts">{statusMsg}</span>
        <button className="btn" onClick={onFetchPrices}>
          <i className="ti ti-refresh" /> {t.wallet_updatePrices}
        </button>
      </ContentHeader>

      <div className="metrics" style={{ marginBottom: '1rem' }}>
        <MetricCard icon="ti ti-check" label={t.profit_realized} value={mask(fmtMoney(totalRealized))} valueColor={totalRealized >= 0 ? 'pos' : 'neg'} />
        <MetricCard
          icon="ti ti-clock"
          label={t.profit_unrealized}
          value={withPrice.length ? mask(fmtMoney(totalUnrealized)) : '—'}
          valueColor={withPrice.length ? (totalUnrealized >= 0 ? 'pos' : 'neg') : undefined}
        />
        <MetricCard
          icon="ti ti-arrow-up"
          label={t.profit_bestAsset}
          value={best ? best.symbol : '—'}
          sub={best ? fmtPct(best.unrealizedPct) : undefined}
          subColor={best ? (best.unrealizedPct >= 0 ? 'pos' : 'neg') : undefined}
        />
        <MetricCard
          icon="ti ti-arrow-down"
          label={t.profit_worstAsset}
          value={worst ? worst.symbol : '—'}
          sub={worst ? fmtPct(worst.unrealizedPct) : undefined}
          subColor={worst ? (worst.unrealizedPct >= 0 ? 'pos' : 'neg') : undefined}
        />
      </div>

      <div className="chart-switcher">
        {([['by-asset', t.chart_byAsset], ['over-time', t.chart_overTime], ['value', t.chart_value]] as [ChartType, string][]).map(([ct, label]) => (
          <button key={ct} className={`chart-btn${activeChart === ct ? ' active' : ''}`} onClick={() => onChartSwitch(ct)}>
            {label}
          </button>
        ))}
      </div>

      <div className="chart-area">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div className="sec-title" style={{ marginBottom: 0 }}>
            {{ 'by-asset': t.chart_byAsset, 'over-time': t.chart_overTime, value: t.chart_value }[activeChart]}
            {isTimeBased && historyError && <span className="ts neg" style={{ marginLeft: 8 }}>{historyError}</span>}
          </div>
          {isTimeBased && (
            <TimeframeSelector
              value={timeframe}
              onChange={setTimeframe}
              labels={{ '1d': t.timeframe_1d, '1w': t.timeframe_1w, '1m': t.timeframe_1m, '1y': t.timeframe_1y, all: t.timeframe_all }}
            />
          )}
        </div>
        {isTimeBased && compareChart && compareOptions.length > 0 && (
          <AssetCompareControl
            options={compareOptions}
            value={effectiveCompareValue}
            onChange={coinId => setCompareAsset(compareChart, coinId)}
            dayContribution={dayContribution}
          />
        )}
        <div className="chart-canvas-wrap">
          <canvas ref={chartRef} />
          {noPriceData && noDataOverlay}
          {!noPriceData && timeframeEmpty && (
            <div className="empty-state" style={{ position: 'absolute', inset: 0 }}>
              <span style={{ fontSize: 13 }}>{t.profit_emptyTimeframe}</span>
            </div>
          )}
          {isTimeBased && historyLoading && (
            <div className="chart-loading">
              <div className="spin" />
            </div>
          )}
          {activeChart === 'over-time' && <div ref={overTimeTooltipRef} className="chart-tooltip" />}
          {activeChart === 'value' && <div ref={valueTooltipRef} className="chart-tooltip" />}
        </div>
      </div>

      {isTimeBased && listItems.length > 0 && (
        <AssetsOverTimeList assets={listItems} onSelectAsset={setDetailAsset} dayContribution={dayContribution} />
      )}

      <div className="dist-section">
        <div className="sec-title">{t.profit_distribution}</div>
        {!openPositions.length ? (
          <div className="empty-state" style={{ padding: '1rem' }}>
            <span style={{ fontSize: 12 }}>{t.profit_emptyState}</span>
          </div>
        ) : (
          openPositions.map(p => {
            const pct = totalInvestedOpen > 0 ? (p.investedOpen / totalInvestedOpen) * 100 : 0;
            return (
              <div className="bar-row" key={p.coinId}>
                <div className="bar-header">
                  <span className="bar-name">{p.name} <span style={{ color: 'var(--text2)', fontWeight: 400 }}>{p.symbol}</span></span>
                  <span className="bar-pct">{pct.toFixed(1)}% — {mask(fmtMoney(p.investedOpen))}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${pct.toFixed(1)}%`, background: assetColor(p.coinId, heldCoinIds) }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {detailAssetData && (
        <AssetDetailChart
          asset={detailAssetData}
          dates={timeline.map(tp => tp.date)}
          fmtMoney={fmtMoney}
          onClose={() => setDetailAsset(null)}
        />
      )}
    </div>
  );
}
