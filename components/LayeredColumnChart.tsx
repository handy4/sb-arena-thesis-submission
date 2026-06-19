import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  ChartData,
  ChartOptions,
  Legend,
  LinearScale,
  Title,
  Tooltip
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { isScoreValue } from '../services/evaluationData';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export interface ChartScoreRow {
  id: string;
  category: string;
  [key: string]: string | number | null | undefined;
}

export interface ChartMetric {
  key: string;
  label: string;
  color: string;
}

interface LayeredColumnChartProps {
  data: ChartScoreRow[];
  totalMetric: ChartMetric;
  breakdownMetrics: ChartMetric[];
  showTotal: boolean;
  onBarClick?: (metricKey: string | null) => void;
  tooltipEnabled: boolean;
  helperLineEnabled: boolean;
  dynamicRecalculationEnabled: boolean;
}

const signKeyForMetric = (metricKey: string) => `${metricKey}__sign`;

function chartValue(row: ChartScoreRow, metricKey: string): number | null {
  const value = row[metricKey];
  return isScoreValue(value) ? Math.abs(value) : null;
}

function chartSign(row: ChartScoreRow, metricKey: string): string | null {
  const sign = row[signKeyForMetric(metricKey)];
  return sign === '+' || sign === '-' ? sign : null;
}

