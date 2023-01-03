import type { Logger } from '@d-fischer/logger';
import type { Constructor, ResolvableValueSync } from '@d-fischer/shared-utils';
import { fibWithLimit, resolveConfigValueSync } from '@d-fischer/shared-utils';
import { EventEmitter } from '@d-fischer/typed-event-emitter';
import type { InferConnectionOptions } from './AbstractConnection';
import type { Connection, ConnectionOptions, ConnectionTarget } from './Connection';

export interface PersistentConnectionConfig<T> extends ConnectionOptions<T> {
	retryLimit?: number;
	initialRetryLimit?: number;
	overlapManualReconnect?: boolean;
}

export class PersistentConnection<T extends Connection> extends EventEmitter implements Connection {
	private readonly _retryLimit = Infinity;
	private readonly _initialRetryLimit = 3;

	private readonly _logger?: Logger;

	private _connecting = false;
	private _retryTimerGenerator?: Iterator<number, never>;
	private _connectionRetryCount = 0;
	private _currentConnection?: Connection;
	private _previousConnection?: Connection;

	readonly onReceive = this.registerEvent<[string]>();
	readonly onConnect = this.registerEvent<[]>();
	readonly onDisconnect = this.registerEvent<[boolean, Error?]>();
	readonly onEnd = this.registerEvent<[boolean, Error?]>();

	constructor(
		private readonly _type: Constructor<T>,
		private readonly _target: ResolvableValueSync<ConnectionTarget>,
		private readonly _config: PersistentConnectionConfig<InferConnectionOptions<T>> = {}
	) {
		super();
		this._retryLimit = _config.retryLimit ?? Infinity;
		this._logger = _config.logger;
	}

	get isConnected(): boolean {
		return this._currentConnection?.isConnected ?? false;
	}

	get isConnecting(): boolean {
		return this._currentConnection?.isConnecting ?? this._connecting;
	}

	get hasSocket(): boolean {
		return this._currentConnection?.hasSocket ?? false;
	}

	sendLine(line: string): void {
		this._currentConnection?.sendLine(line);
	}

	connect(): void {
		if (this._currentConnection || this._connecting) {
			throw new Error('Connection already present');
		}
		this._connecting = true;
		this._connectionRetryCount = 0;
		this._tryConnect(true);
	}

	disconnect(): void {
		this._logger?.trace(
			`PersistentConnection disconnect currentConnectionExists:${Boolean(
				this._currentConnection
			).toString()} connecting:${this._connecting.toString()}`
		);
		this._connecting = false;
		if (this._currentConnection) {
			const lastConnection = this._currentConnection;
			this._currentConnection = undefined;
			lastConnection.disconnect();
		}
	}

	assumeExternalDisconnect(): void {
		this._logger?.trace('PersistentConnection assumeExternalDisconnect');
		this._currentConnection?.assumeExternalDisconnect();
	}

	reconnect(): void {
		this._reconnect(true);
	}

	acknowledgeSuccessfulReconnect(): void {
		if (this._previousConnection) {
			this._previousConnection.disconnect();
			this._previousConnection = undefined;
		}
	}

	private _startTryingToConnect(userGenerated = false): void {
		this._connecting = true;
		this._connectionRetryCount = 0;
		this._tryConnect(userGenerated);
	}

	private _tryConnect(userGenerated = false): void {
		this._logger?.trace(
			`PersistentConnection tryConnect currentConnectionExists:${Boolean(
				this._currentConnection
			).toString()} connecting:${this._connecting.toString()}`
		);

		const retryLimit = userGenerated ? this._initialRetryLimit : this._retryLimit;
		this._retryTimerGenerator ??= fibWithLimit(120);

		const newConnection = (this._currentConnection = new this._type(
			resolveConfigValueSync(this._target),
			this._config
		));
		newConnection.onReceive(line => this.emit(this.onReceive, line));
		newConnection.onConnect(() => {
			this.emit(this.onConnect);
			this._connecting = false;
			this._retryTimerGenerator = undefined;
		});
		newConnection.onDisconnect((manually, reason) => {
			this.emit(this.onDisconnect, manually, reason);
			if (manually) {
				this.emit(this.onEnd, true);
				this._connecting = false;
				this._retryTimerGenerator = undefined;
				newConnection.disconnect();
				if (this._currentConnection === newConnection) {
					this._currentConnection = undefined;
				}
				if (this._previousConnection === newConnection) {
					this._previousConnection = undefined;
				}
			} else if (this._connecting) {
				this._logger?.debug(`Connection error caught: ${reason?.message ?? 'unknown error'}`);
				if (this._connectionRetryCount >= retryLimit) {
					return;
				}
				this._connectionRetryCount++;
				const secs = this._retryTimerGenerator!.next().value;
				if (secs !== 0) {
					this._logger?.info(`Retrying in ${secs} seconds`);
				}
				setTimeout(() => {
					if (!this._connecting) {
						return;
					}
					this._logger?.info(userGenerated ? 'Retrying connection' : 'Trying to reconnect');
					this._tryConnect();
				}, secs * 1000);
			} else {
				this._reconnect();
			}
		});

		newConnection.connect();
	}

	private _reconnect(userGenerated = false): void {
		if (userGenerated && this._config.overlapManualReconnect) {
			this._previousConnection = this._currentConnection;
			this._currentConnection = undefined;
		} else {
			this.disconnect();
		}
		this._startTryingToConnect(userGenerated);
	}
}
