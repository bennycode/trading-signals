import { Chart as HighchartsChart, HighchartsReactRefObject } from '@highcharts/react';
import { Options } from 'highcharts';
import { useRef } from 'react';

export interface PriceData {
  x: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PriceChartProps {
  title: string;
  data: PriceData[];
}

export default function PriceChart({title, data}: PriceChartProps) {
  const chartRef = useRef<HighchartsReactRefObject>(null);

  const options: Options = {
    chart: {
      type: 'line',
      backgroundColor: 'transparent',
      height: 200,
    },
    title: {
      text: title,
      style: {
        color: '#e2e8f0',
        fontSize: '14px',
        fontWeight: '600',
      },
    },
    credits: {
      enabled: false,
    },
    xAxis: {
      title: {
        text: 'Period',
        style: {color: '#94a3b8'},
      },
      labels: {
        style: {color: '#94a3b8'},
      },
      gridLineColor: '#334155',
    },
    yAxis: {
      title: {
        text: 'Price ($)',
        style: {color: '#94a3b8'},
      },
      labels: {
        style: {color: '#94a3b8'},
      },
      gridLineColor: '#334155',
    },
    legend: {
      enabled: true,
      itemStyle: {
        color: '#94a3b8',
      },
      itemHoverStyle: {
        color: '#e2e8f0',
      },
    },
    plotOptions: {
      line: {
        marker: {
          enabled: false,
        },
        lineWidth: 1.5,
      },
    },
    series: [
      {
        type: 'line',
        name: 'Open',
        data: data.map(point => [point.x, point.open]),
        color: '#a78bfa',
        marker: {
          fillColor: '#a78bfa',
        },
      },
      {
        type: 'line',
        name: 'High',
        data: data.map(point => [point.x, point.high]),
        color: '#10b981',
        marker: {
          fillColor: '#10b981',
        },
      },
      {
        type: 'line',
        name: 'Low',
        data: data.map(point => [point.x, point.low]),
        color: '#ef4444',
        marker: {
          fillColor: '#ef4444',
        },
      },
      {
        type: 'line',
        name: 'Close',
        data: data.map(point => [point.x, point.close]),
        color: '#3b82f6',
        marker: {
          fillColor: '#3b82f6',
        },
      },
    ],
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#475569',
      style: {
        color: '#e2e8f0',
      },
      shared: true,
      formatter: function (): string {
        let s: string = `<b>Period ${(this as any).x}</b><br/>`;
        ((this as any).points as any[])?.forEach((point: any) => {
          const yValue = typeof point.y === 'number' ? `$${point.y.toFixed(2)}` : 'N/A';
          s += `${point.series.name}: ${yValue}<br/>`;
        });
        return s;
      },
    },
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <HighchartsChart options={options} ref={chartRef} />
    </div>
  );
}
