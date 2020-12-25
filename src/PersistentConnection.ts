import type { Logger } from '@d-fischer/logger';
import type { Constructor } from '@d-fischer/shared-utils';
import { delay } from '@d-fischer/shared-utils';
import { EventEmitter } from '@d-fischer/typed-event-emitter';
import type { ConnectionOptions } from './AbstractConnection';
import type { Connection, ConnectionInfo } from './Connection';

export interface PersistentConnectionConfig {
	retryLimit?: number;
	logger?: Logger;
}

export class PersistentConnection<T extends Connection> extends EventEmitter implements Connection {
	private readonly _retryLimit = Infinity;
	private readonly _logger?: Logger;

	private _connecting = false;
	private _retryTimerGenerator?: Iterator<number, never>;
	private _connectionRetryCount = 0;
	private _currentConnection?: Connection;

	readonly onReceive = this.registerEvent<[string]>();
	readonly onConnect = this.registerEvent<[]>();
	readonly onDisconnect = this.registerEvent<[boolean, Error?]>();
	readonly onEnd = this.registerEvent<[boolean, Error?]>();

	constructor(
		private readonly _type: Constructor<T>,
		private readonly _connectionInfo: ConnectionInfo,
		config: PersistentConnectionConfig = {},
		private readonly _additionalOptions?: ConnectionOptions<T>
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
		this._logger?.trace(
			`PersistentConnection connect currentConnectionExists:${Boolean(
				this._currentConnection
			).toString()} connecting:${this._connecting.toString()}`
		);
		if (this._currentConnection || this._connecting) {
			throw new Error('Connection already present');
		}

		this._connectionRetryCount = 0;
		this._connecting = true;
		this._retryTimerGenerator = PersistentConnection._getReconnectWaitTime();

		while (this._connectionRetryCount <= this._retryLimit) {
			const newConnection = (this._currentConnection = new this._type(
				this._connectionInfo,
				this._logger,
				this._additionalOptions
			));
			newConnection.onReceive(line => this.emit(this.onReceive, line));
			newConnection.onConnect(() => this.emit(this.onConnect));
			newConnection.onDisconnect((manually, reason) => {
				this.emit(this.onDisconnect, manually, reason);
				if (manually) {
					this.emit(this.onEnd, true);
					void newConnection.disconnect();
					if (this._currentConnection === newConnection) {
						this._currentConnection = undefined;
					}
				} else if (!this._connecting) {
					void this.reconnect();
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
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				if (!this._connecting) {
					return;
				}
			}
		}

		this.emit(this.onEnd, false, new Error(`Connection failed after trying ${this._retryLimit} times`));
	}

	async disconnect(): Promise<void> {
		this._logger?.trace('PersistentConnection disconnect');
		this._connecting = false;
		if (this._currentConnection) {
			await this._currentConnection.disconnect();
			this._currentConnection = undefined;
		}
	}

	assumeExternalDisconnect(): void {
		this._logger?.trace('PersistentConnection assumeExternalDisconnect');
		this._currentConnection?.assumeExternalDisconnect();
	}

	async reconnect(): Promise<void> {
		await this.disconnect();
		return this.connect();
	}

	// yes, this is just fibonacci with a limit
	private static *_getReconnectWaitTime(): Iterator<number, never> {
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
