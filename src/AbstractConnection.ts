import type { EventHandler } from '@d-fischer/typed-event-emitter';
import { EventEmitter } from '@d-fischer/typed-event-emitter';
import type { Connection, ConnectionInfo } from './Connection';

export abstract class AbstractConnection extends EventEmitter implements Connection {
	protected readonly _host: string;
	protected readonly _port: number;
	protected readonly _secure: boolean;

	private readonly _lineBased: boolean;
	private _currentLine = '';

	protected _connecting: boolean = false;
	protected _connected: boolean = false;
	protected _manualDisconnect: boolean = false;

	readonly onReceive = this.registerEvent<EventHandler<[string]>>();
	readonly onConnect = this.registerEvent<EventHandler<[]>>();
	readonly onDisconnect = this.registerEvent<EventHandler<[boolean, Error?]>>();
	readonly onEnd = this.registerEvent<EventHandler<[boolean, Error?]>>();

	constructor({ hostName, port, secure, lineBased }: ConnectionInfo) {
		super();
		this._secure = secure ?? true;
		this._lineBased = lineBased ?? false;
		this._host = hostName;
		this._port = port;
	}

	get isConnecting(): boolean {
		return this._connecting;
	}

	get isConnected(): boolean {
		return this._connected;
	}

	get host(): string {
		return this._host;
	}

	sendLine(line: string): void {
		if (this._connected) {
			line = line.replace(/[\0\r\n]/g, '');
			this.sendRaw(`${line}\r\n`);
		}
	}

	abstract connect(): Promise<void>;
	abstract disconnect(): Promise<void>;

	assumeExternalDisconnect(): void {
		this._connected = false;
		this._connecting = false;
		this.emit(this.onDisconnect, false);
	}

	protected receiveRaw(data: string): void {
		if (!this._lineBased) {
			this.emit(this.onReceive, data);
			return;
		}
		const receivedLines = data.split('\r\n');
		this._currentLine += receivedLines.shift() || '';
		if (receivedLines.length) {
			this.emit(this.onReceive, this._currentLine);
			this._currentLine = receivedLines.pop() || '';
			for (const line of receivedLines) {
				this.emit(this.onReceive, line);
			}
		}
	}

	protected abstract sendRaw(line: string): void;

	abstract get hasSocket(): boolean;
	abstract get port(): number;
}
