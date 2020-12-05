import { AbstractConnection } from './AbstractConnection';
import WebSocket from '@d-fischer/isomorphic-ws';

export class WebSocketConnection extends AbstractConnection {
	private _socket?: WebSocket;

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
		return new Promise<void>((resolve, reject) => {
			this._connecting = true;
			const url = `ws${this._secure ? 's' : ''}://${this._host}:${this.port}`;
			this._socket = new WebSocket(url);

			this._socket.onopen = () => {
				this._connected = true;
				this._connecting = false;
				this.emit(this.onConnect);
				resolve();
			};

			this._socket.onmessage = ({ data }: { data: WebSocket.Data }) => {
				this.receiveRaw(data.toString());
			};

			// The following empty error callback needs to exist so connection errors are passed down to `onclose` down below - otherwise the process just crashes instead
			this._socket.onerror = () => {};

			this._socket.onclose = e => {
				const wasConnected = this._connected;
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
			};
		});
	}

	async disconnect(): Promise<void> {
		return new Promise<void>(resolve => {
			const listener = this.onDisconnect(() => {
				listener.unbind();
				resolve();
			});
			this._socket?.close();
			this._socket = undefined;
		});
	}
}
