import type { Logger } from '@d-fischer/logger';
import type { Constructor } from '@d-fischer/shared-utils';
import { delay } from '@d-fischer/shared-utils';
import type { EventHandler } from '@d-fischer/typed-event-emitter';
import { EventEmitter } from '@d-fischer/typed-event-emitter';
import type { Connection, ConnectionInfo } from './Connection';

export interface PersistentConnectionConfig {
	retryLimit?: number;
	logger?: Logger;
}

export class PersistentConnection<T extends Connection> extends EventEmitter implements Connection {
	private readonly _retryLimit = Infinity;
	private readonly _logger?: Logger;

	private _connecting = false;
	private _retryTimerGenerator?: Iterator<number>;
	private _connectionRetryCount = 0;
	private _currentConnection?: Connection;

	readonly onReceive = this.registerEvent<EventHandler<[string]>>();
	readonly onConnect = this.registerEvent<EventHandler<[]>>();
	readonly onDisconnect = this.registerEvent<EventHandler<[boolean, Error?]>>();
	readonly onEnd = this.registerEvent<EventHandler<[boolean, Error?]>>();

	constructor(
		private _type: Constructor<T>,
		private _connectionInfo: ConnectionInfo,
		config: PersistentConnectionConfig = {}
	) {
		super();
		this._retryLimit = config.retryLimit ?? Infinity;
		this._logger = config.logger;
	}

	get isConnected(): boolean {
		return this._currentConnection?.isConnected ?? false;
	}

	get isConnecting(): boolean {
		return this._currentConnection?.isConnecting ?? this._connecting;
	}

	get host(): string {
		return this._connectionInfo.hostName;
	}

	get port(): number {
		return this._connectionInfo.port;
	}

	get hasSocket(): boolean {
		return this._currentConnection?.hasSocket ?? false;
	}

	sendLine(line: string): void {
		this._currentConnection?.sendLine(line);
	}

	async connect(): Promise<void> {
		if (this._currentConnection || this._connecting) {
			throw new Error('Connection already present');
		}

		this._connectionRetryCount = 0;
		this._connecting = true;
		this._retryTimerGenerator = PersistentConnection._getReconnectWaitTime();

		while (this._connectionRetryCount <= this._retryLimit) {
			const newConnection = (this._currentConnection = new this._type(this._connectionInfo));
			newConnection.onReceive(line => this.emit(this.onReceive, line));
			newConnection.onConnect(() => this.emit(this.onConnect));
			newConnection.onDisconnect((manually, reason) => {
				this.emit(this.onDisconnect, manually, reason);
				if (manually) {
					this.emit(this.onEnd, true);
					newConnection.disconnect();
					if (this._currentConnection === newConnection) {
						this._currentConnection = undefined;
					}
				} else if (!this._connecting) {
					this.reconnect();
				}
			});
			try {
				await newConnection.connect();
				this._connecting = false;
				return;
			} catch (e) {
				if (!this._connecting) {
					return;
				}
				this._connectionRetryCount++;
				const secs = this._retryTimerGenerator.next().value;
				if (secs !== 0) {
					this._logger?.info(`Retrying in ${secs} seconds`);
				}
				await delay(secs * 1000);
				this._logger?.info('Trying to reconnect');
				if (!this._connecting) {
					return;
				}
			}
		}

		this.emit(this.onEnd, false, new Error(`Connection failed after trying ${this._retryLimit} times`));
	}

	async disconnect(): Promise<void> {
		this._connecting = false;
		if (this._currentConnection) {
			await this._currentConnection.disconnect();
			this._currentConnection = undefined;
		}
	}

	assumeExternalDisconnect(): void {
		this._currentConnection?.assumeExternalDisconnect();
	}

	async reconnect(): Promise<void> {
		await this.disconnect();
		return this.connect();
	}

	// yes, this is just fibonacci with a limit
	private static *_getReconnectWaitTime(): IterableIterator<number> {
		let current = 0;
		let next = 1;

		while (current < 120) {
			yield current;
			[current, next] = [next, current + next];
		}

		while (true) {
			yield 120;
		}
	}
}
