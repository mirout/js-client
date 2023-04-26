/*
 * Copyright 2023 Fluence Labs Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { RelayOptions } from '@fluencelabs/interfaces';
import { multiaddr, Multiaddr } from '@multiformats/multiaddr';
import { isString } from './utils.js';

export function relayOptionToMultiaddr(relay: RelayOptions): Multiaddr {
    const multiaddrString = isString(relay) ? relay : relay.multiaddr;
    const ma = multiaddr(multiaddrString);

    throwIfHasNoPeerId(ma);

    return ma;
}

export function throwIfHasNoPeerId(ma: Multiaddr): void {
    const peerId = ma.getPeerId();
    if (!peerId) {
        throw new Error('Specified multiaddr is invalid or missing peer id: ' + ma.toString());
    }
}