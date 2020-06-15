import { AbstractConnection } from './AbstractConnection';
import WebSocket from '@d-fischer/isomorphic-ws';

export class WebSocketConnection extends AbstractConnection {
	private _socket?: WebSocket;

	get port() {
		return this._port || (this._secure ? 443 : 80);
	}

	get hasSocket() {
		return !!this._socket;
	}

	destroy() {
		if (this._socket) {
			this._socket.close();
			this._socket = undefined;
		}
		super.destroy();
	}

	sendRaw(line: string) {
		if (this._socket) {
			this._socket.send(line);
		}
	}

	protected async doConnect() {
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
				this._connected = false;
				this._connecting = false;
				if (e.wasClean) {
					this._handleDisconnect();
				} else {
					const err = new Error(`[${e.code}] ${e.reason}`);
					this._handleDisconnect(err);
					reject(err);
				}
			};
		});
	}

	protected async doDisconnect(): Promise<void> {
		this._socket?.close();
	}
}
