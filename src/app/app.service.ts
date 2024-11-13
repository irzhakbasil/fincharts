import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, Subject, timer } from "rxjs";
import { tap } from "rxjs/operators";
import { L1Subscription } from "./interfaces/ws-mesage-interface";
import { Instrument } from "./interfaces/instrument";
import { CandleResponse } from "./interfaces/candle-data";

type sendMessageResult = 'success' | 'error';

interface TokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
    session_state: string;
    scope: string;
}

const API_URL = 'https://platform.fintacharts.com';
const USER_NAME = 'r_test@fintatech.com';
const PASSWORD = 'kisfiz-vUnvy9-sopnyv';
const WSS_URL2 = 'wss://platform.fintacharts.com/api/streaming/ws/v1/realtime?token=';

@Injectable({
    providedIn: 'root'
})
export class AppService {
    private loggedIn$ = new BehaviorSubject<boolean>(false);
    private webSocket: WebSocket | null = null;
    private wsMessages$ = new Subject<any>();
    private tokenExpirationTimer: any;

    constructor(private http: HttpClient) {
        this.login();
    }

    private setTokenExpirationTimer(expiresIn: number) {
        if (this.tokenExpirationTimer) {
            clearTimeout(this.tokenExpirationTimer);
        }

        this.tokenExpirationTimer = setTimeout(() => {
            this.getNewToken().subscribe({
                next: res => {
                    localStorage.setItem('token', res.access_token);
                    this.loggedIn$.next(true);
                    this.initializeWebSocket(res.access_token);
                },
                error: err => {
                    console.error('Failed to refresh token:', err);
                    this.logout();
                }
            });
        }, (expiresIn - 60) * 1000); // Convert to milliseconds and refresh 1 minute early
    }

    private stopTokenExpirationTimer() {
        if (this.tokenExpirationTimer) {
            clearTimeout(this.tokenExpirationTimer);
        }
    }

    login() {
        const token = localStorage.getItem('token');
        if (token) {
            const tokenData = this.parseJwt(token);
            const currentTime = Math.floor(Date.now() / 1000);
            
            if (tokenData && tokenData.exp > currentTime) {
                this.loggedIn$.next(true);
                this.initializeWebSocket(token);
                this.setTokenExpirationTimer(tokenData.exp - currentTime);
            } else {
                this.getNewToken().subscribe({
                    next: res => {
                        localStorage.setItem('token', res.access_token);
                        this.loggedIn$.next(true);
                        this.initializeWebSocket(res.access_token);
                    },
                    error: err => console.error(err)
                });
            }
        } else {
            this.getNewToken().subscribe({
                next: res => {
                    localStorage.setItem('token', res.access_token);
                    this.loggedIn$.next(true);
                    this.initializeWebSocket(res.access_token);
                },
                error: err => console.error(err)
            });
        }
    }

    private parseJwt(token: string) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(window.atob(base64));
        } catch (e) {
            console.error('Error parsing JWT:', e);
            return null;
        }
    }

    logout() {
        this.stopTokenExpirationTimer();
        localStorage.removeItem('token');
        this.loggedIn$.next(false);
        this.closeWSConnection();
    }

    getNewToken(): Observable<TokenResponse> {
        const headers = new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Access-Control-Allow-Origin', '*')
            .set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
            .set('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
        
        const body = new URLSearchParams();
        body.set('grant_type', 'password');
        body.set('client_id', 'app-cli');
        body.set('username', USER_NAME);
        body.set('password', PASSWORD);

        return this.http.post<TokenResponse>(
            `/identity/realms/fintatech/protocol/openid-connect/token`, 
            body.toString(),
            {headers}
        ).pipe(
            tap(response => {
                this.setTokenExpirationTimer(response.expires_in);
            })
        );
    }

    private initializeWebSocket(token: string) {
        if (this.webSocket) {
            this.webSocket.close();
        }

        this.webSocket = new WebSocket(`${WSS_URL2}${token}`);

        this.webSocket.onopen = () => {
            console.log('WebSocket connection established');
        };

        this.webSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.wsMessages$.next(data);
        };

        this.webSocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.webSocket.onclose = () => {
            console.log('WebSocket connection closed');
        };
    }

    sendWSMessage(message: L1Subscription): boolean {
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.send(JSON.stringify(message));
            return true;
        } else {
            console.error('WebSocket is not connected');
            return false;
        }
    }

    getWSMessages(): Observable<any> {
        return this.wsMessages$.asObservable();
    }

    closeWSConnection() {
        if (this.webSocket) {
            this.webSocket.close();
            this.webSocket = null;
        }
    }

    listInstruments(): Observable<{paging: any, data: Instrument[]}> {
        return this.http.get<{paging: any, data: Instrument[]}>(`/api/instruments/v1/instruments?provider=oanda&kind=forex`);
    }

    listProviders(): Observable<{data: string[]}>{
        return this.http.get<{data: string[]}>(`/api/instruments/v1/providers`); 
    }

    listExchanges(): Observable<any> {
        return this.http.get<{data: string[]}>(`/api/instruments/v1/exchanges`);
    }

    getLoggedIn() {
        return this.loggedIn$.asObservable();
    }

    getHistoricalData(instrumentId: string): Observable<CandleResponse> {
        return this.http.get<CandleResponse>(`/api/bars/v1/bars/count-back?instrumentId=${instrumentId}&provider=oanda&interval=1&periodicity=minute&barsCount=10`);
    }

    ngOnDestroy() {
        this.stopTokenExpirationTimer();
        this.closeWSConnection();
    }
}