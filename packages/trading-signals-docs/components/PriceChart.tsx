import type {ChartOptions, HighchartsReactRefObject} from '@highcharts/react';
import {Chart as HighchartsChart} from '@highcharts/react';
import {useRef} from 'react';

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

export default function PriceChart({data, title}: PriceChartProps) {
  const chartRef = useRef<HighchartsReactRefObject>(null);

  const options: ChartOptions = {
    chart: {
      backgroundColor: 'transparent',
      height: 200,
      type: 'line',
    },
    credits: {
      enabled: false,
    },
    legend: {
      enabled: true,
      itemHoverStyle: {
        color: '#e2e8f0',
      },
      itemStyle: {
        color: '#94a3b8',
      },
    },
    plotOptions: {
      line: {
        lineWidth: 1.5,
        marker: {
          enabled: false,
        },
      },
    },
    series: [
      {
        color: '#a78bfa',
        data: data.map(point => [point.x, point.open]),
        marker: {
          fillColor: '#a78bfa',
        },
        name: 'Open',
        type: 'line',
      },
      {
        color: '#10b981',
        data: data.map(point => [point.x, point.high]),
        marker: {
          fillColor: '#10b981',
        },
        name: 'High',
        type: 'line',
      },
      {
        color: '#ef4444',
        data: data.map(point => [point.x, point.low]),
        marker: {
          fillColor: '#ef4444',
        },
        name: 'Low',
        type: 'line',
      },
      {
        color: '#3b82f6',
        data: data.map(point => [point.x, point.close]),
        marker: {
          fillColor: '#3b82f6',
        },
        name: 'Close',
        type: 'line',
      },
    ],
    title: {
      style: {
        color: '#e2e8f0',
        fontSize: '14px',
        fontWeight: '600',
      },
      text: title,
    },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#475569',
      formatter: function () {
        let s: string = `<b>Period ${(this as any).x}</b><br/>`;
        ((this as any).points as any[])?.forEach((point: any) => {
          const yValue = typeof point.y === 'number' ? `$${point.y.toFixed(2)}` : 'N/A';
          s += `${point.series.name}: ${yValue}<br/>`;
        });
        return s;
      },
      shared: true,
      style: {
        color: '#e2e8f0',
      },
    },
    xAxis: {
      gridLineColor: '#334155',
      labels: {
        style: {color: '#94a3b8'},
      },
      title: {
        style: {color: '#94a3b8'},
        text: 'Period',
      },
    },
    yAxis: {
      gridLineColor: '#334155',
      labels: {
        style: {color: '#94a3b8'},
      },
      title: {
        style: {color: '#94a3b8'},
        text: 'Price ($)',
      },
    },
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <HighchartsChart options={options} ref={chartRef} />
    </div>
  );
}
