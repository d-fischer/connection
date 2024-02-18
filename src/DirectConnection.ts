import { Socket } from 'net';
import * as tls from 'tls';
import { AbstractConnection } from './AbstractConnection';
import type { ConnectionOptions, ConnectionTarget } from './Connection';

export class DirectConnection extends AbstractConnection {
	private _socket: Socket | null = null;
	private _closingOnDemand = false;
	private _hadError = false;

	protected readonly _host: string;
	protected readonly _port: number;
	protected readonly _secure: boolean;

	constructor(target: ConnectionTarget, options?: ConnectionOptions<never>) {
		super(options);
		if (!target.hostName || !target.port) {
			throw new Error('DirectConnection requires hostName and port to be set');
		}
		this._host = target.hostName;
		this._port = target.port;
		this._secure = target.secure ?? true;
	}

	get hasSocket(): boolean {
		return !!this._socket;
	}

	sendRaw(line: string): void {
		this._socket?.write(line);
	}

	connect(): void {
		this._logger?.trace('DirectConnection connect');
		this._connecting = true;
		if (this._secure) {
			this._socket = tls.connect(this._port, this._host);
		} else {
			this._socket = new Socket();
			this._socket.connect(this._port, this._host);
		}
		this._socket.on('connect', () => {
			this._logger?.trace('DirectConnection onConnect');
			this._connecting = false;
			this._connected = true;
			this._closingOnDemand = false;
			this._hadError = false;
			this.emit(this.onConnect);
		});
		this._socket.on('error', (err: Error) => {
			this._logger?.trace(`DirectConnection onError message:${err.message}`);
			this._connected = false;
			this._connecting = false;
			this.emit(this.onDisconnect, false, err);
			this._hadError = true;
		});
		this._socket.on('data', (data: Buffer) => {
			this.receiveRaw(data.toString());
		});
		this._socket.on('close', () => {
			this._logger?.trace(
				`DirectConnection onClose closingOnDemand:${this._closingOnDemand.toString()} hadError:${this._hadError.toString()}`
			);
			if (!this._hadError) {
				this._connected = false;
				this._connecting = false;
				this.emit(this.onDisconnect, this._closingOnDemand);
			}
			this._closingOnDemand = false;
			this._hadError = false;
			this.clearSocket();
		});
	}

	disconnect(): void {
		this._logger?.trace('DirectConnection disconnect');
		this._closingOnDemand = true;
		this._socket?.end();
	}

	protected clearSocket(): void {
		if (this._socket) {
			this._socket.removeAllListeners('connect');
			this._socket.removeAllListeners('error');
			this._socket.removeAllListeners('data');
			this._socket.removeAllListeners('close');
			this._socket = null;
		}
	}
}
