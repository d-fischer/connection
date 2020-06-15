import { EventBinder } from '@d-fischer/typed-event-emitter';

export interface Connection {
	readonly isConnecting: boolean;
	readonly isConnected: boolean;
	readonly host: string;
	readonly port: number;
	readonly hasSocket: boolean;

	readonly onReceive: EventBinder<[string]>;
	readonly onConnect: EventBinder<[]>;
	readonly onDisconnect: EventBinder<[boolean, Error?]>;
	readonly onEnd: EventBinder<[boolean, Error?]>;

	connect(): Promise<void>;

	disconnect(): Promise<void>;

	sendLine(line: string): void;

	destroy?(): void;
}

export interface ConnectionInfo {
	hostName: string;
	port?: number;
	secure?: boolean;
	lineBased?: boolean;
}
