import { KeyPair } from '../../internal/KeyPair';
import { RequestFlow } from '../../internal/RequestFlow';
import * as base64 from 'base64-js';

describe('Request flow tests', () => {
    it('particle initiation should work', async () => {
        // arrange
        jest.useFakeTimers();
        const sk = 'z1x3cVXhk9nJKE1pZaX9KxccUBzxu3aGlaUjDdAB2oY=';
        const skBytes = base64.toByteArray(sk);
        const mockDate = new Date(Date.UTC(2021, 2, 14)).valueOf();
        Date.now = jest.fn(() => mockDate);

        const request = RequestFlow.createLocal('(null)', 10000);
        const peerId = await (await KeyPair.fromEd25519SK(skBytes)).Libp2pPeerId;

        // act
        await request.initState(peerId);

        // assert
        const particle = request.getParticle();
        expect(particle).toMatchObject({
            init_peer_id: peerId.toB58String(),
            script: '(null)',
            signature: '',
            timestamp: mockDate,
            ttl: 10000,
        });
        expect(setTimeout).toHaveBeenCalledTimes(1);
    });
});
