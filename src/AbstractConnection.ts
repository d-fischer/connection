import { EventEmitter, EventHandler } from '@d-fischer/typed-event-emitter';
import { Connection, ConnectionInfo } from './Connection';

export abstract class AbstractConnection extends EventEmitter implements Connection {
	protected readonly _host: string;
	protected readonly _port?: number;
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
		this._secure = Boolean(secure);
		this._lineBased = Boolean(lineBased);
		if (port) {
			this._host = hostName;
			this._port = port;
		} else {
			const splitHost = hostName.split(':');
			if (splitHost.length > 2) {
				throw new Error('malformed hostName');
			}
			const [host, splitPort] = splitHost;
			this._host = host;
			if (splitPort) {
				this._port = Number(splitPort);
			}
		}
	}

	async connect() {
		return this.doConnect();
	}

	async disconnect(manually = true) {
		if (this.hasSocket && manually) {
			this._manualDisconnect = true;
		}
		await this.doDisconnect();
		this._handleDisconnect();
	}

	destroy() {
		this.removeListener();
	}

	sendLine(line: string): void {
		if (this._connected) {
			line = line.replace(/[\0\r\n]/g, '');
			this.sendRaw(`${line}\r\n`);
		}
	}

	protected receiveRaw(data: string) {
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

	get isConnecting() {
		return this._connecting;
	}

	get isConnected() {
		return this._connected;
	}

	get host() {
		return this._host;
	}

	protected _handleDisconnect(error?: Error) {
		this.emit(this.onDisconnect, this._manualDisconnect, error);
		this.emit(this.onEnd, this._manualDisconnect, error);
		if (this._manualDisconnect) {
			this._manualDisconnect = false;
		}
		this.destroy();
	}

	protected abstract async doConnect(): Promise<void>;
	protected abstract async doDisconnect(): Promise<void>;

	protected abstract sendRaw(line: string): void;

	abstract get hasSocket(): boolean;
	abstract get port(): number;
}
