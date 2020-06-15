import { AbstractConnection } from './AbstractConnection';

import { Socket } from 'net';
import * as tls from 'tls';

export class DirectConnection extends AbstractConnection {
	private _socket?: Socket;

	get port() {
		return this._port || (this._secure ? 6697 : 6667);
	}

	get hasSocket() {
		return !!this._socket;
	}

	destroy() {
		if (this._socket) {
			this._socket.destroy();
			this._socket = undefined;
		}
		super.destroy();
	}

	sendRaw(line: string) {
		if (this._socket) {
			this._socket.write(line);
		}
	}

	protected async doConnect() {
		return new Promise<void>((resolve, reject) => {
			this._connecting = true;
			const connectionErrorListener = (err: Error) => {
				this._connected = false;
				this._connecting = false;
				this._handleDisconnect(err);
				reject(err);
			};
			const connectionListener = () => {
				this._connecting = false;
				this._connected = true;
				this.emit(this.onConnect);
				resolve();
			};
			if (this._secure) {
				this._socket = tls.connect(this.port, this._host, {}, connectionListener);
			} else {
				this._socket = new Socket();
				this._socket.connect(this.port, this._host, connectionListener);
			}
			this._socket.on('error', connectionErrorListener);
			this._socket.on('data', (data: Buffer) => {
				this.receiveRaw(data.toString());
			});
			this._socket.on('close', () => {
				this._connected = false;
				this._connecting = false;
				this._handleDisconnect();
			});
		});
	}

	protected async doDisconnect(): Promise<void> {
		if (this._socket) {
			await new Promise(resolve => this._socket!.end(() => resolve));
		}
	}
}
