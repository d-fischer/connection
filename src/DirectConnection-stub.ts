import { AbstractConnection } from './AbstractConnection';
import type { ConnectionOptions, ConnectionTarget } from './Connection';

export class DirectConnection extends AbstractConnection {
	constructor(target: ConnectionTarget, options: ConnectionOptions<never>) {
		throw new Error('DirectConnection is not implemented in a browser environment');
		super(options);
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
