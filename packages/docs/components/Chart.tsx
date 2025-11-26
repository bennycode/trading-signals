import {useEffect, useRef} from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';

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

export default function Chart({title, data, yAxisLabel = 'Value', color = '#3b82f6', flags = []}: ChartProps) {
  const chartRef = useRef<HighchartsReact.RefObject>(null);

  const series: Highcharts.SeriesOptionsType[] = [
    {
      type: 'line',
      name: yAxisLabel,
      id: 'main-series',
      data: data.map(point => [point.x, point.y]),
      color: color,
      marker: {
        fillColor: color,
      },
    },
  ];

  if (flags.length > 0) {
    series.push({
      type: 'flags',
      name: 'Signal Changes',
      data: flags,
      onSeries: 'main-series',
      shape: 'squarepin',
      width: 80,
      useHTML: true,
      y: -20,
      grouping: false,
      color: '#fbbf24',
      fillColor: '#fbbf24',
      style: {
        color: '#1e293b',
        fontSize: '11px',
        fontWeight: 'bold',
      },
    } as Highcharts.SeriesFlagsOptions);
  }

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
      flags: {
        accessibility: {
          exposeAsGroupOnly: true,
        },
      },
    },
    series: series,
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
