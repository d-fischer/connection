import type { ClientOptions } from '@d-fischer/isomorphic-ws';
import { WebSocket } from '@d-fischer/isomorphic-ws';
import { AbstractConnection } from './AbstractConnection';
import type { ConnectionOptions, ConnectionTarget } from './Connection';

export interface WebSocketConnectionOptions {
	wsOptions?: ClientOptions;
}

export class WebSocketConnection extends AbstractConnection<WebSocketConnectionOptions> {
	private _socket: WebSocket | null = null;
	private readonly _url: string;

	constructor(target: ConnectionTarget, options?: ConnectionOptions<WebSocketConnectionOptions>) {
		super(options);
		if (target.hostName && target.port) {
			this._url = `ws${target.secure ? 's' : ''}://${target.hostName}:${target.port}`;
		} else if (target.url) {
			this._url = target.url;
		} else {
			throw new Error('WebSocketConnection requires either hostName & port or url to be set');
		}
	}

	get hasSocket(): boolean {
		return !!this._socket;
	}

	sendRaw(line: string): void {
		this._socket?.send(line);
	}

	connect(): void {
		this._logger?.trace('WebSocketConnection connect');
		this._connecting = true;
		this._socket = new WebSocket(this._url, this._additionalOptions?.wsOptions);

		this._socket.onopen = () => {
			this._logger?.trace('WebSocketConnection onOpen');
			this._connected = true;
			this._connecting = false;
			this.emit(this.onConnect);
		};

		this._socket.onmessage = ({ data }) => {
			this.receiveRaw((data as Buffer).toString());
		};

		// The following empty error callback needs to exist so connection errors are passed down to `onclose` down below - otherwise the process just crashes instead
		this._socket.onerror = e => {
			this._logger?.trace(`WebSocketConnection onError message:${e.message}`);
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
			}
			if (this._socket) {
				this._socket.onopen = null!;
				this._socket.onmessage = null!;
				this._socket.onerror = null!;
				this._socket.onclose = null!;
				this._socket = null;
			}
		};
	}

	disconnect(): void {
		this._logger?.trace('WebSocketConnection disconnect');
		this._socket?.close();
	}
}
