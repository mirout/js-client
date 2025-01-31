/**
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

import { PeerIdB58 } from "@fluencelabs/interfaces";

import { FluencePeer, PeerConfig } from "../jsPeer/FluencePeer.js";
import { JsServiceHost } from "../jsServiceHost/JsServiceHost.js";
import { KeyPair } from "../keypair/index.js";
import { IMarineHost } from "../marine/interfaces.js";

import { EphemeralNetwork } from "./network.js";

/**
 * Ephemeral network client is a FluencePeer that connects to a relay peer in an ephemeral network.
 */
export class EphemeralNetworkClient extends FluencePeer {
  constructor(
    config: PeerConfig,
    keyPair: KeyPair,
    marine: IMarineHost,
    network: EphemeralNetwork,
    relay: PeerIdB58,
  ) {
    const conn = network.getRelayConnection(keyPair.getPeerId(), relay);

    super(config, keyPair, marine, new JsServiceHost(), conn);
  }
}
