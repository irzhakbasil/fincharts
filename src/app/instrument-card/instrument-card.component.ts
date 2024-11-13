import { Component, EventEmitter, Input, Output } from '@angular/core';
import { InstrumentWithUpdates } from '../interfaces/instrument';
import { CommonModule, DatePipe } from '@angular/common';
import { HistoricalPriceChartComponent } from '../historical-price-chart/historical-price-chart.component';

@Component({
  selector: 'app-instrument-card',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './instrument-card.component.html',
  styleUrl: './instrument-card.component.scss'
})
export class InstrumentCardComponent {
  @Input() instrumentWithUpdates: InstrumentWithUpdates | null = null;
  @Output() unsubscribeInstrument = new EventEmitter<string>();
  constructor() {}

  unsubscribe() {
    if (this.instrumentWithUpdates) {
      this.unsubscribeInstrument.emit(this.instrumentWithUpdates.id);
    }
  }
}
