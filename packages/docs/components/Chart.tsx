import {useEffect, useRef} from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

export interface ChartDataPoint {
  x: number;
  y: number | null;
}

export interface ChartProps {
  title: string;
  data: ChartDataPoint[];
  yAxisLabel?: string;
  color?: string;
}

export default function Chart({title, data, yAxisLabel = 'Value', color = '#3b82f6'}: ChartProps) {
  const chartRef = useRef<HighchartsReact.RefObject>(null);

  const options: Highcharts.Options = {
    chart: {
      type: 'line',
      backgroundColor: 'transparent',
      height: 300,
    },
    title: {
      text: title,
      style: {
        color: '#e2e8f0',
        fontSize: '16px',
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
        text: yAxisLabel,
        style: {color: '#94a3b8'},
      },
      labels: {
        style: {color: '#94a3b8'},
      },
      gridLineColor: '#334155',
    },
    legend: {
      enabled: false,
    },
    plotOptions: {
      line: {
        marker: {
          enabled: true,
          radius: 3,
        },
        lineWidth: 2,
      },
    },
    series: [
      {
        type: 'line',
        name: yAxisLabel,
        data: data.map(point => [point.x, point.y]),
        color: color,
        marker: {
          fillColor: color,
        },
      },
    ],
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#475569',
      style: {
        color: '#e2e8f0',
      },
      formatter: function () {
        const yValue = typeof this.y === 'number' ? this.y.toFixed(2) : 'N/A';
        return `<b>Period ${this.x}</b><br/>${yAxisLabel}: ${yValue}`;
      },
    },
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <HighchartsReact highcharts={Highcharts} options={options} ref={chartRef} />
    </div>
  );
}
