import type { Logger } from '@d-fischer/logger';
import { EventEmitter } from '@d-fischer/typed-event-emitter';
import type { Connection, ConnectionOptions } from './Connection';

export type InferConnectionOptions<T extends Connection> = T extends AbstractConnection<infer O> ? O : never;

export abstract class AbstractConnection<Options = never> extends EventEmitter implements Connection {
	private readonly _lineBased: boolean;
	protected readonly _logger?: Logger;
	protected readonly _additionalOptions?: Options;

	private _currentLine = '';

	protected _connecting: boolean = false;
	protected _connected: boolean = false;

	readonly onReceive = this.registerEvent<[string]>();
	readonly onConnect = this.registerEvent<[]>();
	readonly onDisconnect = this.registerEvent<[boolean, Error?]>();
	readonly onEnd = this.registerEvent<[boolean, Error?]>();

	constructor({ lineBased, logger, additionalOptions }: ConnectionOptions<Options> = {}) {
		super();
		this._lineBased = lineBased ?? false;
		this._logger = logger;
		this._additionalOptions = additionalOptions;
	}

	get isConnecting(): boolean {
		return this._connecting;
	}

	get isConnected(): boolean {
		return this._connected;
	}

	sendLine(line: string): void {
		if (this._connected) {
			line = line.replace(/[\0\r\n]/g, '');
			this.sendRaw(`${line}\r\n`);
		}
	}

	abstract connect(): void;

	abstract disconnect(): void;

	assumeExternalDisconnect(): void {
		this._logger?.trace('AbstrctConnection assumeExternalDisconnect');
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
		this._currentLine += receivedLines.shift() ?? '';
		if (receivedLines.length) {
			this.emit(this.onReceive, this._currentLine);
			this._currentLine = receivedLines.pop() ?? '';
			for (const line of receivedLines) {
				this.emit(this.onReceive, line);
			}
		}
	}

	protected abstract sendRaw(line: string): void;

	abstract get hasSocket(): boolean;
}