const LayeredColumnChart: React.FC<LayeredColumnChartProps> = ({
  data,
  totalMetric,
  breakdownMetrics,
  showTotal,
  onBarClick,
  tooltipEnabled,
  helperLineEnabled,
  dynamicRecalculationEnabled
}) => {
  const chartRef = useRef<any>(null);
  const hoverYRef = useRef<number | null>(null);
  const helperLineEnabledRef = useRef(helperLineEnabled);
  const [hiddenGranularKeys, setHiddenGranularKeys] = useState<Set<string>>(new Set());

  const breakdownKeySignature = breakdownMetrics.map(metric => metric.key).join('|');
  const chartMinWidth = data.length > 8 ? `${data.length * 150}px` : '100%';

  useEffect(() => {
    helperLineEnabledRef.current = helperLineEnabled;
    if (!helperLineEnabled) hoverYRef.current = null;
    chartRef.current?.update('none');
  }, [helperLineEnabled]);

  useEffect(() => {
    setHiddenGranularKeys(new Set());
  }, [totalMetric.key, breakdownKeySignature]);

  const helperLinePlugin = useRef({
    id: 'helperLine',
    afterDraw(chart: any) {
      if (!helperLineEnabledRef.current || hoverYRef.current === null) return;
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const y = hoverYRef.current;
      if (y < chartArea.top || y > chartArea.bottom) return;

      const yValue = (scales.y.getValueForPixel(y) ?? 0).toFixed(1);

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([5, 4]);
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const label = String(yValue);
      ctx.setLineDash([]);
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      const textW = ctx.measureText(label).width;
      const padX = 5;
      const boxW = textW + padX * 2;
      const boxH = 20;
      const boxX = chartArea.left + 6;
      const boxY = y - boxH / 2;

      ctx.fillStyle = 'rgba(17, 24, 39, 0.78)';
      ctx.beginPath();
      ctx.rect(boxX, boxY, boxW, boxH);
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, boxX + padX, y);
      ctx.restore();
    }
  });

  const signedValuePlugin = useRef({
    id: 'signedValueMarkers',
    afterDatasetsDraw(chart: any) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;

      ctx.save();
      ctx.font = '800 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden || dataset.hidden) return;

        meta.data.forEach((element: any, dataIndex: number) => {
          const sign = dataset.signs?.[dataIndex];
          if (sign !== '+' && sign !== '-') return;

          const { x, y } = element.tooltipPosition();
          const markerY = Math.max(chartArea.top + 8, y - 11);
          ctx.fillStyle = sign === '-' ? 'rgba(190, 24, 93, 0.9)' : 'rgba(5, 150, 105, 0.9)';
          ctx.fillText(sign, x, markerY);
        });
      });

      ctx.restore();
    }
  });

  const chartData: ChartData<'bar'> = useMemo(() => {
    const datasets = [];
    const visibleBreakdownMetrics = breakdownMetrics.filter(metric => !hiddenGranularKeys.has(metric.key));

    if (showTotal) {
      datasets.push({
        label: totalMetric.label,
        data: data.map(row => {
          if (!dynamicRecalculationEnabled || visibleBreakdownMetrics.length === 0) {
            return chartValue(row, totalMetric.key);
          }

          const visibleValues = visibleBreakdownMetrics
            .map(metric => chartValue(row, metric.key))
            .filter(isScoreValue);

          if (visibleValues.length === 0) return chartValue(row, totalMetric.key);
          return visibleValues.reduce((sum, value) => sum + value, 0) / visibleValues.length;
        }),
        signs: data.map(row => chartSign(row, totalMetric.key)),
        backgroundColor: 'rgba(229, 231, 235, 0.7)',
        borderColor: 'rgba(156, 163, 175, 0.8)',
        borderWidth: 1,
        borderRadius: 4,
        grouped: false,
        barPercentage: 0.9,
        categoryPercentage: 0.8,
        order: 2,
        metricKey: totalMetric.key
      });
    }

    breakdownMetrics.forEach(metric => {
      datasets.push({
        label: metric.label,
        data: data.map(row => chartValue(row, metric.key)),
        signs: data.map(row => chartSign(row, metric.key)),
        backgroundColor: hiddenGranularKeys.has(metric.key)
          ? metric.color.replace(/[\d.]+\)$/, '0.15)')
          : metric.color,
        borderColor: hiddenGranularKeys.has(metric.key)
          ? metric.color.replace(/[\d.]+\)$/, '0.2)')
          : metric.color.replace('0.8', '1'),
        borderWidth: 1,
        borderRadius: 4,
        grouped: true,
        barPercentage: 0.85,
        categoryPercentage: 0.7,
        order: 1,
        metricKey: metric.key,
        hidden: hiddenGranularKeys.has(metric.key)
      });
    });

    return { labels: data.map(row => row.category), datasets };
  }, [data, totalMetric, breakdownMetrics, showTotal, hiddenGranularKeys, dynamicRecalculationEnabled]);

  const dynamicYMax = useMemo(() => {
    const visibleBreakdownMetrics = breakdownMetrics.filter(metric => !hiddenGranularKeys.has(metric.key));
    let peak = 0;

    if (showTotal) {
      data.forEach(row => {
        const visibleValues = dynamicRecalculationEnabled
          ? visibleBreakdownMetrics.map(metric => chartValue(row, metric.key)).filter(isScoreValue)
          : [];
        const value = dynamicRecalculationEnabled && visibleValues.length > 0
          ? visibleValues.reduce((sum, item) => sum + item, 0) / visibleValues.length
          : chartValue(row, totalMetric.key);
        if (isScoreValue(value) && value > peak) peak = value;
      });
    }

    visibleBreakdownMetrics.forEach(metric => {
      data.forEach(row => {
        const value = chartValue(row, metric.key);
        if (isScoreValue(value) && value > peak) peak = value;
      });
    });

    if (peak === 0) return 100;
    return Math.min(100, Math.ceil(peak / 10) * 10 + 10);
  }, [data, totalMetric, breakdownMetrics, showTotal, hiddenGranularKeys, dynamicRecalculationEnabled]);

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    hover: {
      mode: 'index',
      intersect: false
    },
    onClick: (event, _elements, chart) => {
      const nativeEvent = event.native as MouseEvent;
      const activeElements = chart.getElementsAtEventForMode(nativeEvent, 'point', { intersect: true }, false);

      if (activeElements.length > 0) {
        let topElement = activeElements[0];
        let minOrder = (chart.data.datasets[topElement.datasetIndex] as any).order ?? 99;

        activeElements.forEach(element => {
          const dataset = chart.data.datasets[element.datasetIndex] as any;
          const order = dataset.order ?? 99;
          if (order < minOrder) {
            minOrder = order;
            topElement = element;
          }
        });

        const dataset = chart.data.datasets[topElement.datasetIndex] as any;
        onBarClick?.(dataset.metricKey as string);
      } else {
        onBarClick?.(null);
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { usePointStyle: true, padding: 25, font: { size: 12, weight: 'bold' } },
        onClick: (_event: any, legendItem: any, legend: any) => {
          const datasetIndex: number = legendItem.datasetIndex;
          const dataset = legend.chart.data.datasets[datasetIndex] as any;

          if (dataset.order === 2) {
            const defaultClick = (ChartJS as any).defaults.plugins.legend.onClick;
            if (defaultClick) defaultClick(_event, legendItem, legend);
            return;
          }

          const metricKey = dataset.metricKey as string;
          setHiddenGranularKeys(prev => {
            const next = new Set(prev);
            if (next.has(metricKey)) next.delete(metricKey);
            else next.add(metricKey);
            return next;
          });
        }
      },
      tooltip: {
        enabled: tooltipEnabled,
        mode: 'index',
        intersect: true,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#111827',
        bodyColor: '#4B5563',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: {
          label: context => {
            const value = context.parsed.y;
            const dataset = context.dataset as any;
            const sign = dataset.signs?.[context.dataIndex] ?? '';
            return ` ${context.dataset.label}: ${sign}${isScoreValue(value) ? value.toFixed(1) : 'N/A'} (Score)`;
          }
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { weight: 600 } } },
      y: { beginAtZero: true, max: dynamicYMax, grid: { color: '#F3F4F6' }, ticks: { callback: value => `${value}` } }
    },
    interaction: { mode: 'index', intersect: false }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    const chart = chartRef.current;
    if (!chart?.canvas) return;
    const rect = chart.canvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const inPlotArea = chart.chartArea && y > chart.chartArea.top && y < chart.chartArea.bottom;
    hoverYRef.current = helperLineEnabledRef.current && inPlotArea ? y : null;
    if (helperLineEnabledRef.current) chart.draw();
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { hoverYRef.current = null; chartRef.current?.draw(); }}
      className="w-full h-[600px] bg-white p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 relative overflow-x-auto overflow-y-hidden"
    >
      <div className="h-full" style={{ minWidth: chartMinWidth }}>
        <Bar ref={chartRef} data={chartData} options={options} plugins={[helperLinePlugin.current, signedValuePlugin.current]} />
      </div>
    </div>
  );
};

export default LayeredColumnChart;
