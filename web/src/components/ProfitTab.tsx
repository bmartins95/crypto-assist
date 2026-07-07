'use client';

import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { ChartType, Op, Prices } from '@/lib/types';
import { fmtPct, fmtDate } from '@/lib/format';
import { computeTimeline, computeProfitByAsset } from '@/lib/portfolio';
import { useLocale } from '@/context/LocaleContext';
import { useBalance } from '@/context/BalanceContext';
import { useCurrency } from '@/context/CurrencyContext';
import ContentHeader from '@/components/ContentHeader';
import MetricCard from '@/components/MetricCard';

const PALETTE = ['#534AB7','#1D9E75','#D85A30','#D4537E','#378ADD','#639922','#BA7517','#E24B4A','#888780','#0F6E56'];

interface Props {
  ops: Op[];
  prices: Prices;
  activeChart: ChartType;
  onChartSwitch: (t: ChartType) => void;
  statusMsg: string;
  onFetchPrices: () => void;
}

export default function ProfitTab({ ops, prices, activeChart, onChartSwitch, statusMsg, onFetchPrices }: Props) {
  const { locale, t } = useLocale();
  const { hidden } = useBalance();
  const { ratesStatus, fmtMoney } = useCurrency();
  const mask = (v: string): string => (hidden ? '••••••' : v);
  const ratesMsg = ratesStatus === 'unavailable' ? t.currency_rates_unavailable
    : ratesStatus === 'stale' ? t.currency_rates_stale : '';
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const profitByAsset = computeProfitByAsset(ops, prices);
  const totalRealized = profitByAsset.reduce((s, p) => s + p.realizedPnl, 0);
  const withPrice = profitByAsset.filter(p => p.hasPrice);
  const totalUnrealized = withPrice.reduce((s, p) => s + p.unrealizedPnl, 0);
  const openWithPrice = profitByAsset.filter(p => p.hasOpenPosition && p.hasPrice);
  const best = openWithPrice.length ? openWithPrice.reduce((a, b) => (b.unrealizedPct > a.unrealizedPct ? b : a)) : null;
  const worst = openWithPrice.length ? openWithPrice.reduce((a, b) => (b.unrealizedPct < a.unrealizedPct ? b : a)) : null;
  const openPositions = profitByAsset.filter(p => p.hasOpenPosition);
  const totalInvestedOpen = openPositions.reduce((s, p) => s + p.investedOpen, 0);
  const noPriceData = !profitByAsset.some(p => p.hasPrice);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const timeline = (activeChart === 'over-time' || activeChart === 'value') ? computeTimeline(ops, prices) : [];

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
    } else if (activeChart === 'over-time' && timeline.length && !noPriceData) {
      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: timeline.map(tp => fmtDate(tp.date, locale)),
          datasets: [{ label: t.profit_pnl, data: timeline.map(tp => parseFloat(tp.pnl.toFixed(2))), borderColor: '#534AB7', backgroundColor: 'rgba(83,74,183,0.1)', fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtMoney(c.raw as number) }, padding: 10 } },
          scales: {
            y: { ticks: { callback: v => fmtMoney(v as number), font: { size: 11 } }, grid: { color: 'rgba(128,128,128,0.08)' }, border: { display: false } },
            x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 8 } },
          },
        },
      });
    } else if (activeChart === 'value' && timeline.length && !noPriceData) {
      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: timeline.map(tp => fmtDate(tp.date, locale)),
          datasets: [
            { label: t.profit_currentValue, data: timeline.map(tp => parseFloat(tp.currentValue.toFixed(2))), borderColor: '#1D9E75', backgroundColor: 'rgba(29,158,117,0.1)', fill: true, tension: 0.3, pointRadius: 4 },
            { label: t.profit_invested, data: timeline.map(tp => parseFloat(tp.invested.toFixed(2))), borderColor: '#534AB7', backgroundColor: 'rgba(83,74,183,0.05)', fill: true, tension: 0.3, pointRadius: 4, borderDash: [5, 3] },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: true, position: 'top', labels: { font: { size: 12 }, boxWidth: 12 } }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + fmtMoney(c.raw as number) }, padding: 10 } },
          scales: {
            y: { ticks: { callback: v => fmtMoney(v as number), font: { size: 11 } }, grid: { color: 'rgba(128,128,128,0.08)' }, border: { display: false } },
            x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 8 } },
          },
        },
      });
    }

    return () => { if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; } };
  }, [ops, prices, activeChart, locale, t, profitByAsset, noPriceData]);

  const noDataOverlay = (
    <div className="empty-state" style={{ position: 'absolute', inset: 0 }}>
      <span style={{ fontSize: 13 }}>{t.profit_emptyState}</span>
    </div>
  );

  return (
    <div id="tab-lucro" className="section active">
      <ContentHeader title={t.nav_profit} subtitle={t.profit_subtitle}>
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
        <div className="sec-title">{{ 'by-asset': t.chart_byAsset, 'over-time': t.chart_overTime, value: t.chart_value }[activeChart]}</div>
        <div className="chart-canvas-wrap">
          <canvas ref={chartRef} />
          {noPriceData && noDataOverlay}
        </div>
      </div>

      <div className="dist-section">
        <div className="sec-title">{t.profit_distribution}</div>
        {!openPositions.length ? (
          <div className="empty-state" style={{ padding: '1rem' }}>
            <span style={{ fontSize: 12 }}>{t.profit_emptyState}</span>
          </div>
        ) : (
          openPositions.map((p, i) => {
            const pct = totalInvestedOpen > 0 ? (p.investedOpen / totalInvestedOpen) * 100 : 0;
            return (
              <div className="bar-row" key={p.coinId}>
                <div className="bar-header">
                  <span className="bar-name">{p.name} <span style={{ color: 'var(--text2)', fontWeight: 400 }}>{p.symbol}</span></span>
                  <span className="bar-pct">{pct.toFixed(1)}% — {mask(fmtMoney(p.investedOpen))}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${pct.toFixed(1)}%`, background: PALETTE[i % PALETTE.length] }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
