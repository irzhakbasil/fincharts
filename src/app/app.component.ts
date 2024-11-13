import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppService } from './app.service';
import { Subject, Subscription, forkJoin, of, switchMap, take } from 'rxjs';
import { Instrument, InstrumentWithUpdates } from './interfaces/instrument';
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { ProviderExchanges } from './interfaces/providers';
import { InstrumentCardComponent } from "./instrument-card/instrument-card.component";
import { HistoricalPriceChartComponent } from './historical-price-chart/historical-price-chart.component';
import { CandleResponse } from './interfaces/candle-data';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
    NgSelectComponent,
    FormsModule,
    InstrumentCardComponent,
    HistoricalPriceChartComponent
],
  providers: [AppService],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  instruments: Instrument[] = [];
  destroyed = new Subject<void>();
  instrument: string  = '';
  providers: string[] = [];
  exchanges!: ProviderExchanges;
  subscribedInstrumentsIds: string[] = [];
  messagesSendCount = 1;
  getMessageSubscription$!: Subscription;
  subscribedInstruments: Instrument[] = [];
  instrumentsWithUpdates: InstrumentWithUpdates[] = [];  

  constructor(private appService: AppService, private cdRef: ChangeDetectorRef) {
    
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.appService.getLoggedIn().pipe(
      switchMap(loggedIn => {
        if (loggedIn) {
          const instruments$ = this.appService.listInstruments();
          const providers$ = this.appService.listProviders();
          const exchanges$ = this.appService.listExchanges();
          return forkJoin({
            instruments: instruments$,
            providers: providers$,
            exchanges: exchanges$
          });
        }
        return of(null);
      })
    ).subscribe({
      next: res => {
        this.instruments = res?.instruments.data as Instrument[];
        this.providers = res?.providers.data as string[];
        this.exchanges = res?.exchanges.data as ProviderExchanges;
      },

      error: err => console.error(err)
    }
    )
  }

  subscribeToInstrument() {
    // First check if we already have this instrument in instrumentsWithUpdates
    const existingInstrument = this.instrumentsWithUpdates.find(inst => inst.id === this.instrument);
    
    // Only proceed if:
    // 1. We have an instrument selected
    // 2. It's not already in instrumentsWithUpdates
    // 3. We haven't subscribed to it yet
    if (this.instrument && 
        !existingInstrument && 
        !this.subscribedInstrumentsIds.includes(this.instrument)) {
        
        // Find the instrument in the main instruments array
        const instrument = this.instruments.find(i => i.id === this.instrument);
        
        if (instrument) {
            // Add the instrument to instrumentsWithUpdates immediately
            this.appService.getHistoricalData(this.instrument)
                .pipe(take(1))
                .subscribe({
                    next: (candleResponse: CandleResponse) => {
                        this.instrumentsWithUpdates.push({
                            ...instrument,
                            updates: null,
                            candleData: candleResponse.data.map(candle => ({
                                ...candle,
                                t: new Date(candle.t)
                            }))
                        });
                        this.cdRef.detectChanges();
                    },
                    error: (error) => {
                        console.error('Failed to fetch candle data:', error);
                        this.instrumentsWithUpdates.push({
                            ...instrument,
                            updates: {
                                type: 'l1-update',
                                instrumentId: instrument.id,
                                provider: 'oanda',
                                bid: {
                                    timestamp: new Date().toISOString(),
                                    price: 0,
                                    volume: 0
                                }
                            },
                            candleData: []
                        });
                        this.cdRef.detectChanges();
                    }
                });

            // Send subscription message
            const subscriptionMessage = {
                type: "l1-subscription",
                id: '' + this.messagesSendCount,
                instrumentId: this.instrument,
                provider: "oanda",
                subscribe: true,
                kinds: ["ask", "bid", "last"]
            };
            
            this.subscribedInstrumentsIds.push(this.instrument);
            const messageSent = this.appService.sendWSMessage(subscriptionMessage);
            
            if (messageSent) {
                this.messagesSendCount++;
                
                // Initialize or update WebSocket subscription
                if (!this.getMessageSubscription$) {
                    this.getMessageSubscription$ = this.appService.getWSMessages().subscribe(res => {
                        if (res.type === 'l1-update') {
                            // Only update the updates field for existing instrument
                            const existingInstrumentIndex = this.instrumentsWithUpdates.findIndex(
                                inst => inst.id === res.instrumentId
                            );
                            
                            if (existingInstrumentIndex !== -1) {
                                this.instrumentsWithUpdates[existingInstrumentIndex].updates = res;
                                this.cdRef.detectChanges();
                            }
                        }
                    });
                }
            }
        }
    }
}
// Separate method to handle L1 updates for better organization
private handleL1Update(res: any) {
    const instrumentId = res.instrumentId;
    const existingInstrumentIndex = this.instrumentsWithUpdates.findIndex(inst => inst.id === instrumentId);
    
    if (existingInstrumentIndex === -1) {
        // If instrument doesn't exist in instrumentsWithUpdates, find it in instruments
        const instrument = this.instruments.find(i => i.id === instrumentId);
        
        if (instrument) {
            // Fetch historical candle data before adding the instrument
            this.appService.getHistoricalData(instrumentId)
                .pipe(take(1))
                .subscribe({
                    next: (candleResponse: CandleResponse) => {
                        const newInstrument: InstrumentWithUpdates = {
                            ...instrument,
                            updates: res,
                            candleData: candleResponse.data.map(candle => ({
                                ...candle,
                                t: new Date(candle.t)
                            }))
                        };
                        
                        // Double check again before pushing to prevent race conditions
                        if (!this.instrumentsWithUpdates.some(inst => inst.id === instrumentId)) {
                            this.instrumentsWithUpdates.push(newInstrument);
                            this.cdRef.detectChanges();
                        }
                    },
                    error: (error) => {
                        console.error('Failed to fetch candle data:', error);
                        const newInstrument: InstrumentWithUpdates = {
                            ...instrument,
                            updates: res,
                            candleData: []
                        };
                        
                        // Double check again before pushing to prevent race conditions
                        if (!this.instrumentsWithUpdates.some(inst => inst.id === instrumentId)) {
                            this.instrumentsWithUpdates.push(newInstrument);
                            this.cdRef.detectChanges();
                        }
                    }
                });
        }
    } else {
        // Just update existing instrument's l1 data
        this.instrumentsWithUpdates[existingInstrumentIndex].updates = res;
        this.cdRef.detectChanges();
    }
}

  unsubscribeInstrument(id: string) {
    const subscriptionMessage = {
      type: "l1-subscription",
      id: '' + this.messagesSendCount,
      instrumentId: id,
      provider: "oanda",
      subscribe: false,
      kinds: ["ask", "bid", "last"]
    };
    this.subscribedInstrumentsIds = this.subscribedInstrumentsIds.filter(i => i !== id);
    const messageSent = this.appService.sendWSMessage(subscriptionMessage);
    if(messageSent) {
      this.messagesSendCount++;
      this.instrumentsWithUpdates = this.instrumentsWithUpdates.filter(i => i.id !== id);
    }
  }

  customSearch = (term: string, item: Instrument) => {
    term = term.toLowerCase();
    // Search through multiple fields
    return item.baseCurrency?.toLowerCase().includes(term) || 
           item.currency?.toLowerCase().includes(term) ||
           item.description?.toLowerCase().includes(term) ||
           `${item.baseCurrency}/${item.currency}`.toLowerCase().includes(term) ||
           item.symbol?.toLowerCase().includes(term);
  }
}
