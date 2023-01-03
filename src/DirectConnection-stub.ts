import { type EventBinder } from '@d-fischer/typed-event-emitter';
import { type Connection } from './Connection';

export class DirectConnection implements Connection {
	declare readonly hasSocket: boolean;
	declare sendRaw: (line: string) => void;
	declare sendLine: (line: string) => void;
	declare readonly isConnected: boolean;
	declare readonly isConnecting: boolean;

	declare readonly connect: () => void;
	declare readonly disconnect: () => void;
	declare readonly assumeExternalDisconnect: () => void;

	declare readonly onConnect: EventBinder<[]>;
	declare readonly onDisconnect: EventBinder<[boolean, Error]>;
	declare readonly onEnd: EventBinder<[boolean, Error]>;
	declare readonly onReceive: EventBinder<[string]>;

	constructor() {
		throw new Error('DirectConnection is not implemented in a browser environment');
	}
}
