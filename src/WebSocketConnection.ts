import * as WebSocket from '@d-fischer/isomorphic-ws';
import type { ClientOptions } from 'ws';
import { AbstractConnection } from './AbstractConnection';

export interface WebSocketConnectionOptions {
	wsOptions?: ClientOptions;
}

export class WebSocketConnection extends AbstractConnection<WebSocketConnectionOptions> {
	private _socket: WebSocket | null = null;

	get port(): number {
		return this._port;
	}

	get hasSocket(): boolean {
		return !!this._socket;
	}

	sendRaw(line: string): void {
		this._socket?.send(line);
	}

	async connect(): Promise<void> {
		this._logger?.trace('WebSocketConnection connect');
		return new Promise<void>((resolve, reject) => {
			this._connecting = true;
			const url = `ws${this._secure ? 's' : ''}://${this._host}:${this.port}`;
			this._socket = new WebSocket(url, this._additionalOptions?.wsOptions);

			this._socket.onopen = () => {
				this._logger?.trace('WebSocketConnection onOpen');
				this._connected = true;
				this._connecting = false;
				this.emit(this.onConnect);
				resolve();
			};

			this._socket.onmessage = ({ data }: { data: WebSocket.Data }) => {
				this.receiveRaw((data as string | Buffer).toString());
			};

			// The following empty error callback needs to exist so connection errors are passed down to `onclose` down below - otherwise the process just crashes instead
			this._socket.onerror = e => {
				this._logger?.trace(`WebSocketConnection onError message:${e.message}`);
				this._logger?.warn(
					'WebSocket onerror callback called, please change the log level to trace and open an issue with the debug log'
				);
			};

			this._socket.onclose = e => {
				const wasConnected = this._connected;
				this._logger?.trace(
					`WebSocketConnection onClose wasConnected:${wasConnected.toString()} wasClean:${e.wasClean.toString()}`
				);
				this._connected = false;
				this._connecting = false;
				if (e.wasClean) {
					this.emit(this.onDisconnect, true);
					this.emit(this.onEnd, true);
				} else {
					const err = new Error(`[${e.code}] ${e.reason}`);
					this.emit(this.onDisconnect, false, err);
					this.emit(this.onEnd, false, err);
					if (!wasConnected) {
						reject(err);
					}
				}
				if (this._socket) {
					this._socket.onopen = null!;
					this._socket.onmessage = null!;
					this._socket.onerror = null!;
					this._socket.onclose = null!;
					this._socket = null;
				}
			};
		});
	}

	async disconnect(): Promise<void> {
		this._logger?.trace('WebSocketConnection disconnect');
		return new Promise<void>(resolve => {
			if (this._socket) {
				const listener = this.onDisconnect(() => {
					listener.unbind();
					resolve();
				});
				this._socket.close();
			} else {
				resolve();
			}
		});
	}
}
