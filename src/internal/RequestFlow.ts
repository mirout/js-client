import log, { trace } from 'loglevel';
import PeerId from 'peer-id';
import { AquamarineInterpreter } from './aqua/interpreter';
import { AquaCallHandler } from './AquaHandler';
import { InterpreterOutcome, PeerIdB58 } from './commonTypes';
import { FluenceConnection } from './FluenceConnection';
import { Particle, genUUID, logParticle } from './particle';

export const DEFAULT_TTL = 7000;

/**
 * The class represents the current view (and state) of distributed the particle execution process from client's point of view.
 * It stores the intermediate particles state during the process. RequestFlow is identified by the id of the particle that is executed during the flow.
 * Each RequestFlow contains a separate (unique to the current flow) AquaCallHandler where the handling of `call` AIR instruction takes place
 * Please note, that RequestFlow's is handler is combined with the handler from client before the execution occures.
 * After the combination middlewares from RequestFlow are executed before client handler's middlewares.
 */
export class RequestFlow {
    private state: Particle;
    private prevData: Uint8Array = Buffer.from([]);
    private onTimeoutHandlers = [];
    private onErrorHandlers = [];

    readonly id: string;
    readonly isExternal: boolean;
    readonly script: string;
    readonly handler = new AquaCallHandler();

    ttl: number = DEFAULT_TTL;
    relayPeerId?: PeerIdB58;

    static createExternal(particle: Particle): RequestFlow {
        const res = new RequestFlow(true, particle.id, particle.script);
        res.ttl = particle.ttl;
        res.state = particle;
        setTimeout(res.raiseTimeout.bind(res), particle.ttl);
        return res;
    }

    static createLocal(script: string, ttl?: number): RequestFlow {
        const res = new RequestFlow(false, genUUID(), script);
        res.ttl = ttl ?? DEFAULT_TTL;
        return res;
    }

    constructor(isExternal: boolean, id: string, script: string) {
        this.isExternal = isExternal;
        this.id = id;
        this.script = script;
    }

    onTimeout(handler: () => void) {
        this.onTimeoutHandlers.push(handler);
    }

    onError(handler: (error) => void) {
        this.onErrorHandlers.push(handler);
    }

    async execute(interpreter: AquamarineInterpreter, connection: FluenceConnection, relayPeerId?: PeerIdB58) {
        if (this.hasExpired()) {
            return;
        }

        logParticle(log.debug, 'interpreter executing particle', this.getParticle());
        const interpreterOutcome = this.runInterpreter(interpreter);

        log.debug('inner interpreter outcome:', {
            ret_code: interpreterOutcome.ret_code,
            error_message: interpreterOutcome.error_message,
            next_peer_pks: interpreterOutcome.next_peer_pks,
        });

        if (interpreterOutcome.ret_code !== 0) {
            this.raiseError(
                `Interpreter failed with code=${interpreterOutcome.ret_code} message=${interpreterOutcome.error_message}`,
            );
        }

        const nextPeers = interpreterOutcome.next_peer_pks;

        // do nothing if there are no peers to send particle further
        if (nextPeers.length === 0) {
            return;
        }

        // we only expect a single possible peer id to send particle further
        if (nextPeers.length > 1) {
            throw new Error(
                'Particle is expected to be sent to only the single peer (relay which client is connected to)',
            );
        }

        // this peer id must be the relay, the client is connected to
        if (!relayPeerId || nextPeers[0] !== relayPeerId) {
            throw new Error(
                'Particle is expected to be sent to only the single peer (relay which client is connected to)',
            );
        }

        if (!connection) {
            throw new Error('Cannot send particle: non connected');
        }

        this.sendIntoConnection(connection);
    }

    async initState(peerId: PeerId): Promise<void> {
        const id = this.id;
        let currentTime = Date.now();

        const particle: Particle = {
            id: id,
            init_peer_id: peerId.toB58String(),
            timestamp: currentTime,
            ttl: this.ttl,
            script: this.script,
            signature: '',
            data: Buffer.from([]),
        };

        this.state = particle;
        setTimeout(this.raiseTimeout.bind(this), particle.ttl);
    }

    receiveUpdate(particle: Particle) {
        // TODO:: keep the history of particle data mb?
        this.prevData = this.state.data;
        this.state.data = particle.data;
    }

    async sendIntoConnection(connection: FluenceConnection): Promise<void> {
        const particle = this.state;
        try {
            await connection.sendParticle(particle);
        } catch (err) {
            log.error(`Error on sending particle with id ${particle.id}: ${err}`);
        }
    }

    runInterpreter(interpreter: AquamarineInterpreter) {
        const interpreterOutcomeStr = interpreter.invoke(
            this.state.init_peer_id,
            this.state.script,
            this.prevData,
            this.state.data,
        );
        const interpreterOutcome: InterpreterOutcome = JSON.parse(interpreterOutcomeStr);
        // TODO:: keep the history of particle data mb?
        this.state.data = interpreterOutcome.data;
        return interpreterOutcome;
    }

    getParticle = () => this.state;

    hasExpired(): boolean {
        let now = Date.now();
        const particle = this.getParticle();
        let actualTtl = particle.timestamp + particle.ttl - now;
        return actualTtl <= 0;
    }

    raiseError(error) {
        for (const h of this.onErrorHandlers) {
            h(error);
        }
    }

    private raiseTimeout() {
        const now = Date.now();
        const particle = this.state;
        log.info(`Particle expired. Now: ${now}, ttl: ${particle?.ttl}, ts: ${particle?.timestamp}`);

        for (const h of this.onTimeoutHandlers) {
            h();
        }
    }
}