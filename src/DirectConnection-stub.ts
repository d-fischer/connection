import type { Logger } from '@d-fischer/logger';
import { AbstractConnection } from './AbstractConnection';
import type { ConnectionInfo } from './Connection';

export class DirectConnection extends AbstractConnection {
	constructor(options: ConnectionInfo, logger?: Logger, additionalOptions?: never) {
		throw new Error('DirectConnection is not implemented in a browser environment');
		super(options, logger, additionalOptions);
	}

	get port(): number {
		return this._port;
	}

	// eslint-disable-next-line @typescript-eslint/class-literal-property-style
	get hasSocket(): boolean {
		return false;
	}

	sendRaw(line: string): void {
		void line;
	}

	async connect(): Promise<void> {
		//
	}

	async disconnect(): Promise<void> {
		//
	}
}
