
import { ChangeDetectionStrategy, Component, Input, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective, provideCharts } from 'ng2-charts';
import 'chart.js/auto';
import { CandleData } from '../interfaces/candle-data';
import { 
  Chart, 
  ChartConfiguration, 
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend 
} from 'chart.js';
import 'chartjs-adapter-date-fns';
Chart.register(
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

@Component({
  selector: 'app-historical-price-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  providers: [provideCharts()],
  template: `
    <div class="chart-container">
      <canvas baseChart
        [type]="'line'"
        [data]="chartData"
        [options]="chartOptions">
      </canvas>
    </div>
  `,
  styles: [`
    .chart-container {
      width: 100%;
      height: 400px;
      margin: 20px 0;
    }
  `]
})
export class HistoricalPriceChartComponent implements OnInit {
  @Input() set data(value: CandleData[] | undefined) {
    if (value && this.shouldUpdateChart(value)) {
      this.currentData = value;
      this.updateChartData(value);
    }
  }
  

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  private currentData: CandleData[] = [];
  chartData: ChartConfiguration['data'] = {
    datasets: [
      {
        data: [],
        label: 'Price',
        borderColor: '#3f51b5',
        backgroundColor: 'rgba(63, 81, 181, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 1,
        pointHoverRadius: 4,
      }
    ],
    labels: []
  };

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Historical Prices'
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
          displayFormats: {
            minute: 'HH:mm'
          }
        },
        title: {
          display: true,
          text: 'Time'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Price'
        },
        position: 'left',
      }
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  };

  ngOnInit() {}

  private updateChartData(candleData: CandleData[]) {
    this.chartData.labels = candleData.map(d => new Date(d.t));
    this.chartData.datasets[0].data = candleData.map(d => d.c);

    const prices = candleData.map(d => d.c);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const padding = (maxPrice - minPrice) * 0.1;

    if (this.chartOptions?.scales?.['y']) {
      this.chartOptions.scales['y'].min = minPrice - padding;
      this.chartOptions.scales['y'].max = maxPrice + padding;
    }

    this.chart?.update();
  }

  private shouldUpdateChart(newData: CandleData[]): boolean {
    // If there's no current data, we should update
    if (this.currentData.length === 0) return true;

    // If lengths are different, we should update
    if (this.currentData.length !== newData.length) return true;

    // Compare the last items to see if they're different
    const lastCurrentItem = this.currentData[this.currentData.length - 1];
    const lastNewItem = newData[newData.length - 1];

    // Return true if any value is different
    return lastCurrentItem.t !== lastNewItem.t ||
           lastCurrentItem.o !== lastNewItem.o ||
           lastCurrentItem.h !== lastNewItem.h ||
           lastCurrentItem.l !== lastNewItem.l ||
           lastCurrentItem.c !== lastNewItem.c ||
           lastCurrentItem.v !== lastNewItem.v;
  }
}