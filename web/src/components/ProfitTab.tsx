'use client';

import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { Asset, ChartType, Op, Prices } from '@/lib/types';
import { fmt, fmtPct, fmtDate } from '@/lib/format';
import { computeTimeline } from '@/lib/portfolio';

const PALETTE = ['#534AB7','#1D9E75','#D85A30','#D4537E','#378ADD','#639922','#BA7517','#E24B4A','#888780','#0F6E56'];

interface Props {
  assets: Asset[];
  ops: Op[];
  prices: Prices;
  activeChart: ChartType;
  onChartSwitch: (t: ChartType) => void;
}

export default function ProfitTab({ assets, ops, prices, activeChart, onChartSwitch }: Props) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const data = assets.map(a => {
    const p = prices[a.coinId] || 0, inv = a.qty * a.avgPrice, atual = a.qty * p, l = atual - inv, pct = inv > 0 ? (l / inv) * 100 : 0;
    return { name: a.name, symbol: a.symbol, coinId: a.coinId, inv, l, pct, hasPrice: p > 0 };
  }).filter(d => d.inv > 0);

  const withPrice = data.filter(d => d.hasPrice);
  const totalNR = withPrice.reduce((s, d) => s + d.l, 0);
  const realizado = ops.filter(o => o.type === 'Venda').reduce((s, o) => s + o.total, 0)
    - ops.filter(o => o.type === 'Compra').reduce((s, o) => s + o.total, 0);
  const best = withPrice.length ? withPrice.reduce((a, b) => b.pct > a.pct ? b : a) : null;
  const worst = withPrice.length ? withPrice.reduce((a, b) => b.pct < a.pct ? b : a) : null;
  const totalInv = data.reduce((s, d) => s + d.inv, 0);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const noPrice = !withPrice.length;
    const timeline = (activeChart === 'over-time' || activeChart === 'value') ? computeTimeline(ops, prices) : [];

    if (activeChart === 'by-asset' && !noPrice) {
      chartInstance.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: withPrice.map(d => d.symbol),
          datasets: [{ label: 'Lucro/Prejuízo (R$)', data: withPrice.map(d => parseFloat(d.l.toFixed(2))), backgroundColor: withPrice.map(d => d.l >= 0 ? '#1D9E75' : '#E24B4A'), borderRadius: 6, borderSkipped: false }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmt(c.raw as number) }, padding: 10 } },
          scales: {
            y: { ticks: { callback: v => fmt(v as number), font: { size: 11 } }, grid: { color: 'rgba(128,128,128,0.08)' }, border: { display: false } },
            x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 12 } } },
          },
        },
      });
    } else if (activeChart === 'over-time' && timeline.length && !noPrice) {
      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: timeline.map(t => fmtDate(t.date)),
          datasets: [{ label: 'Lucro/Prejuízo (R$)', data: timeline.map(t => parseFloat(t.pnl.toFixed(2))), borderColor: '#534AB7', backgroundColor: 'rgba(83,74,183,0.1)', fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmt(c.raw as number) }, padding: 10 } },
          scales: {
            y: { ticks: { callback: v => fmt(v as number), font: { size: 11 } }, grid: { color: 'rgba(128,128,128,0.08)' }, border: { display: false } },
            x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 8 } },
          },
        },
      });
    } else if (activeChart === 'value' && timeline.length && !noPrice) {
      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: timeline.map(t => fmtDate(t.date)),
          datasets: [
            { label: 'Valor atual', data: timeline.map(t => parseFloat(t.currentValue.toFixed(2))), borderColor: '#1D9E75', backgroundColor: 'rgba(29,158,117,0.1)', fill: true, tension: 0.3, pointRadius: 4 },
            { label: 'Investido', data: timeline.map(t => parseFloat(t.invested.toFixed(2))), borderColor: '#534AB7', backgroundColor: 'rgba(83,74,183,0.05)', fill: true, tension: 0.3, pointRadius: 4, borderDash: [5, 3] },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: true, position: 'top', labels: { font: { size: 12 }, boxWidth: 12 } }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + fmt(c.raw as number) }, padding: 10 } },
          scales: {
            y: { ticks: { callback: v => fmt(v as number), font: { size: 11 } }, grid: { color: 'rgba(128,128,128,0.08)' }, border: { display: false } },
            x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 8 } },
          },
        },
      });
    }

    return () => { if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; } };
  }, [assets, ops, prices, activeChart]);

  const noDataOverlay = (
    <div className="empty-state" style={{ position: 'absolute', inset: 0 }}>
      <span style={{ fontSize: 13 }}>Atualize os preços para ver o gráfico</span>
    </div>
  );

  return (
    <div id="tab-lucro" className="section active">
      <div className="metrics" style={{ marginBottom: '1rem' }}>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-check" /> Lucro realizado</div>
          <div className={`metric-value ${realizado >= 0 ? 'pos' : 'neg'}`}>{fmt(realizado)}</div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-clock" /> Não realizado</div>
          <div className={`metric-value ${totalNR >= 0 ? 'pos' : 'neg'}`}>{withPrice.length ? fmt(totalNR) : '—'}</div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-arrow-up" /> Melhor ativo</div>
          <div className="metric-value" style={{ fontSize: 15 }}>
            {best ? <>{best.symbol}<br /><span className="pos" style={{ fontSize: 13 }}>{fmtPct(best.pct)}</span></> : '—'}
          </div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-arrow-down" /> Pior ativo</div>
          <div className="metric-value" style={{ fontSize: 15 }}>
            {worst ? <>{worst.symbol}<br /><span className={worst.pct >= 0 ? 'pos' : 'neg'} style={{ fontSize: 13 }}>{fmtPct(worst.pct)}</span></> : '—'}
          </div>
        </div>
      </div>

      <div className="chart-switcher">
        {([['by-asset', 'ti-chart-bar', 'Por ativo'], ['over-time', 'ti-chart-line', 'Lucro no tempo'], ['value', 'ti-chart-area', 'Valor da carteira']] as [ChartType, string, string][]).map(([t, icon, label]) => (
          <button key={t} className={`chart-btn${activeChart === t ? ' active' : ''}`} onClick={() => onChartSwitch(t)}>
            <i className={`ti ${icon}`} /> {label}
          </button>
        ))}
      </div>

      <div className="chart-area" style={{ position: 'relative' }}>
        <canvas ref={chartRef} />
        {!withPrice.length && noDataOverlay}
      </div>

      <div className="dist-section">
        <div className="sec-title">Distribuição por aporte</div>
        {!data.length ? (
          <div className="empty-state" style={{ padding: '1rem' }}>
            <span style={{ fontSize: 12 }}>Registre operações e atualize os preços</span>
          </div>
        ) : (
          data.map((d, i) => {
            const pct = totalInv > 0 ? (d.inv / totalInv) * 100 : 0;
            return (
              <div className="bar-row" key={d.coinId}>
                <div className="bar-header">
                  <span className="bar-name">{d.name} <span style={{ color: 'var(--text2)', fontWeight: 400 }}>{d.symbol}</span></span>
                  <span className="bar-pct">{pct.toFixed(1)}% — {fmt(d.inv)}</span>
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
