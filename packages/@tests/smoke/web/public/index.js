const fluence = globalThis.fluence;

// Relay from kras network
// Currently the tests executes some calls to registry. And they fail for a single local node setup. So we use kras instead.
const relay = {
    multiaddr: '/dns4/kras-01.fluence.dev/tcp/19001/wss/p2p/12D3KooWKnEqMfYo9zvfHmqTLpLdiHXPe4SVqUWcWHDJdFGrSmcA',
    peerId: '12D3KooWKnEqMfYo9zvfHmqTLpLdiHXPe4SVqUWcWHDJdFGrSmcA',
};

// Relay running on local machine
//const relay = {
//    multiaddr: '/ip4/127.0.0.1/tcp/4310/ws/p2p/12D3KooWKEprYXUXqoV5xSBeyqrWLpQLLH4PXfvVkDJtmcqmh5V3',
//    peerId: '12D3KooWKEprYXUXqoV5xSBeyqrWLpQLLH4PXfvVkDJtmcqmh5V3',
//};

const getRelayTime = () => {
    const script = `
                    (xor
                     (seq
                      (seq
                       (seq
                        (seq
                         (call %init_peer_id% ("getDataSrv" "-relay-") [] -relay-)
                         (call %init_peer_id% ("getDataSrv" "relayPeerId") [] relayPeerId)
                        )
                        (call -relay- ("op" "noop") [])
                       )
                       (xor
                        (seq
                         (call relayPeerId ("peer" "timestamp_ms") [] ts)
                         (call -relay- ("op" "noop") [])
                        )
                        (seq
                         (call -relay- ("op" "noop") [])
                         (call %init_peer_id% ("errorHandlingSrv" "error") [%last_error% 1])
                        )
                       )
                      )
                      (xor
                       (call %init_peer_id% ("callbackSrv" "response") [ts])
                       (call %init_peer_id% ("errorHandlingSrv" "error") [%last_error% 2])
                      )
                     )
                     (call %init_peer_id% ("errorHandlingSrv" "error") [%last_error% 3])
                    )`;

    const def = {
        functionName: 'getRelayTime',
        arrow: {
            tag: 'arrow',
            domain: {
                tag: 'labeledProduct',
                fields: {
                    relayPeerId: {
                        tag: 'scalar',
                        name: 'string',
                    },
                },
            },
            codomain: {
                tag: 'unlabeledProduct',
                items: [
                    {
                        tag: 'scalar',
                        name: 'u64',
                    },
                ],
            },
        },
        names: {
            relay: '-relay-',
            getDataSrv: 'getDataSrv',
            callbackSrv: 'callbackSrv',
            responseSrv: 'callbackSrv',
            responseFnName: 'response',
            errorHandlingSrv: 'errorHandlingSrv',
            errorFnName: 'error',
        },
    };

    const config = {};

    const args = { relayPeerId: relay.peerId };
    return fluence.callAquaFunction({
        args,
        def,
        script,
        config,
        peer: fluence.defaultClient,
    });
};

const main = async () => {
    console.log('starting fluence...');
    await fluence.defaultClient.connect(relay);
    console.log('started fluence');

    console.log('getting relay time...');
    const relayTime = await getRelayTime();
    console.log('got relay time, ', relayTime);

    console.log('stopping fluence...');
    await fluence.defaultClient.stop();
    console.log('stopped fluence...');

    return relayTime;
};

const btn = document.getElementById('btn');

btn.addEventListener('click', () => {
    main().then((res) => {
        const inner = document.createElement('div');
        inner.id = 'res';
        inner.innerText = 'res';
        document.getElementById('res-placeholder').appendChild(inner);
    });
});