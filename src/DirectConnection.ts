import { Socket } from 'net';
import * as tls from 'tls';
import { AbstractConnection } from './AbstractConnection';
import type { ConnectionOptions, ConnectionTarget } from './Connection';

export class DirectConnection extends AbstractConnection {
	private _socket: Socket | null = null;
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

	async connect(): Promise<void> {
		this._logger?.trace('DirectConnection connect');
		await new Promise<void>((resolve, reject) => {
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
				this.emit(this.onConnect);
				resolve();
			});
			this._socket.on('error', (err: Error) => {
				this._logger?.trace(`DirectConnection onError message:${err.message}`);
				this._connected = false;
				this._connecting = false;
				this.emit(this.onDisconnect, false, err);
				reject(err);
			});
			this._socket.on('data', (data: Buffer) => {
				this.receiveRaw(data.toString());
			});
			this._socket.on('close', (hadError: boolean) => {
				this._logger?.trace(`DirectConnection onClose hadError:${hadError.toString()}`);
				if (!hadError) {
					this._connected = false;
					this._connecting = false;
					this.emit(this.onDisconnect, true);
				}
				if (this._socket) {
					this._socket.removeAllListeners('connect');
					this._socket.removeAllListeners('error');
					this._socket.removeAllListeners('data');
					this._socket.removeAllListeners('close');
					this._socket = null;
				}
			});
		});
	}

	async disconnect(): Promise<void> {
		this._logger?.trace('DirectConnection disconnect');
		await new Promise<void>(resolve => {
			if (this._socket) {
				const listener = this.onDisconnect(() => {
					listener.unbind();
					resolve();
				});
				this._socket.end();
			} else {
				resolve();
			}
		});
	}
}
