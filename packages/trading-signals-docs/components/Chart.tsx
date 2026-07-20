import type {ChartOptions, HighchartsReactRefObject} from '@highcharts/react';
import {Chart as HighchartsChart} from '@highcharts/react';
import {useRef} from 'react';

export interface ChartDataPoint {
  x: number;
  y: number | null;
}

export interface FlagPoint {
  x: number;
  title: string;
  text: string;
}

export interface ChartProps {
  title: string;
  data: ChartDataPoint[];
  yAxisLabel?: string;
  color?: string;
  flags?: FlagPoint[];
}

export default function Chart({color = '#3b82f6', data, title, yAxisLabel = 'Value'}: ChartProps) {
  const chartRef = useRef<HighchartsReactRefObject>(null);

  const options: ChartOptions = {
    chart: {
      backgroundColor: 'transparent',
      height: 300,
      type: 'line',
    },
    credits: {
      enabled: false,
    },
    legend: {
      enabled: false,
    },
    plotOptions: {
      line: {
        lineWidth: 2,
        marker: {
          enabled: true,
          radius: 3,
        },
      },
    },
    series: [
      {
        color: color,
        data: data.map(point => [point.x, point.y]),
        id: 'main-series',
        marker: {
          fillColor: color,
        },
        name: yAxisLabel,
        type: 'line',
      },
    ],
    title: {
      style: {
        color: '#e2e8f0',
        fontSize: '16px',
        fontWeight: '600',
      },
      text: title,
    },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#475569',
      formatter: function () {
        const yValue = typeof this.y === 'number' ? this.y.toFixed(2) : 'N/A';
        return `<b>Period ${this.x}</b><br/>${yAxisLabel}: ${yValue}`;
      },
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
        text: yAxisLabel,
      },
    },
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <HighchartsChart options={options} ref={chartRef} />
    </div>
  );
}
